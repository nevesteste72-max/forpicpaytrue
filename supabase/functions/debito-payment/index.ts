import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEBITO_API_URL = "https://my.debito.co.mz/api/v1";

interface PaymentRequest {
  method: "mpesa" | "emola" | "card";
  amount: number;
  msisdn?: string;
  reference_description: string;
  // Transaction data
  payment_link_id?: string;
  customer_email?: string;
  customer_phone?: string;
  order_bump_accepted?: boolean;
  order_bump_amount?: number;
  // Card fields
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  callback_url?: string;
}

/**
 * Normalize msisdn to 9-digit local format required by Débito API.
 * Accepts: 843649395, 258843649395, +258843649395
 * Returns: 843649395 (9-digit local number)
 */
function normalizeMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("258") && digits.length === 12) {
    return digits.slice(3);
  }
  if (digits.length === 9 && /^8[4-7]/.test(digits)) {
    return digits;
  }
  return digits.startsWith("258") ? digits.slice(3) : digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEBITO_API_TOKEN = Deno.env.get("DEBITO_API_TOKEN");
    if (!DEBITO_API_TOKEN) throw new Error("DEBITO_API_TOKEN is not configured");

    const DEBITO_WALLET_ID = Deno.env.get("DEBITO_WALLET_ID");
    if (!DEBITO_WALLET_ID) throw new Error("DEBITO_WALLET_ID is not configured");

    const DEBITO_EMOLA_WALLET_ID = Deno.env.get("DEBITO_EMOLA_WALLET_ID");
    if (!DEBITO_EMOLA_WALLET_ID) throw new Error("DEBITO_EMOLA_WALLET_ID is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: PaymentRequest = await req.json();
    const { method, amount, msisdn, payment_link_id, customer_email, customer_phone, customer_name, order_bump_accepted, order_bump_amount, first_name, last_name, email, phone, callback_url } = body;

    // Generate a short, safe transaction reference (no spaces, max 15 chars)
    // The Debito API rejects references with spaces or over 20 chars
    const safeChars = (body.reference_description || "PAG")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 8)
      .toUpperCase() || "PAG";
    const shortId = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    const reference_description = `${safeChars}${shortId}`; // e.g. "CLOSEFRI3A8B2C" (max 14 chars)

    if (!method || !amount || !reference_description) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: method, amount, reference_description" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be at least 1 MZN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Create transaction in DB if payment_link_id is provided ---
    let transactionId: string | null = null;

    if (payment_link_id && customer_email) {
      const { data: tx, error: txErr } = await supabaseAdmin
        .from("transactions")
        .insert({
          payment_link_id,
          customer_email,
          customer_name: customer_name || "",
          customer_phone: customer_phone || null,
          amount,
          order_bump_accepted: order_bump_accepted || false,
          order_bump_amount: order_bump_amount || 0,
          status: "processing",
        })
        .select("id")
        .single();

      if (txErr) {
        console.error("Failed to create transaction:", txErr);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao criar transação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      transactionId = tx.id;
      console.log("Transaction created:", transactionId);
    }

    // --- Build Débito API request ---
    let endpoint: string;
    let requestBody: Record<string, unknown>;

    switch (method) {
      case "mpesa": {
        if (!msisdn) {
          return new Response(
            JSON.stringify({ success: false, error: "Phone number (msisdn) is required for M-Pesa" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const normalizedMsisdn = normalizeMsisdn(msisdn);
        console.log(`M-Pesa msisdn normalized: ${msisdn} -> ${normalizedMsisdn}`);

        endpoint = `${DEBITO_API_URL}/wallets/${DEBITO_WALLET_ID}/c2b/mpesa`;
        requestBody = { msisdn: normalizedMsisdn, amount, reference_description };
        break;
      }

      case "emola": {
        if (!msisdn) {
          return new Response(
            JSON.stringify({ success: false, error: "Phone number (msisdn) is required for eMola" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const normalizedMsisdn = normalizeMsisdn(msisdn);
        console.log(`eMola msisdn normalized: ${msisdn} -> ${normalizedMsisdn}`);
        // eMola uses prefixes 86 and 87 (Movitel)
        if (!/^8[67]\d{7}$/.test(normalizedMsisdn)) {
          return new Response(
            JSON.stringify({ success: false, error: "Número inválido para eMola. Use prefixo 86 ou 87." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        endpoint = `${DEBITO_API_URL}/wallets/${DEBITO_EMOLA_WALLET_ID}/c2b/emola`;
        requestBody = { msisdn: normalizedMsisdn, amount, reference_description };
        break;
      }

      case "card": {
        endpoint = `${DEBITO_API_URL}/wallets/${DEBITO_WALLET_ID}/card-payment`;
        const origin = req.headers.get("origin") || "https://debit-buddy-connect.lovable.app";
        const finalCallbackUrl = callback_url || `${origin}/?payment=complete`;
        requestBody = {
          amount,
          reference_description,
          first_name: first_name || null,
          last_name: last_name || null,
          email: email || null,
          phone: phone || null,
          callback_url: finalCallbackUrl,
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid payment method. Use: mpesa, emola, or card" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Processing ${method} payment:`, JSON.stringify({ endpoint, amount, reference_description }));

    // --- Call Débito API ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEBITO_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const isAbort =
        err instanceof DOMException
          ? err.name === "AbortError"
          : (err as { name?: string } | null)?.name === "AbortError";

      if (transactionId) {
        await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", transactionId);
      }

      if (isAbort) {
        console.error("Debito API request timed out");
        return new Response(
          JSON.stringify({ success: false, error: "Tempo limite ao contactar a Débito. Tente novamente." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Debito API fetch error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao contactar a Débito: ${errorMessage}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    console.log(`Debito API response (${response.status}):`, responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      if (transactionId) {
        await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", transactionId);
      }
      console.error("Debito API returned non-JSON response:", responseText.substring(0, 500));
      return new Response(
        JSON.stringify({
          success: false,
          error: "A API da Débito retornou uma resposta inválida.",
          details: { raw_response: responseText.substring(0, 200) },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      if (transactionId) {
        await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", transactionId);
      }
      console.error("Debito API error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || data.error || "Payment failed",
          details: data,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Payment initiated successfully, update transaction ---
    if (transactionId) {
      await supabaseAdmin
        .from("transactions")
        .update({
          debito_reference: data.debito_reference || null,
          status: "pending",
        })
        .eq("id", transactionId);
      console.log("Transaction updated to pending:", transactionId);
    }

    console.log("Payment initiated successfully:", JSON.stringify(data));

    return new Response(
      JSON.stringify({
        success: true,
        message: data.message || "Transaction initiated successfully",
        debito_reference: data.debito_reference,
        status: data.status,
        transaction_id: data.transaction_id,
        internal_transaction_id: transactionId,
        redirect_url: data.redirect_url || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Payment processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
