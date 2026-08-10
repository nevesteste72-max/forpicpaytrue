import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reply = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: appSettings } = await supabaseAdmin
      .from("app_settings")
      .select("stripe_secret_key")
      .eq("id", 1)
      .maybeSingle();
    const STRIPE_SECRET_KEY = appSettings?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    const body = await req.json();

    // ── ONE-CLICK by explicit upsell product (delivers THAT product's content) ──
    if (body.upsell_payment_link_id && body.parent_transaction_id) {
      const { parent_transaction_id, upsell_payment_link_id, tracking_params } = body;

      const { data: parentTx, error: parentErr } = await supabaseAdmin
        .from("transactions")
        .select("stripe_customer_id, stripe_payment_method_id, customer_email, customer_name, customer_phone, currency, status")
        .eq("id", parent_transaction_id)
        .single();

      if (parentErr || !parentTx) return reply({ success: false, error: "Parent transaction not found", requires_fallback: true }, 404);
      if (parentTx.status !== "successful") return reply({ success: false, error: "Parent transaction not successful", requires_fallback: true }, 403);
      if (!parentTx.stripe_customer_id || !parentTx.stripe_payment_method_id)
        return reply({ success: false, error: "No saved payment method for one-click", requires_fallback: true }, 400);

      const { data: upsell, error: upErr } = await supabaseAdmin
        .from("payment_links")
        .select("amount, currency, product_name, facebook_pixel_id, facebook_token")
        .eq("id", upsell_payment_link_id)
        .single();
      if (upErr || !upsell) return reply({ success: false, error: "Upsell product not found", requires_fallback: true }, 404);

      // Prevent double charge (reload / double click)
      const { data: existing } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("parent_transaction_id", parent_transaction_id)
        .eq("payment_link_id", upsell_payment_link_id)
        .eq("status", "successful")
        .maybeSingle();
      if (existing) return reply({ success: true, transaction_id: existing.id, already_purchased: true }, 200);

      const currency = (parentTx.currency || "EUR").toLowerCase();
      const stripeAmount = Math.round(Number(upsell.amount) * 100);

      const { data: newTx, error: txErr } = await supabaseAdmin
        .from("transactions")
        .insert({
          payment_link_id: upsell_payment_link_id,
          customer_email: parentTx.customer_email,
          customer_name: parentTx.customer_name || "",
          customer_phone: parentTx.customer_phone || "",
          amount: Number(upsell.amount),
          currency: currency.toUpperCase(),
          payment_provider: "stripe",
          status: "pending",
          parent_transaction_id,
          stripe_customer_id: parentTx.stripe_customer_id,
          stripe_payment_method_id: parentTx.stripe_payment_method_id,
        })
        .select("id")
        .single();
      if (txErr || !newTx) return reply({ success: false, error: "Failed to create transaction", requires_fallback: true }, 500);

      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: stripeAmount,
          currency,
          customer: parentTx.stripe_customer_id,
          payment_method: parentTx.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: { transaction_id: newTx.id, parent_transaction_id, is_upsell: "true" },
          description: `Upsell ${upsell_payment_link_id}`,
        });
      } catch (e) {
        await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", newTx.id);
        return reply({ success: false, error: "card_error", requires_fallback: true, detail: String((e as Error)?.message || e) }, 402);
      }

      if (paymentIntent.status === "succeeded") {
        await supabaseAdmin.from("transactions").update({ status: "successful", stripe_payment_intent_id: paymentIntent.id }).eq("id", newTx.id);

        const base = `${SUPABASE_URL}/functions/v1`;
        const auth = { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
        try { await fetch(`${base}/send-purchase-email`, { method: "POST", headers: auth, body: JSON.stringify({ customer_email: parentTx.customer_email, customer_name: parentTx.customer_name || "", product_name: upsell.product_name, amount: Number(upsell.amount), currency: currency.toUpperCase(), transaction_id: newTx.id }) }); } catch (_) { /* ignore */ }
        try { await fetch(`${base}/utmify-notify`, { method: "POST", headers: auth, body: JSON.stringify({ transaction_id: newTx.id, product_name: `Upsell: ${upsell.product_name}`, product_id: upsell_payment_link_id, customer_name: parentTx.customer_name || "", customer_email: parentTx.customer_email, customer_phone: parentTx.customer_phone || "", amount: Number(upsell.amount), currency: currency.toUpperCase(), order_bump_accepted: false, order_bump_amount: 0, payment_method: "stripe", status: "successful", created_at: new Date().toISOString(), approved_at: new Date().toISOString(), tracking_params: tracking_params || undefined }) }); } catch (_) { /* ignore */ }
        try { if (upsell.facebook_pixel_id && upsell.facebook_token) await fetch(`${base}/facebook-conversion`, { method: "POST", headers: auth, body: JSON.stringify({ transaction_id: newTx.id, pixel_id: upsell.facebook_pixel_id, access_token: upsell.facebook_token, event_name: "Purchase", value: Number(upsell.amount), currency: currency.toUpperCase(), customer_email: parentTx.customer_email, customer_phone: parentTx.customer_phone || "" }) }); } catch (_) { /* ignore */ }

        return reply({ success: true, transaction_id: newTx.id }, 200);
      }

      await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", newTx.id);
      return reply({ success: false, error: "requires_action", requires_fallback: true, status: paymentIntent.status }, 402);
    }

    // ── LEGACY: flow_step based one-click (kept for backward compatibility) ──
    const { parent_transaction_id, flow_step_id, tracking_params } = body;

    if (!parent_transaction_id || !flow_step_id) {
      return reply({ success: false, error: "Missing parent_transaction_id or flow_step_id" }, 400);
    }

    const { data: parentTx, error: parentErr } = await supabaseAdmin
      .from("transactions")
      .select("stripe_customer_id, stripe_payment_method_id, customer_email, customer_name, customer_phone, payment_link_id, currency, status")
      .eq("id", parent_transaction_id)
      .single();

    if (parentErr || !parentTx) return reply({ success: false, error: "Parent transaction not found" }, 404);
    if (parentTx.status !== "successful") return reply({ success: false, error: "Parent transaction is not in a successful state" }, 403);
    if (!parentTx.stripe_customer_id || !parentTx.stripe_payment_method_id) return reply({ success: false, error: "No saved payment method for one-click" }, 400);

    const { data: step, error: stepErr } = await supabaseAdmin
      .from("flow_steps")
      .select("amount, product_name, payment_link_id")
      .eq("id", flow_step_id)
      .single();

    if (stepErr || !step) return reply({ success: false, error: "Flow step not found" }, 404);
    if (step.payment_link_id !== parentTx.payment_link_id) return reply({ success: false, error: "Flow step does not belong to this transaction" }, 403);

    const stripeAmount = Math.round(Number(step.amount) * 100);
    const currency = (parentTx.currency || "ZAR").toLowerCase();

    const { data: newTx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        payment_link_id: step.payment_link_id,
        customer_email: parentTx.customer_email,
        customer_name: parentTx.customer_name || "",
        customer_phone: parentTx.customer_phone || "",
        amount: Number(step.amount),
        currency: currency.toUpperCase(),
        payment_provider: "stripe",
        status: "pending",
        parent_transaction_id,
        flow_step_id,
        stripe_customer_id: parentTx.stripe_customer_id,
        stripe_payment_method_id: parentTx.stripe_payment_method_id,
      })
      .select("id")
      .single();

    if (txErr || !newTx) return reply({ success: false, error: "Failed to create transaction" }, 500);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency,
      customer: parentTx.stripe_customer_id,
      payment_method: parentTx.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: { transaction_id: newTx.id, flow_step_id, parent_transaction_id, is_upsell: "true" },
      description: `Payment for ${step.payment_link_id}`,
    });

    if (paymentIntent.status === "succeeded") {
      await supabaseAdmin.from("transactions").update({ status: "successful", stripe_payment_intent_id: paymentIntent.id }).eq("id", newTx.id);
      return reply({ success: true, transaction_id: newTx.id }, 200);
    } else {
      await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", newTx.id);
      return reply({ success: false, error: "Payment requires additional authentication", status: paymentIntent.status }, 402);
    }
  } catch (error) {
    console.error("One-click upsell error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return reply({ success: false, error: errorMessage, requires_fallback: true }, 500);
  }
});
