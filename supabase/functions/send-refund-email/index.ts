import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { refund_request_id } = await req.json();

    if (!refund_request_id || typeof refund_request_id !== "string") {
      return new Response(JSON.stringify({ error: "refund_request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up the refund request server-side. Only send if it is genuinely approved.
    const { data: refund, error: refundErr } = await supabaseAdmin
      .from("refund_requests")
      .select("id, status, customer_email, customer_name, product_name, amount, currency")
      .eq("id", refund_request_id)
      .maybeSingle();

    if (refundErr || !refund) {
      return new Response(JSON.stringify({ error: "Refund request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (refund.status !== "approved") {
      return new Response(JSON.stringify({ error: "Refund request is not approved" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = refund.customer_email;
    const customerName = refund.customer_name || "Cliente";
    const product = refund.product_name || "Produto";
    const amount = refund.amount;
    const currency = refund.currency || "";

    if (!email) {
      return new Response(JSON.stringify({ error: "Refund request has no recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">✅ Reembolso Confirmado</h2>
        <p>Olá <strong>${customerName}</strong>,</p>
        <p>O seu pedido de reembolso para o produto <strong>${product}</strong> no valor de <strong>${currency} ${Number(amount).toFixed(2)}</strong> foi aprovado com sucesso.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">📋 <strong>Informações importantes:</strong></p>
          <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: #374151;">
            <li>O reembolso foi processado pela nossa parte.</li>
            <li>O seu banco pode levar entre <strong>2 a 45 dias úteis</strong> para devolver o valor à sua conta.</li>
            <li>Se não receber o valor após 45 dias, entre em contacto connosco.</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b7280;">Obrigado pela sua compreensão.</p>
        <p style="font-size: 14px; color: #6b7280;">Equipa PicPay</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PicPay <noreply@tecnhogar.store>",
        to: [email],
        subject: `✅ Reembolso Confirmado — ${product}`,
        html: htmlBody,
      }),
    });

    const result = await res.json();
    console.log("Refund email sent:", result);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error sending refund email:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
