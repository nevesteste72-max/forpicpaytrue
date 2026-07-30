import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FB_GRAPH_URL = "https://graph.facebook.com/v19.0";

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      transaction_id,
      pixel_id,
      access_token,
      event_name = "Purchase",
      value,
      currency,
      customer_email,
      customer_phone,
      event_source_url,
      event_id,
      link_id,
      fbc,
      fbp,
    } = body;

    // Resolve pixel + token. Browser-triggered events (e.g. InitiateCheckout) pass
    // only link_id so the access token never leaves the server; look it up here.
    let resolvedPixel = pixel_id;
    let resolvedToken = access_token;
    if ((!resolvedPixel || !resolvedToken) && link_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: pl } = await supabase
          .from("payment_links")
          .select("facebook_pixel_id, facebook_token")
          .eq("id", link_id)
          .maybeSingle();
        if (pl) {
          resolvedPixel = resolvedPixel || pl.facebook_pixel_id;
          resolvedToken = resolvedToken || pl.facebook_token;
        }
      } catch (e) {
        console.error("[FB-CONVERSION] token lookup failed:", e);
      }
    }

    if (!resolvedPixel || !resolvedToken) {
      console.log("[FB-CONVERSION] No pixel/token, skipping");
      return new Response(
        JSON.stringify({ success: false, reason: "missing_credentials" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FB-CONVERSION] Sending ${event_name} for tx/link: ${transaction_id || link_id}`);

    // Hashed identifiers (em/ph) + raw match keys (fbc/fbp/ip/ua) for strong matching.
    const userData: Record<string, unknown> = {};
    if (customer_email) userData.em = [await sha256(customer_email)];
    if (customer_phone) userData.ph = [await sha256(customer_phone)];
    if (fbc) userData.fbc = fbc;
    if (fbp) userData.fbp = fbp;
    const ua = req.headers.get("user-agent");
    if (ua) userData.client_user_agent = ua;
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    if (ip) userData.client_ip_address = ip;

    const eventPayload: Record<string, unknown> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: event_source_url || "https://www.tecnhogar.store",
      user_data: userData,
      custom_data: {
        value: Number(value),
        currency: currency || "EUR",
        content_type: "product",
        order_id: transaction_id,
      },
    };

    // event_id deduplicates with the browser Pixel event of the same action.
    if (event_id || transaction_id) {
      eventPayload.event_id = event_id || transaction_id;
    }

    const response = await fetch(
      `${FB_GRAPH_URL}/${resolvedPixel}/events?access_token=${resolvedToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [eventPayload] }),
      }
    );

    const result = await response.json();
    console.log(`[FB-CONVERSION] Facebook response:`, JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, facebook_response: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[FB-CONVERSION] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
