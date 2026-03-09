import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UTMIFY_API_URL = "https://api.utmify.com.br/api-credentials/orders";

interface UtmifyPayload {
  transaction_id: string;
  product_name: string;
  product_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount: number;
  currency: string;
  order_bump_accepted: boolean;
  order_bump_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  tracking_params?: {
    src?: string | null;
    sck?: string | null;
    utm_source?: string | null;
    utm_campaign?: string | null;
    utm_medium?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  };
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UTMIFY-NOTIFY] ${step}${detailsStr}`);
};

/**
 * Fetches the current ZAR → USD exchange rate using a free API.
 * Falls back to a reasonable estimate if the API fails.
 */
async function getZarToUsdRate(): Promise<number> {
  try {
    const res = await fetch(
      "https://open.er-api.com/v6/latest/ZAR",
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (data.result === "success" && data.rates?.USD) {
      logStep("Exchange rate fetched", { ZAR_to_USD: data.rates.USD });
      return data.rates.USD;
    }
    throw new Error("Invalid exchange rate response");
  } catch (err) {
    logStep("Exchange rate API failed, trying fallback", { error: String(err) });
    // Fallback API
    try {
      const res2 = await fetch(
        "https://api.exchangerate-api.com/v4/latest/ZAR",
        { signal: AbortSignal.timeout(5000) }
      );
      const data2 = await res2.json();
      if (data2.rates?.USD) {
        logStep("Fallback exchange rate fetched", { ZAR_to_USD: data2.rates.USD });
        return data2.rates.USD;
      }
    } catch {
      // ignore
    }
    // Hard fallback ~0.055 (approximate ZAR/USD)
    logStep("Using hardcoded fallback rate", { ZAR_to_USD: 0.055 });
    return 0.055;
  }
}

/**
 * Maps internal status to UTMify status.
 */
function mapStatus(status: string): string {
  switch (status) {
    case "successful":
    case "completed":
    case "success":
      return "paid";
    case "pending":
    case "processing":
      return "waiting_payment";
    case "failed":
      return "refused";
    case "refunded":
      return "refunded";
    default:
      return "waiting_payment";
  }
}

/**
 * Maps payment provider to UTMify payment method.
 */
function mapPaymentMethod(provider: string): string {
  switch (provider) {
    case "stripe":
      return "credit_card";
    case "debito":
    case "mpesa":
      return "pix"; // closest mobile money equivalent
    default:
      return "credit_card";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UTMIFY_API_TOKEN = Deno.env.get("UTMIFY_API_TOKEN");
    if (!UTMIFY_API_TOKEN) {
      throw new Error("UTMIFY_API_TOKEN is not configured");
    }

    logStep("Function started");

    const body: UtmifyPayload = await req.json();
    const {
      transaction_id,
      product_name,
      product_id,
      customer_name,
      customer_email,
      customer_phone,
      amount,
      currency,
      order_bump_accepted,
      order_bump_amount,
      payment_method,
      status,
      created_at,
      approved_at,
      tracking_params,
    } = body;

    if (!transaction_id || !customer_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Processing transaction", { transaction_id, currency, amount, status });

    // The 'amount' field from the DB already includes the order bump value,
    // so we must NOT add order_bump_amount again to avoid double-counting.
    const totalAmount = Number(amount);

    // Determine currency and convert if needed
    let finalAmountInCents: number;
    let utmifyCurrency: string;

    if (currency === "ZAR") {
      // Convert ZAR to USD using daily exchange rate
      const zarToUsd = await getZarToUsdRate();
      const amountInUsd = totalAmount * zarToUsd;
      finalAmountInCents = Math.round(amountInUsd * 100);
      utmifyCurrency = "USD";
      logStep("ZAR converted to USD", {
        originalZAR: totalAmount,
        rate: zarToUsd,
        convertedUSD: amountInUsd,
        centsUSD: finalAmountInCents,
      });
    } else {
      // MZN - also not supported by UTMify, convert to USD
      // Use a rough MZN/USD rate
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/MZN", {
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        if (data.result === "success" && data.rates?.USD) {
          const mznToUsd = data.rates.USD;
          const amountInUsd = totalAmount * mznToUsd;
          finalAmountInCents = Math.round(amountInUsd * 100);
          utmifyCurrency = "USD";
          logStep("MZN converted to USD", {
            originalMZN: totalAmount,
            rate: mznToUsd,
            convertedUSD: amountInUsd,
          });
        } else {
          // Fallback: ~0.016 USD per MZN
          finalAmountInCents = Math.round(totalAmount * 0.016 * 100);
          utmifyCurrency = "USD";
        }
      } catch {
        finalAmountInCents = Math.round(totalAmount * 0.016 * 100);
        utmifyCurrency = "USD";
      }
    }

    // Build UTMify payload
    const utmifyStatus = mapStatus(status);
    const utmifyPaymentMethod = mapPaymentMethod(payment_method);

    const utmifyPayload = {
      orderId: transaction_id,
      platform: "Cashpay",
      paymentMethod: utmifyPaymentMethod,
      status: utmifyStatus,
      createdAt: created_at
        ? new Date(created_at).toISOString().replace("T", " ").substring(0, 19)
        : new Date().toISOString().replace("T", " ").substring(0, 19),
      approvedDate: approved_at
        ? new Date(approved_at).toISOString().replace("T", " ").substring(0, 19)
        : utmifyStatus === "paid"
        ? new Date().toISOString().replace("T", " ").substring(0, 19)
        : null,
      refundedAt: null,
      customer: {
        name: customer_name || customer_email.split("@")[0],
        email: customer_email,
        phone: customer_phone || null,
        document: null,
      },
      products: [
        {
          id: product_id || transaction_id,
          name: product_name || "Product",
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: finalAmountInCents,
        },
      ],
      trackingParameters: {
        src: tracking_params?.src || null,
        sck: tracking_params?.sck || null,
        utm_source: tracking_params?.utm_source || null,
        utm_campaign: tracking_params?.utm_campaign || null,
        utm_medium: tracking_params?.utm_medium || null,
        utm_content: tracking_params?.utm_content || null,
        utm_term: tracking_params?.utm_term || null,
      },
      commission: {
        totalPriceInCents: finalAmountInCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: finalAmountInCents,
        currency: utmifyCurrency,
      },
      isTest: false,
    };

    logStep("Sending to UTMify", { orderId: utmifyPayload.orderId, status: utmifyPayload.status });

    // Send to UTMify
    const utmifyResponse = await fetch(UTMIFY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": UTMIFY_API_TOKEN,
      },
      body: JSON.stringify(utmifyPayload),
    });

    const responseText = await utmifyResponse.text();
    logStep("UTMify response", {
      status: utmifyResponse.status,
      body: responseText.substring(0, 500),
    });

    if (!utmifyResponse.ok) {
      logStep("UTMify API error", { status: utmifyResponse.status });
      return new Response(
        JSON.stringify({
          success: false,
          error: "UTMify API error",
          utmify_status: utmifyResponse.status,
          details: responseText.substring(0, 300),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("UTMify notification sent successfully");

    return new Response(
      JSON.stringify({ success: true, utmify_status: utmifyResponse.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
