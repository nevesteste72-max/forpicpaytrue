import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Lazy singleton: Stripe.js + the publishable key are only fetched the first
// time a caller needs to run something client-side (e.g. a 3DS challenge via
// stripe.handleNextAction). Reused by every subsequent call.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-key`, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.publishable_key) throw new Error("No Stripe publishable key configured");
        return loadStripe(data.publishable_key);
      })
      .catch((err) => {
        console.error("Failed to load Stripe.js:", err);
        stripePromise = null; // allow a retry on the next call instead of caching the failure
        return null;
      });
  }
  return stripePromise;
}
