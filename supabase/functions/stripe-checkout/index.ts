import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckoutRequest {
  amount: number;
  product_name: string;
  product_description?: string;
  customer_email: string;
  payment_link_id: string;
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const body: CheckoutRequest = await req.json();
    const { amount, product_name, product_description, customer_email, payment_link_id, success_url, cancel_url } = body;

    // Validate required fields
    if (!amount || !product_name || !customer_email || !payment_link_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: amount, product_name, customer_email, payment_link_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be at least 1 MZN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://www.tecnhogar.store";
    const finalSuccessUrl = success_url || `${origin}/pay/${payment_link_id}?payment=success`;
    const finalCancelUrl = cancel_url || `${origin}/pay/${payment_link_id}?payment=cancelled`;

    // Determine currency from request (default mzn for backwards compat)
    const requestCurrency = (body as any).currency?.toLowerCase() || "mzn";
    
    // Convert to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Create checkout session with dynamic price
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customer_email,
      line_items: [
        {
          price_data: {
            currency: requestCurrency,
            product_data: {
              name: product_name,
              description: product_description || undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        payment_link_id: payment_link_id,
      },
    });

    console.log("Stripe checkout session created:", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({
        success: true,
        url: session.url,
        session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
