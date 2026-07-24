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
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    // Use the currency defined on the product (payment_link). Fallback to client-provided, then ZAR.
    const DEFAULT_STRIPE_CURRENCY = "zar";
    const SUPPORTED_STRIPE_CURRENCIES = new Set([
      "usd","eur","gbp","zar","brl","mzn","aud","cad","chf","jpy","cny","inr","mxn","ngn","kes","ghs","aed","sek","nok","dkk","pln","czk","huf","ron","try","sgd","hkd","nzd","krw","thb","myr","idr","php","vnd","ils","sar","qar","ars","clp","cop","pen","uyu","twd","bgn","hrk","rsd","isk","egp","tnd","mad","xof","xaf"
    ]);
    function normalizeStripeCurrency(rawCurrency: string | null | undefined): string {
      const c = (rawCurrency || "").toLowerCase().trim();
      if (c && SUPPORTED_STRIPE_CURRENCIES.has(c)) return c;
      if (c) console.warn(`Unsupported currency "${rawCurrency}", falling back to "${DEFAULT_STRIPE_CURRENCY}"`);
      return DEFAULT_STRIPE_CURRENCY;
    }

    const body = await req.json();

    // ── UPDATE existing PaymentIntent (order bump toggled) ──
    if (body.update_intent && body.payment_intent_id && body.transaction_id) {
      const { payment_intent_id, transaction_id, payment_link_id, order_bump_accepted } = body;

      // Fetch authoritative prices from database
      const { data: linkData, error: linkErr } = await supabaseAdmin
        .from("payment_links")
        .select("amount, currency, order_bump_price, order_bump_2_price, order_bump_3_price")
        .eq("id", payment_link_id)
        .single();

      if (linkErr || !linkData) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment link not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Support multiple bumps: bumps_accepted is array [bool, bool, bool]
      const bumpsAccepted: boolean[] = Array.isArray(body.bumps_accepted) ? body.bumps_accepted : [order_bump_accepted || false, false, false];
      const bumpPrices = [linkData.order_bump_price, linkData.order_bump_2_price, linkData.order_bump_3_price];
      let bumpAmount = 0;
      bumpPrices.forEach((price, i) => {
        if (bumpsAccepted[i] && price && Number(price) > 0) bumpAmount += Number(price);
      });

      const serverTotal = Number(linkData.amount) + bumpAmount;
      const chargeCurrency = normalizeStripeCurrency(linkData.currency);
      const stripeAmount = Math.round(serverTotal * 100);

      console.log("Updating PaymentIntent:", payment_intent_id, "amount:", serverTotal, "currency:", chargeCurrency);

      // Update Stripe PaymentIntent amount (in settlement currency)
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
        .select("amount, currency, order_bump_price, order_bump_2_price, order_bump_3_price")
      .eq("id", payment_link_id)
      .single();

    if (linkErr || !linkData) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment link not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bumpsAccepted: boolean[] = Array.isArray(body.bumps_accepted) ? body.bumps_accepted : [order_bump_accepted || false, false, false];
    const bumpPrices = [linkData.order_bump_price, linkData.order_bump_2_price, linkData.order_bump_3_price];
    let bumpAmount = 0;
    bumpPrices.forEach((price, i) => {
      if (bumpsAccepted[i] && price && Number(price) > 0) bumpAmount += Number(price);
    });

    const totalAmount = Number(linkData.amount) + bumpAmount;
    const chargeCurrency = normalizeStripeCurrency(linkData.currency || currency);
    const stripeAmount = Math.round(totalAmount * 100);
    console.log("Creating PaymentIntent:", totalAmount, chargeCurrency);

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
        currency: chargeCurrency.toUpperCase(),
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
    // mbway + multibanco enabled for Portugal (EUR). They require the method to be
    // activated in the Stripe Dashboard and the PaymentIntent currency to be "eur".
    const VALID_STRIPE_METHODS = new Set(["card", "link", "mbway", "multibanco", "pix", "bizum"]);
    // Methods that can be saved for the one-click upsell (setup_future_usage=off_session).
    // MB Way / Multibanco are not reusable off_session, so they must be excluded from it.
    const REUSABLE_METHODS = new Set(["card", "link"]);
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

    // Create PaymentIntent. setup_future_usage powers the one-click upsell, but only
    // card/link support it — applying it globally when mbway/multibanco are present
    // makes Stripe reject the PaymentIntent, so we scope it per method type instead.
    const piParams: Record<string, unknown> = {
      amount: stripeAmount,
      currency: chargeCurrency,
      payment_method_types: allowedMethods,
      metadata: {
        transaction_id: tx.id,
        payment_link_id,
        customer_email,
        customer_name: customer_name || "",
      },
      // receipt_email removed to prevent Stripe from sending automatic receipts
      description: `Payment for ${payment_link_id}`,
    };

    const hasNonReusableMethod = allowedMethods.some((m) => !REUSABLE_METHODS.has(m));
    if (!hasNonReusableMethod) {
      // Only reusable methods -> enable one-click upsell for the whole intent.
      piParams.setup_future_usage = "off_session";
    } else if (allowedMethods.includes("card")) {
      // Mixed methods -> keep one-click upsell on card only; leave the async
      // methods (mbway/multibanco) untouched so Stripe doesn't reject the intent.
      piParams.payment_method_options = { card: { setup_future_usage: "off_session" } };
    }

    if (stripeCustomerId) {
      piParams.customer = stripeCustomerId;
    }

    // Create the PaymentIntent. If Stripe rejects the requested methods (e.g. mbway/
    // multibanco not yet activated on the account, or currency not eligible), fall back
    // to card-only so the checkout still loads instead of failing with a 500.
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(piParams as Stripe.PaymentIntentCreateParams);
    } catch (piErr) {
      console.error("PaymentIntent create failed for methods", allowedMethods, "-", piErr instanceof Error ? piErr.message : piErr);
      const fallbackParams: Record<string, unknown> = {
        ...piParams,
        payment_method_types: ["card"],
        setup_future_usage: "off_session",
      };
      delete fallbackParams.payment_method_options;
      paymentIntent = await stripe.paymentIntents.create(fallbackParams as Stripe.PaymentIntentCreateParams);
      console.log("PaymentIntent created with card-only fallback:", paymentIntent.id);
    }

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
