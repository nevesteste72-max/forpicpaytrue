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

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    const body = await req.json();

    // ── UPDATE existing PaymentIntent (order bump toggled) ──
    if (body.update_intent && body.payment_intent_id && body.transaction_id) {
      const { payment_intent_id, transaction_id, payment_link_id, order_bump_accepted } = body;

      // Fetch authoritative prices from database
      const { data: linkData, error: linkErr } = await supabaseAdmin
        .from("payment_links")
        .select("amount, order_bump_price")
        .eq("id", payment_link_id)
        .single();

      if (linkErr || !linkData) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment link not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let bumpAmount = 0;
      if (order_bump_accepted && linkData.order_bump_price && Number(linkData.order_bump_price) > 0) {
        bumpAmount = Number(linkData.order_bump_price);
      }

      const serverTotal = Number(linkData.amount) + bumpAmount;
      const stripeAmount = Math.round(serverTotal * 100);

      console.log("Updating PaymentIntent:", payment_intent_id, "new amount:", serverTotal, "bump:", order_bump_accepted);

      // Update Stripe PaymentIntent amount
      await stripe.paymentIntents.update(payment_intent_id, {
        amount: stripeAmount,
      });

      // Update transaction record
      await supabaseAdmin
        .from("transactions")
        .update({
          amount: serverTotal,
          order_bump_accepted: order_bump_accepted || false,
          order_bump_amount: bumpAmount,
        })
        .eq("id", transaction_id);

      return new Response(
        JSON.stringify({ success: true, amount: serverTotal }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE new PaymentIntent ──
    const {
      payment_link_id,
      currency,
      customer_email,
      customer_name,
      payment_methods,
      order_bump_accepted,
    } = body;

    if (!payment_link_id || !currency || !customer_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch authoritative prices from database (never trust client amounts)
    const { data: linkData, error: linkErr } = await supabaseAdmin
      .from("payment_links")
      .select("amount, order_bump_price")
      .eq("id", payment_link_id)
      .single();

    if (linkErr || !linkData) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment link not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let bumpAmount = 0;
    if (order_bump_accepted && linkData.order_bump_price && Number(linkData.order_bump_price) > 0) {
      bumpAmount = Number(linkData.order_bump_price);
    }

    const totalAmount = Number(linkData.amount) + bumpAmount;
    const stripeAmount = Math.round(totalAmount * 100);

    // Create or find Stripe Customer for one-click upsell support
    // Skip customer creation for temp/placeholder emails — real email comes later
    const isTempEmail = customer_email.includes("@checkout.cashpay.co");
    let stripeCustomerId: string | undefined;
    if (!isTempEmail) {
      try {
        const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({
            email: customer_email,
            name: customer_name || undefined,
          });
          stripeCustomerId = newCustomer.id;
        }
      } catch (custErr) {
        console.error("Failed to create/find Stripe customer:", custErr);
      }
    }

    // Create transaction record
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        payment_link_id,
        customer_email,
        customer_name: customer_name || "",
        customer_phone: "",
        amount: totalAmount,
        currency: currency.toUpperCase(),
        payment_provider: "stripe",
        order_bump_accepted: order_bump_accepted || false,
        order_bump_amount: bumpAmount,
        status: "pending",
        stripe_customer_id: stripeCustomerId || null,
      })
      .select("id")
      .single();

    if (txErr) {
      console.error("Failed to create transaction:", txErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transaction created:", tx.id, "amount:", totalAmount, "customer:", stripeCustomerId);

    // Map UI payment method names to valid Stripe payment_method_types
    const VALID_STRIPE_METHODS = new Set(["card"]);
    const rawMethods: string[] = Array.isArray(payment_methods) && payment_methods.length > 0
      ? payment_methods
      : ["card"];
    
    const allowedMethods = [...new Set(
      rawMethods
        .map((m: string) => {
          if (m === "apple_pay" || m === "google_pay") return "card";
          return m;
        })
        .filter((m: string) => VALID_STRIPE_METHODS.has(m))
    )];

    if (allowedMethods.length === 0) allowedMethods.push("card");

    // Create PaymentIntent with setup_future_usage for one-click upsell
    const piParams: Record<string, unknown> = {
      amount: stripeAmount,
      currency: currency.toLowerCase(),
      payment_method_types: allowedMethods,
      setup_future_usage: "off_session",
      metadata: {
        transaction_id: tx.id,
        payment_link_id,
        customer_email,
        customer_name: customer_name || "",
      },
      // receipt_email removed to prevent Stripe from sending automatic receipts
      description: `Payment for ${payment_link_id}`,
    };

    if (stripeCustomerId) {
      piParams.customer = stripeCustomerId;
    }

    const paymentIntent = await stripe.paymentIntents.create(piParams as Stripe.PaymentIntentCreateParams);

    // Update transaction with stripe payment intent ID
    await supabaseAdmin
      .from("transactions")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
      })
      .eq("id", tx.id);

    console.log("PaymentIntent created:", paymentIntent.id);

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: paymentIntent.client_secret,
        transaction_id: tx.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe payment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
