import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fires UTMify notification in the background (non-blocking).
 */
async function notifyUtmify(
  supabaseUrl: string,
  serviceRoleKey: string,
  txData: {
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
    tracking_params?: Record<string, string | null>;
  }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/utmify-notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...txData,
        approved_at: new Date().toISOString(),
      }),
    });
    console.log("UTMify notification sent for tx:", txData.transaction_id);
  } catch (err) {
    console.error("Failed to notify UTMify:", err);
  }
}

/**
 * Fires purchase confirmation email via Resend (non-blocking).
 */
async function sendPurchaseEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  data: {
    customer_email: string;
    customer_name: string;
    product_name: string;
    amount: number;
    currency: string;
    transaction_id: string;
    redirect_url?: string | null;
    order_bump_accepted?: boolean;
    order_bump_name?: string | null;
    order_bump_amount?: number;
    product_type?: string | null;
    lang?: string | null;
  }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    console.log("Purchase email sent for tx:", data.transaction_id);
  } catch (err) {
    console.error("Failed to send purchase email:", err);
  }
}

/**
 * Fires payment reminder email (failed/pending) via Resend (non-blocking).
 */
async function sendPaymentReminderEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  data: {
    customer_email: string;
    customer_name: string;
    product_name: string;
    product_image_url?: string | null;
    amount: number;
    currency: string;
    transaction_id: string;
    payment_link_id: string;
    lang?: string | null;
  }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-payment-reminder-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    console.log("Payment reminder email sent for tx:", data.transaction_id);
  } catch (err) {
    console.error("Failed to send payment reminder email:", err);
  }
}

/**
 * Fires Facebook Conversions API in the background (non-blocking).
 */
async function notifyFacebook(
  supabaseUrl: string,
  serviceRoleKey: string,
  data: {
    transaction_id: string;
    pixel_id: string;
    access_token: string;
    value: number;
    currency: string;
    customer_email: string;
    customer_phone: string;
  }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/facebook-conversion`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    console.log("Facebook conversion sent for tx:", data.transaction_id);
  } catch (err) {
    console.error("Failed to notify Facebook:", err);
  }
}

    /**
     * Sends automatic WhatsApp message based on transaction event.
     */
    async function sendAutoWhatsApp(
      supabaseAdmin: ReturnType<typeof createClient>,
      txData: { customer_phone: string; customer_name: string; amount: number; currency: string; product_name: string },
      eventType: "approved" | "pending" | "failed"
    ) {
      try {
        const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !txData.customer_phone) return;

        // Find a connected instance for this user's org
        const { data: instances } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("id, instance_name, user_id, msg_template_approved, msg_template_pending, msg_template_failed, auto_recovery_enabled, auto_delivery_enabled")
          .eq("status", "connected")
          .limit(10);

        if (!instances || instances.length === 0) return;

        const templateField = eventType === "approved" ? "msg_template_approved" : eventType === "failed" ? "msg_template_failed" : "msg_template_pending";

        for (const inst of instances) {
          // Check if auto features are enabled for this event
          if (eventType === "approved" && !inst.auto_delivery_enabled) continue;
          if ((eventType === "pending" || eventType === "failed") && !inst.auto_recovery_enabled) continue;

          const template = (inst as Record<string, unknown>)[templateField] as string;
          if (!template) continue;

          const message = template
            .replace(/\{name\}/g, txData.customer_name || "Cliente")
            .replace(/\{amount\}/g, txData.amount.toFixed(2))
            .replace(/\{currency\}/g, txData.currency)
            .replace(/\{product\}/g, txData.product_name);

          // Normalize phone
          let normalizedPhone = txData.customer_phone.replace(/[\s\-\+\(\)]/g, "");
          if (normalizedPhone.startsWith("8") && normalizedPhone.length === 9) {
            normalizedPhone = "258" + normalizedPhone;
          }
          if (normalizedPhone.startsWith("0") && normalizedPhone.length === 10) {
            normalizedPhone = "27" + normalizedPhone.substring(1);
          }

          const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
          console.log(`Auto WhatsApp [${eventType}] to ${normalizedPhone} via ${inst.instance_name}`);

          const sendRes = await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({ number: normalizedPhone, text: message }),
          });
          const sendData = await sendRes.json();
          console.log(`Auto WhatsApp send result: ${JSON.stringify(sendData).substring(0, 200)}`);

          // Save message to DB
          await supabaseAdmin.from("whatsapp_messages").insert({
            instance_id: inst.id,
            user_id: inst.user_id,
            remote_jid: `${normalizedPhone}@s.whatsapp.net`,
            sender: "bot",
            message: message,
          });

          break; // Only send from first connected instance
        }
      } catch (err) {
        console.error("Auto WhatsApp error:", err);
      }
    }

    /**
 * Called by the frontend to:
 * 1. Update customer info before payment (update_customer = true)
 * 2. Confirm payment succeeded (payment_intent_id provided)
 *    — also captures the payment method for one-click upsell
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Prefer the key configured in Settings (app_settings), fall back to the env secret.
    const { data: appSettings } = await supabaseAdmin
      .from("app_settings")
      .select("stripe_secret_key")
      .eq("id", 1)
      .maybeSingle();
    const STRIPE_SECRET_KEY = appSettings?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");

    const body = await req.json();
    const { transaction_id, payment_intent_id, update_customer, customer_email, customer_name, customer_phone, payment_status, tracking_params } = body;

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing transaction_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case 1: Update customer info before payment
    if (update_customer) {
      const updateData: Record<string, unknown> = {};
      if (customer_email) updateData.customer_email = customer_email;
      if (customer_name) updateData.customer_name = customer_name;
      if (customer_phone) updateData.customer_phone = customer_phone;

      const { error } = await supabaseAdmin
        .from("transactions")
        .update(updateData)
        .eq("id", transaction_id);

      if (error) {
        console.error("Failed to update customer:", error);
      }

      // Also update Stripe Customer with real email if available
      if (customer_email && STRIPE_SECRET_KEY) {
        try {
          const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
          const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

          // Get the transaction to find stripe_customer_id or payment_intent
          const { data: txRow } = await supabaseAdmin
            .from("transactions")
            .select("stripe_customer_id, stripe_payment_intent_id")
            .eq("id", transaction_id)
            .single();

          let custId = txRow?.stripe_customer_id;

          // If no customer yet, create one with real email
          if (!custId) {
            const existing = await stripe.customers.list({ email: customer_email, limit: 1 });
            if (existing.data.length > 0) {
              custId = existing.data[0].id;
            } else {
              const newCust = await stripe.customers.create({
                email: customer_email,
                name: customer_name || undefined,
              });
              custId = newCust.id;
            }
            // Save customer ID and attach to PaymentIntent
            await supabaseAdmin.from("transactions").update({ stripe_customer_id: custId }).eq("id", transaction_id);
            if (txRow?.stripe_payment_intent_id) {
              await stripe.paymentIntents.update(txRow.stripe_payment_intent_id, { customer: custId });
            }
          } else {
            // Update existing customer with real email
            await stripe.customers.update(custId, {
              email: customer_email,
              name: customer_name || undefined,
            });
          }

          console.log("Stripe customer updated with real email:", custId, customer_email);
        } catch (stripeErr) {
          console.error("Failed to update Stripe customer:", stripeErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine the transaction status by ALWAYS retrieving the PaymentIntent from Stripe.
    // Never trust a client-supplied "successful"/"pending" status. The one exception is an
    // explicit client-reported failure with no PaymentIntent at all (e.g. a Stripe.js
    // validation error before any charge attempt) -- there is nothing to verify in that
    // case, and refusing to record it just means the customer never gets a failure email.
    let resolvedStatus: "successful" | "failed" | "pending" = "pending";
    const updateData: Record<string, unknown> = {
      stripe_payment_intent_id: payment_intent_id || null,
    };
    if (customer_email) updateData.customer_email = customer_email;

    if (!payment_intent_id) {
      if (payment_status === "failed") {
        resolvedStatus = "failed";
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "Missing payment_intent_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Stripe not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      try {
        const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
        const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

        // Derive status ONLY from Stripe's authoritative PaymentIntent state.
        if (pi.status === "succeeded") resolvedStatus = "successful";
        else if (pi.status === "canceled" || pi.status === "requires_payment_method") resolvedStatus = "failed";
        else resolvedStatus = "pending";

        if (pi.payment_method) {
          updateData.stripe_payment_method_id = typeof pi.payment_method === "string"
            ? pi.payment_method
            : pi.payment_method.id;
        }
        if (pi.customer) {
          updateData.stripe_customer_id = typeof pi.customer === "string"
            ? pi.customer
            : pi.customer.id;
        }
        console.log("Stripe PI status:", pi.status, "-> resolved:", resolvedStatus);
      } catch (stripeErr) {
        console.error("Failed to retrieve PaymentIntent from Stripe:", stripeErr);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to verify payment with Stripe" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    updateData.status = resolvedStatus;


    const { error } = await supabaseAdmin
      .from("transactions")
      .update(updateData)
      .eq("id", transaction_id);

    if (error) {
      console.error("Failed to update transaction:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transaction updated:", transaction_id, "status:", resolvedStatus);

    // Fetch full transaction + product data for UTMify & Facebook
    const { data: txRow } = await supabaseAdmin
      .from("transactions")
      .select("*, payment_links(product_name, id, logo_url, facebook_pixel_id, facebook_token, redirect_url, order_bump_name, order_bump_price, order_bump_2_name, order_bump_2_price, order_bump_3_name, order_bump_3_price, product_type, checkout_language)")
      .eq("id", transaction_id)
      .single();

    if (txRow) {
      // Only fire UTMify, Facebook, and email for successful payments
      if (resolvedStatus === "successful") {
        // Build order bumps array for UTMify products[]
        const pl = txRow.payment_links;
        const orderBumps: { id: string; name: string; price: number }[] = [];
        if (pl?.order_bump_name && pl?.order_bump_price) {
          orderBumps.push({ id: `bump-1-${txRow.payment_link_id}`, name: pl.order_bump_name, price: Number(pl.order_bump_price) });
        }
        if (pl?.order_bump_2_name && pl?.order_bump_2_price) {
          orderBumps.push({ id: `bump-2-${txRow.payment_link_id}`, name: pl.order_bump_2_name, price: Number(pl.order_bump_2_price) });
        }
        if (pl?.order_bump_3_name && pl?.order_bump_3_price) {
          orderBumps.push({ id: `bump-3-${txRow.payment_link_id}`, name: pl.order_bump_3_name, price: Number(pl.order_bump_3_price) });
        }

        // Await UTMify notification to prevent runtime kill
        await notifyUtmify(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          transaction_id: txRow.id,
          product_name: txRow.payment_links?.product_name || "Product",
          product_id: txRow.payment_link_id,
          customer_name: customer_name || txRow.customer_email?.split("@")[0] || "",
          customer_email: txRow.customer_email,
          customer_phone: txRow.customer_phone || "",
          amount: Number(txRow.amount),
          currency: txRow.currency || "ZAR",
          order_bump_accepted: txRow.order_bump_accepted || false,
          order_bump_amount: Number(txRow.order_bump_amount || 0),
          payment_method: txRow.payment_provider || "stripe",
          status: "successful",
          created_at: txRow.created_at,
          tracking_params: tracking_params || undefined,
          order_bumps: txRow.order_bump_accepted ? orderBumps : undefined,
        });

        // Fire Facebook Conversions API if configured
        const pixelId = txRow.payment_links?.facebook_pixel_id;
        const fbToken = txRow.payment_links?.facebook_token;
        if (pixelId && fbToken) {
          const totalAmount = Number(txRow.amount);
          await notifyFacebook(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            transaction_id: txRow.id,
            pixel_id: pixelId,
            access_token: fbToken,
            value: totalAmount,
            currency: txRow.currency || "ZAR",
            customer_email: txRow.customer_email,
            customer_phone: txRow.customer_phone || "",
          });
        }

        // Fire purchase confirmation email
        await sendPurchaseEmail(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          customer_email: txRow.customer_email,
          customer_name: txRow.customer_name || customer_name || "",
          product_name: txRow.payment_links?.product_name || "Product",
          amount: Number(txRow.amount),
          currency: txRow.currency || "ZAR",
          transaction_id: txRow.id,
          redirect_url: txRow.payment_links?.redirect_url || null,
          order_bump_accepted: txRow.order_bump_accepted || false,
          order_bump_name: txRow.payment_links?.order_bump_name || null,
          order_bump_amount: Number(txRow.order_bump_amount || 0),
          product_type: txRow.payment_links?.product_type || "digital",
          lang: txRow.payment_links?.checkout_language || "pt",
        });
      }

      // Fire auto WhatsApp message based on payment status
      const whatsappEvent = resolvedStatus === "successful" ? "approved"
        : resolvedStatus === "failed" ? "failed"
        : "pending";

      await sendAutoWhatsApp(supabaseAdmin, {
        customer_phone: txRow.customer_phone || "",
        customer_name: txRow.customer_name || customer_name || "Cliente",
        amount: Number(txRow.amount),
        currency: txRow.currency || "ZAR",
        product_name: txRow.payment_links?.product_name || "Product",
      }, whatsappEvent);

      if (resolvedStatus === "failed" && txRow.customer_email) {
        await sendPaymentReminderEmail(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          customer_email: txRow.customer_email,
          customer_name: txRow.customer_name || customer_name || "",
          product_name: txRow.payment_links?.product_name || "Product",
          product_image_url: txRow.payment_links?.logo_url || null,
          amount: Number(txRow.amount),
          currency: txRow.currency || "ZAR",
          transaction_id: txRow.id,
          payment_link_id: txRow.payment_link_id,
          lang: txRow.payment_links?.checkout_language || "pt",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Confirm error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
