import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mask(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
}

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

    // Require a real logged-in admin user — never let this run with just the anon key.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || (req.method === "POST" ? "update" : "get");

    if (action === "update") {
      const { stripe_publishable_key, stripe_secret_key } = body;

      if (stripe_publishable_key !== undefined && stripe_publishable_key !== "" && !stripe_publishable_key.startsWith("pk_")) {
        return new Response(JSON.stringify({ error: "Chave publicável inválida (deve começar com pk_)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (stripe_secret_key !== undefined && stripe_secret_key !== "" && !stripe_secret_key.startsWith("sk_")) {
        return new Response(JSON.stringify({ error: "Chave secreta inválida (deve começar com sk_)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
      if (stripe_publishable_key !== undefined && stripe_publishable_key !== "") {
        updateData.stripe_publishable_key = stripe_publishable_key.trim();
      }
      if (stripe_secret_key !== undefined && stripe_secret_key !== "") {
        updateData.stripe_secret_key = stripe_secret_key.trim();
      }

      const { error: upsertError } = await supabaseAdmin
        .from("app_settings")
        .upsert(updateData, { onConflict: "id" });

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("stripe_publishable_key, stripe_secret_key, updated_at")
      .eq("id", 1)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        stripe_publishable_key_masked: mask(settings?.stripe_publishable_key ?? null),
        stripe_publishable_key_set: !!settings?.stripe_publishable_key,
        stripe_secret_key_masked: mask(settings?.stripe_secret_key ?? null),
        stripe_secret_key_set: !!settings?.stripe_secret_key,
        updated_at: settings?.updated_at ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
