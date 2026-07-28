import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * REAL Stripe webhook (server-side, browser-independent).
 *
 * This is the source of truth for finalizing payments. Unlike the frontend-called
 * `stripe-webhook-confirm`, this endpoint is invoked directly by Stripe and verifies
 * the event signature. It catches every payment that completes OUTSIDE the open
 * browser tab — MB Way, Multibanco (paid hours/days later at ATM), PayPal, Klarna,
 * 3DS redirects, or simply a customer who closed the page.
 *
 * On `payment_intent.succeeded` it recovers the internal transaction from the
 * PaymentIntent metadata (`transaction_id`, set in create-stripe-payment) and
 * delegates to `stripe-webhook-confirm`, which re-verifies with Stripe and fires
 * the Purchase (Meta CAPI) + delivery email + UTMify + WhatsApp. That function is
 * idempotent, so it will not double-fire if the browser already confirmed a card.
 *
 * Deploy notes:
 *  - Must run WITHOUT JWT verification (Stripe does not send a Supabase JWT).
 *  - Requires the secret STRIPE_WEBHOOK_SECRET (whsec_...) from the Stripe Dashboard
 *    endpoint configuration.
 */

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[STRIPE-WEBHOOK] Supabase credentials not configured");
    return new Response("Server not configured", { status: 500 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[STRIPE-WEBHOOK] STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // The Stripe secret key is only needed to build a client for signature
  // verification helpers; the value itself is not used to construct the event.
  const { data: appSettings } = await supabaseAdmin
    .from("app_settings")
    .select("stripe_secret_key")
    .eq("id", 1)
    .maybeSingle();
  const STRIPE_SECRET_KEY = appSettings?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) {
    console.error("[STRIPE-WEBHOOK] Stripe secret key not configured");
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

  // Verify signature against the RAW request body.
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!signature) {
    console.error("[STRIPE-WEBHOOK] Missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Deno requires the async variant (uses SubtleCrypto).
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[STRIPE-WEBHOOK] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[STRIPE-WEBHOOK] Received event: ${event.type} (${event.id})`);

  // Delegate the actual confirmation + side-effects (CAPI, email, UTMify, WhatsApp)
  // to stripe-webhook-confirm, which is idempotent on the pending -> successful edge.
  async function confirmTransaction(
    transactionId: string,
    paymentIntentId: string,
    paymentStatus: "successful" | "failed",
    customerEmail?: string | null,
    customerName?: string | null
  ) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook-confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          payment_intent_id: paymentIntentId,
          payment_status: paymentStatus,
          customer_email: customerEmail || undefined,
          customer_name: customerName || undefined,
        }),
      });
      const out = await res.json().catch(() => ({}));
      console.log(`[STRIPE-WEBHOOK] confirm ${transactionId} -> ${paymentStatus}:`, JSON.stringify(out));
    } catch (err) {
      console.error(`[STRIPE-WEBHOOK] Failed to confirm ${transactionId}:`, err);
    }
  }

  // Resolve the buyer's REAL email. The PI metadata often holds a temp placeholder
  // (the PaymentIntent is created on page load, before the buyer types the email),
  // so fall back to receipt_email / the charge billing details.
  async function resolveRealEmail(pi: Stripe.PaymentIntent, fallback?: string | null): Promise<string | null> {
    const metaEmail = pi.metadata?.customer_email;
    if (metaEmail && !metaEmail.includes("@checkout.cashpay.co")) return metaEmail;
    if (pi.receipt_email) return pi.receipt_email;
    if (pi.latest_charge) {
      try {
        const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge.id;
        const charge = await stripe.charges.retrieve(chargeId);
        const e = charge.billing_details?.email || charge.receipt_email;
        if (e) return e;
      } catch (e) {
        console.error("[STRIPE-WEBHOOK] charge fetch failed:", e);
      }
    }
    if (fallback && !fallback.includes("@checkout.cashpay.co")) return fallback;
    return metaEmail || fallback || null;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const transactionId = pi.metadata?.transaction_id;
        if (!transactionId) {
          // Fallback: locate the transaction by the stored PaymentIntent id.
          const { data: row } = await supabaseAdmin
            .from("transactions")
            .select("id, customer_email, customer_name")
            .eq("stripe_payment_intent_id", pi.id)
            .maybeSingle();
          if (row?.id) {
            await confirmTransaction(row.id, pi.id, "successful", await resolveRealEmail(pi, row.customer_email), row.customer_name);
          } else {
            console.warn(`[STRIPE-WEBHOOK] No transaction found for PI ${pi.id}`);
          }
          break;
        }
        await confirmTransaction(
          transactionId,
          pi.id,
          "successful",
          await resolveRealEmail(pi),
          pi.metadata?.customer_name
        );
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const transactionId = pi.metadata?.transaction_id;
        if (transactionId) {
          await confirmTransaction(
            transactionId,
            pi.id,
            "failed",
            pi.metadata?.customer_email || pi.receipt_email,
            pi.metadata?.customer_name
          );
        }
        break;
      }

      default:
        // Ignore other event types.
        break;
    }
  } catch (err) {
    console.error("[STRIPE-WEBHOOK] Handler error:", err);
    // Return 200 anyway so Stripe does not retry indefinitely on our internal bugs;
    // signature/parse errors already returned 4xx above.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
