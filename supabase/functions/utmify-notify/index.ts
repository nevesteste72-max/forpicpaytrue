import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UTMIFY_API_URL = "https://api.utmify.com.br/api-credentials/orders";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UTMIFY-NOTIFY] ${step}${detailsStr}`);
};

/**
 * Fetches exchange rate to USD. Falls back to hardcoded rate.
 */
async function getExchangeRateToUsd(currency: string): Promise<number> {
  const fallbacks: Record<string, number> = { ZAR: 0.055, MZN: 0.016 };
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data.result === "success" && data.rates?.USD) {
      logStep("Exchange rate fetched", { [`${currency}_to_USD`]: data.rates.USD });
      return data.rates.USD;
    }
  } catch (err) {
    logStep("Exchange rate API failed", { error: String(err) });
  }
  // Fallback
  try {
    const res2 = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data2 = await res2.json();
    if (data2.rates?.USD) return data2.rates.USD;
  } catch { /* ignore */ }
  const rate = fallbacks[currency] || 0.016;
  logStep("Using hardcoded fallback rate", { rate });
  return rate;
}

/**
 * Maps internal status to UTMify status.
 */
function mapStatus(status: string): string {
  switch (status) {
    case "successful": case "completed": case "success": return "paid";
    case "pending": case "processing": return "waiting_payment";
    case "failed": return "refused";
    case "refunded": return "refunded";
    default: return "waiting_payment";
  }
}

/**
 * Maps payment provider to UTMify payment method.
 */
function mapPaymentMethod(provider: string): string {
  switch (provider) {
    case "stripe": return "credit_card";
    case "debito": case "mpesa": return "pix";
    default: return "credit_card";
  }
}

/**
 * Converts an amount in a given currency to USD cents.
 */
async function toCentsUSD(amount: number, currency: string): Promise<number> {
  if (currency === "USD") return Math.round(amount * 100);
  const rate = await getExchangeRateToUsd(currency);
  return Math.round(amount * rate * 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UTMIFY_API_TOKEN = Deno.env.get("UTMIFY_API_TOKEN");
    if (!UTMIFY_API_TOKEN) throw new Error("UTMIFY_API_TOKEN is not configured");

    logStep("Function started");

    const body = await req.json();
    const {
      transaction_id, product_name, product_id,
      customer_name, customer_email, customer_phone,
      amount, currency,
      order_bump_accepted, order_bump_amount,
      payment_method, status, created_at, approved_at,
      tracking_params,
      // New: order bump details for products array
      order_bumps,
    } = body;

    if (!transaction_id || !customer_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Processing transaction", { transaction_id, currency, amount, status });

    // Build products array
    const products: { id: string; name: string; planId: null; planName: null; quantity: number; priceInCents: number }[] = [];

    // Main product: amount minus order bump total
    const bumpTotal = order_bump_accepted ? Number(order_bump_amount || 0) : 0;
    const mainProductAmount = Number(amount) - bumpTotal;
    const mainPriceCents = await toCentsUSD(mainProductAmount, currency);

    products.push({
      id: product_id || transaction_id,
      name: product_name || "Product",
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: mainPriceCents,
    });

    // Add individual order bumps if accepted
    if (order_bump_accepted && order_bumps && Array.isArray(order_bumps)) {
      for (const bump of order_bumps) {
        if (bump.name && bump.price && Number(bump.price) > 0) {
          const bumpCents = await toCentsUSD(Number(bump.price), currency);
          products.push({
            id: bump.id || `bump-${products.length}`,
            name: `Order Bump: ${bump.name}`,
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: bumpCents,
          });
        }
      }
    }

    // Total in cents USD
    const totalCents = products.reduce((sum, p) => sum + p.priceInCents, 0);

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
      products,
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
        totalPriceInCents: totalCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: totalCents,
        currency: "USD",
      },
      isTest: false,
    };

    logStep("Sending to UTMify", {
      orderId: utmifyPayload.orderId,
      status: utmifyPayload.status,
      products: utmifyPayload.products.length,
      trackingParameters: utmifyPayload.trackingParameters,
    });

    const utmifyResponse = await fetch(UTMIFY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": UTMIFY_API_TOKEN,
      },
      body: JSON.stringify(utmifyPayload),
    });

    const responseText = await utmifyResponse.text();
    logStep("UTMify response", { status: utmifyResponse.status, body: responseText.substring(0, 500) });

    if (!utmifyResponse.ok) {
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
