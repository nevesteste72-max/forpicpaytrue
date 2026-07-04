import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, product, amount, currency } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerName = name || "Cliente";

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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
