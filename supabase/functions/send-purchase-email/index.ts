import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PurchaseEmailRequest {
  customer_email: string;
  customer_name: string;
  product_name: string;
  amount: number;
  currency: string;
  transaction_id: string;
  redirect_url?: string | null;
  order_bump_accepted?: boolean;
  order_bump_name?: string | null;
  order_bump_amount?: number;
  product_type?: string | null;
  lang?: string | null;
}

type Lang = "pt" | "en" | "es";

const i18n = {
  pt: {
    subjectDigital: (p: string, a: string) => `Pagamento confirmado: ${p} - ${a}`,
    subjectPhysical: (p: string, a: string) => `Pedido confirmado: ${p} - ${a}`,
    heading: "Pagamento Confirmado!",
    thanksDigital: (n: string) => `Obrigado, ${n} — o seu pagamento foi recebido com sucesso e o seu pedido está confirmado.`,
    thanksPhysical: (n: string) => `Obrigado, ${n} — o seu pagamento foi recebido com sucesso e o seu pedido será enviado em breve.`,
    amountPaid: "Valor Pago",
    confirmedOn: (d: string) => `Confirmado em ${d}`,
    orderSummary: "Resumo do Pedido",
    totalPaid: "Total Pago",
    physicalNotice: "📦 O seu pedido está confirmado e a ser preparado para envio. Vamos mantê-lo informado sobre o progresso.",
    accessProduct: "Aceder ao Produto",
    trackOrder: "Rastrear Pedido",
    txId: (id: string) => `ID da Transação: ${id}`,
    footer: "Powered by PicPay",
    textConfirmed: "Pagamento Confirmado!",
    textHi: (n: string) => `Olá ${n},`,
    textAmount: "Valor Pago",
    textConfirmedOn: "Confirmado em",
    textSummary: "Resumo do Pedido:",
    textShipping: "O seu pedido está a ser preparado para envio. Vamos mantê-lo informado.",
    textAccess: (u: string) => `Aceda ao seu produto: ${u}`,
    textTrack: (u: string) => `Rastreie o seu pedido: ${u}`,
    textTx: "ID da Transação",
    locale: "pt-PT",
  },
  en: {
    subjectDigital: (p: string, a: string) => `Payment confirmed: ${p} - ${a}`,
    subjectPhysical: (p: string, a: string) => `Order confirmed: ${p} - ${a}`,
    heading: "Payment Confirmed!",
    thanksDigital: (n: string) => `Thank you, ${n} — your payment was successfully received and your order is confirmed.`,
    thanksPhysical: (n: string) => `Thank you, ${n} — your payment was successfully received and your order will be shipped soon.`,
    amountPaid: "Amount Paid",
    confirmedOn: (d: string) => `Confirmed on ${d}`,
    orderSummary: "Order Summary",
    totalPaid: "Total Paid",
    physicalNotice: "📦 Your order is confirmed and is now being prepared for shipping. We'll keep you updated on its progress.",
    accessProduct: "Access Your Product",
    trackOrder: "Track Your Order",
    txId: (id: string) => `Transaction ID: ${id}`,
    footer: "Powered by PicPay",
    textConfirmed: "Payment Confirmed!",
    textHi: (n: string) => `Hi ${n},`,
    textAmount: "Amount Paid",
    textConfirmedOn: "Confirmed on",
    textSummary: "Order Summary:",
    textShipping: "Your order is being prepared for shipping. We'll keep you updated.",
    textAccess: (u: string) => `Access your product: ${u}`,
    textTrack: (u: string) => `Track your order: ${u}`,
    textTx: "Transaction ID",
    locale: "en-US",
  },
  es: {
    subjectDigital: (p: string, a: string) => `Pago confirmado: ${p} - ${a}`,
    subjectPhysical: (p: string, a: string) => `Pedido confirmado: ${p} - ${a}`,
    heading: "¡Pago Confirmado!",
    thanksDigital: (n: string) => `Gracias, ${n} — su pago fue recibido con éxito y su pedido está confirmado.`,
    thanksPhysical: (n: string) => `Gracias, ${n} — su pago fue recibido con éxito y su pedido será enviado pronto.`,
    amountPaid: "Monto Pagado",
    confirmedOn: (d: string) => `Confirmado el ${d}`,
    orderSummary: "Resumen del Pedido",
    totalPaid: "Total Pagado",
    physicalNotice: "📦 Su pedido está confirmado y se está preparando para el envío. Le mantendremos informado del progreso.",
    accessProduct: "Acceder al Producto",
    trackOrder: "Rastrear Pedido",
    txId: (id: string) => `ID de Transacción: ${id}`,
    footer: "Powered by PicPay",
    textConfirmed: "¡Pago Confirmado!",
    textHi: (n: string) => `Hola ${n},`,
    textAmount: "Monto Pagado",
    textConfirmedOn: "Confirmado el",
    textSummary: "Resumen del Pedido:",
    textShipping: "Su pedido se está preparando para el envío. Le mantendremos informado.",
    textAccess: (u: string) => `Acceda a su producto: ${u}`,
    textTrack: (u: string) => `Rastree su pedido: ${u}`,
    textTx: "ID de Transacción",
    locale: "es-ES",
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const resend = new Resend(RESEND_API_KEY);
    const body: PurchaseEmailRequest = await req.json();

    const {
      customer_email,
      customer_name,
      product_name,
      amount,
      currency,
      transaction_id,
      redirect_url,
      order_bump_accepted,
      order_bump_name,
      order_bump_amount,
      product_type,
      lang: langInput,
    } = body;

    if (!customer_email || !product_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing customer_email or product_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang: Lang = langInput && (langInput === "en" || langInput === "es" || langInput === "pt") ? langInput : "pt";
    const t = i18n[lang];

    const isPhysical = product_type === "physical";
    const displayName = customer_name || customer_email.split("@")[0];
    const formattedAmount = `${currency} ${amount.toLocaleString(t.locale, { minimumFractionDigits: 2 })}`;
    const purchaseDate = new Date().toLocaleString(t.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Maputo",
    });

    let orderBumpRow = "";
    if (order_bump_accepted && order_bump_name && order_bump_amount && order_bump_amount > 0) {
      orderBumpRow = `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">+ ${order_bump_name}</td>
          <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px;">${currency} ${order_bump_amount.toLocaleString(t.locale, { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }

    let accessButton = "";
    if (isPhysical) {
      accessButton = `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin: 24px 0 16px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #1e40af;">${t.physicalNotice}</p>
        </div>
      `;
    } else if (redirect_url) {
      accessButton = `
        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="${redirect_url}"
             style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${t.accessProduct}
          </a>
        </div>
      `;
    }

    const origin = req.headers.get("origin") || "https://forpicpaytrue.lovable.app";
    const trackingParams = new URLSearchParams({
      product: product_name,
      amount: amount.toLocaleString(t.locale, { minimumFractionDigits: 2 }),
      currency,
      date: purchaseDate,
      product_type: isPhysical ? "physical" : "digital",
      lang,
    });
    if (!isPhysical && redirect_url) trackingParams.set("access", redirect_url);
    const trackingUrl = `${origin}/rastreio/${transaction_id}?${trackingParams.toString()}`;
    const trackButton = isPhysical
      ? `
      <div style="text-align: center; margin-bottom: 8px;">
        <a href="${trackingUrl}"
           style="display: inline-block; background-color: #ffffff; color: #2563eb; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; border: 1px solid #2563eb;">
          ${t.trackOrder}
        </a>
      </div>
    `
      : "";

    const html = `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #ecfdf5; border-radius: 50%; padding: 12px; margin-bottom: 16px;">
              <span style="font-size: 32px;">✅</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">${t.heading}</h1>
            <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">${isPhysical ? t.thanksPhysical(displayName) : t.thanksDigital(displayName)}</p>
          </div>

          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 0.05em;">${t.amountPaid}</p>
            <p style="margin: 0; font-size: 28px; font-weight: 800; color: #047857;">${formattedAmount}</p>
            <p style="margin: 8px 0 0; font-size: 12px; color: #059669;">${t.confirmedOn(purchaseDate)}</p>
          </div>

          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">${t.orderSummary}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px; font-weight: 500;">${product_name}</td>
                <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px; font-weight: 500;">${formattedAmount}</td>
              </tr>
              ${orderBumpRow}
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 12px 0 0; color: #111827; font-size: 16px; font-weight: 700;">${t.totalPaid}</td>
                <td style="padding: 12px 0 0; text-align: right; color: #111827; font-size: 16px; font-weight: 700;">${formattedAmount}</td>
              </tr>
            </table>
          </div>

          ${accessButton}
          ${trackButton}

          <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">${t.txId(transaction_id)}</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">${t.footer}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = [
      t.textConfirmed,
      ``,
      t.textHi(displayName),
      isPhysical ? t.thanksPhysical(displayName) : t.thanksDigital(displayName),
      ``,
      `${t.textAmount}: ${formattedAmount}`,
      `${t.textConfirmedOn}: ${purchaseDate}`,
      ``,
      t.textSummary,
      `${product_name}: ${formattedAmount}`,
      order_bump_accepted && order_bump_name && order_bump_amount ? `+ ${order_bump_name}: ${currency} ${order_bump_amount.toLocaleString(t.locale, { minimumFractionDigits: 2 })}` : "",
      ``,
      isPhysical ? t.textShipping : (redirect_url ? t.textAccess(redirect_url) : ""),
      isPhysical ? t.textTrack(trackingUrl) : "",
      ``,
      `${t.textTx}: ${transaction_id}`,
      ``,
      `— PicPay`,
    ].filter(Boolean).join("\n");

    const subject = isPhysical
      ? t.subjectPhysical(product_name, formattedAmount)
      : t.subjectDigital(product_name, formattedAmount);

    const emailResponse = await resend.emails.send({
      from: "PicPay <noreply@tecnhogar.store>",
      reply_to: "noreply@tecnhogar.store",
      to: [customer_email],
      subject,
      html,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": transaction_id,
      },
    });

    if (emailResponse.error) {
      console.error("Resend API returned an error:", JSON.stringify(emailResponse.error), "for:", customer_email);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error.message || "Resend API error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Purchase email sent to:", customer_email, "id:", emailResponse.data?.id, "lang:", lang);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending purchase email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
