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
    const { parent_transaction_id, flow_step_id, tracking_params } = body;

    if (!parent_transaction_id || !flow_step_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing parent_transaction_id or flow_step_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch parent transaction to get saved payment method
    const { data: parentTx, error: parentErr } = await supabaseAdmin
      .from("transactions")
      .select("stripe_customer_id, stripe_payment_method_id, customer_email, customer_name, customer_phone, payment_link_id, currency")
      .eq("id", parent_transaction_id)
      .single();

    if (parentErr || !parentTx) {
      return new Response(
        JSON.stringify({ success: false, error: "Parent transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parentTx.stripe_customer_id || !parentTx.stripe_payment_method_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No saved payment method for one-click" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch flow step to get amount (never trust client)
    const { data: step, error: stepErr } = await supabaseAdmin
      .from("flow_steps")
      .select("amount, product_name, payment_link_id")
      .eq("id", flow_step_id)
      .single();

    if (stepErr || !step) {
      return new Response(
        JSON.stringify({ success: false, error: "Flow step not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeAmount = Math.round(Number(step.amount) * 100);
    const currency = (parentTx.currency || "ZAR").toLowerCase();

    console.log("One-click upsell:", {
      customer: parentTx.stripe_customer_id,
      paymentMethod: parentTx.stripe_payment_method_id,
      amount: step.amount,
      stepId: flow_step_id,
    });

    // Create a new transaction record for this upsell
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

    if (txErr || !newTx) {
      console.error("Failed to create upsell transaction:", txErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create and confirm PaymentIntent off-session (one-click)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency,
      customer: parentTx.stripe_customer_id,
      payment_method: parentTx.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: {
        transaction_id: newTx.id,
        flow_step_id,
        parent_transaction_id,
        is_upsell: "true",
      },
      // receipt_email removed to prevent Stripe from sending automatic receipts
      description: `Payment for ${step.payment_link_id}`,
    });

    if (paymentIntent.status === "succeeded") {
      // Update transaction to successful
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "successful",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", newTx.id);

      console.log("One-click upsell succeeded:", paymentIntent.id);

      // Send purchase email for upsell
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-purchase-email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_email: parentTx.customer_email,
            customer_name: parentTx.customer_name || "",
            product_name: step.product_name,
            amount: Number(step.amount),
            currency: currency.toUpperCase(),
            transaction_id: newTx.id,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send upsell email:", emailErr);
      }

      // Notify UTMify about the upsell sale
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/utmify-notify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction_id: newTx.id,
            product_name: `Upsell: ${step.product_name}`,
            product_id: step.payment_link_id,
            customer_name: parentTx.customer_name || "",
            customer_email: parentTx.customer_email,
            customer_phone: parentTx.customer_phone || "",
            amount: Number(step.amount),
            currency: currency.toUpperCase(),
            order_bump_accepted: false,
            order_bump_amount: 0,
            payment_method: "stripe",
            status: "successful",
            created_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            tracking_params: tracking_params || undefined,
          }),
        });
        console.log("UTMify notified for upsell:", newTx.id);
      } catch (utmErr) {
        console.error("Failed to notify UTMify for upsell:", utmErr);
      }

      // Notify Facebook Conversions API for upsell
      try {
        // Get pixel info from the payment link
        const { data: linkData } = await supabaseAdmin
          .from("payment_links")
          .select("facebook_pixel_id, facebook_token")
          .eq("id", step.payment_link_id)
          .single();

        if (linkData?.facebook_pixel_id && linkData?.facebook_token) {
          await fetch(`${SUPABASE_URL}/functions/v1/facebook-conversion`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transaction_id: newTx.id,
              pixel_id: linkData.facebook_pixel_id,
              access_token: linkData.facebook_token,
              event_name: "Purchase",
              value: Number(step.amount),
              currency: currency.toUpperCase(),
              customer_email: parentTx.customer_email,
              customer_phone: parentTx.customer_phone || "",
            }),
          });
          console.log("Facebook conversion sent for upsell:", newTx.id);
        }
      } catch (fbErr) {
        console.error("Failed to notify Facebook for upsell:", fbErr);
      }

      return new Response(
        JSON.stringify({ success: true, transaction_id: newTx.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Payment requires additional action or failed
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", newTx.id);

      return new Response(
        JSON.stringify({ success: false, error: "Payment requires additional authentication", status: paymentIntent.status }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("One-click upsell error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
