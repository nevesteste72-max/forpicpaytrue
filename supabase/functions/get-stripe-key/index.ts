import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

  let publishableKey =
    Deno.env.get("STRIPE_PUBLISHABLE_KEY") ||
    Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY") ||
    "";

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: appSettings } = await supabaseAdmin
      .from("app_settings")
      .select("stripe_publishable_key")
      .eq("id", 1)
      .maybeSingle();
    if (appSettings?.stripe_publishable_key) {
      publishableKey = appSettings.stripe_publishable_key;
    }
  }

  if (!publishableKey || !publishableKey.startsWith("pk_")) {
    return new Response(
      JSON.stringify({ error: "Stripe publishable key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ publishable_key: publishableKey }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
});
