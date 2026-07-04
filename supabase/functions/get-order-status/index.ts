import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const transactionId = url.searchParams.get("id");

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: "Missing id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase service credentials are not configured");

    // Service-role client: this function bypasses RLS on purpose so an
    // unauthenticated customer can look up their own order by transaction id
    // (a UUID, acting as an unguessable lookup token) from an email link.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("id, status, amount, currency, customer_name, created_at, updated_at, payment_links(product_name, redirect_url, checkout_language)")
      .eq("id", transactionId)
      .maybeSingle();

    if (error) throw error;

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentLink = transaction.payment_links as { product_name: string; redirect_url: string | null; checkout_language: string } | null;

    return new Response(
      JSON.stringify({
        id: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        customer_name: transaction.customer_name,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
        product_name: paymentLink?.product_name ?? null,
        redirect_url: transaction.status === "successful" ? (paymentLink?.redirect_url ?? null) : null,
        checkout_language: paymentLink?.checkout_language ?? "pt",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching order status:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
