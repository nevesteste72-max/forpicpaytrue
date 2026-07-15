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
    } = body;

    if (!pixel_id || !access_token) {
      console.log("[FB-CONVERSION] No pixel_id or access_token, skipping");
      return new Response(
        JSON.stringify({ success: false, reason: "missing_credentials" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FB-CONVERSION] Sending ${event_name} event for tx: ${transaction_id}`);

    // Hash user data for Facebook
    const userData: Record<string, string> = {};
    if (customer_email) userData.em = [await sha256(customer_email)];
    if (customer_phone) userData.ph = [await sha256(customer_phone)];

    const eventPayload: Record<string, unknown> = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: event_source_url || "https://forpicpaytrue.vercel.app",
      user_data: userData,
      custom_data: {
        value: Number(value),
        currency: currency || "MZN",
        content_type: "product",
        order_id: transaction_id,
      },
    };

    // Add event_id for deduplication with browser Pixel
    if (event_id || transaction_id) {
      eventPayload.event_id = event_id || transaction_id;
    }

    const eventData = {
      data: [eventPayload],
    };

    const response = await fetch(
      `${FB_GRAPH_URL}/${pixel_id}/events?access_token=${access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
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
