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
  let mode = "live";

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: appSettings } = await supabaseAdmin
      .from("app_settings")
      .select("stripe_publishable_key, stripe_publishable_key_test, stripe_mode")
      .eq("id", 1)
      .maybeSingle();

    mode = (appSettings?.stripe_mode || "live").toLowerCase();

    if (mode === "test") {
      // Em modo de teste NUNCA devolver a chave real: o checkout passaria a
      // cobrar a serio a pensar que estava a testar.
      const testPk = appSettings?.stripe_publishable_key_test || "";
      if (!testPk) {
        return new Response(
          JSON.stringify({ error: "Modo de teste ativo mas nao ha chave publicavel de teste configurada" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      publishableKey = testPk;
    } else {
      // Modo live: a variavel de ambiente (quando e live) continua a ter
      // prioridade e a sincronizar app_settings, como antes.
      const envPk = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
      const envSk = Deno.env.get("STRIPE_SECRET_KEY");

      if (envPk && envPk.startsWith("pk_live_")) {
        await supabaseAdmin.from("app_settings").upsert({
          id: 1,
          stripe_publishable_key: envPk,
          stripe_secret_key: envSk || undefined,
          updated_at: new Date().toISOString(),
        });
        publishableKey = envPk;
      } else if (appSettings?.stripe_publishable_key) {
        publishableKey = appSettings.stripe_publishable_key;
      } else if (appSettings?.stripe_publishable_key_test) {
        // So ha chaves de teste configuradas: usa-as, nao ha dinheiro em risco.
        publishableKey = appSettings.stripe_publishable_key_test;
        mode = "test";
      }
    }
  }

  if (!publishableKey || !publishableKey.startsWith("pk_")) {
    return new Response(
      JSON.stringify({ error: "Stripe publishable key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ publishable_key: publishableKey, mode }),
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
