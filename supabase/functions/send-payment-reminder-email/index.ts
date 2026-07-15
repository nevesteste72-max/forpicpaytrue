import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentReminderRequest {
  customer_email: string;
  customer_name: string;
  product_name: string;
  product_image_url?: string | null;
  amount: number;
  currency: string;
  transaction_id: string;
  payment_link_id: string;
  lang?: string | null;
  hours_left?: number;
}

type Lang = "pt" | "en" | "es";

const i18n = {
  pt: {
    subject: (p: string) => `Pagamento pendente: ${p}`,
    banner: "Lembrete de Pagamento",
    orderLabel: "Referência do Pedido",
    greeting: (n: string) => `Olá ${n},`,
    body: "Ainda não recebemos o seu pagamento para este pedido.",
    note: "Nota: só confirmamos o seu pedido depois que o pagamento for recebido.",
    payNow: "Pagar Agora",
    timeLeft: (h: number) => `Você tem ${h} horas para concluir o pagamento antes que o pedido seja cancelado.`,
    hopeToHear: "Esperamos ouvir de você em breve.",
    regards: "Equipa OrderConfirm",
    itemInOrder: "Item deste pedido",
    needHelp: "Precisa de ajuda? Responda a este e-mail.",
    footerNote: "Pagamento seguro e encriptado.",
    locale: "pt-PT",
  },
  en: {
    subject: (p: string) => `Payment pending: ${p}`,
    banner: "Payment Reminder",
    orderLabel: "Order Reference",
    greeting: (n: string) => `Hi ${n},`,
    body: "It seems we haven't received your payment for this order yet.",
    note: "Please note: your order is only confirmed once payment is received.",
    payNow: "Pay Now",
    timeLeft: (h: number) => `You have ${h} hours left to complete payment before your order is cancelled.`,
    hopeToHear: "We hope to hear from you soon.",
    regards: "The OrderConfirm Team",
    itemInOrder: "Item in this order",
    needHelp: "Need help? Reply to this email.",
    footerNote: "Your payment is secure and encrypted.",
    locale: "en-US",
  },
  es: {
    subject: (p: string) => `Pago pendiente: ${p}`,
    banner: "Recordatorio de Pago",
    orderLabel: "Referencia del Pedido",
    greeting: (n: string) => `Hola ${n},`,
    body: "Todavía no hemos recibido su pago para este pedido.",
    note: "Nota: su pedido solo se confirma después de recibir el pago.",
    payNow: "Pagar Ahora",
    timeLeft: (h: number) => `Tiene ${h} horas para completar el pago antes de que se cancele el pedido.`,
    hopeToHear: "Esperamos saber de usted pronto.",
    regards: "Equipo OrderConfirm",
    itemInOrder: "Artículo de este pedido",
    needHelp: "¿Necesita ayuda? Responda a este correo.",
    footerNote: "Su pago es seguro y encriptado.",
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
    const body: PaymentReminderRequest = await req.json();

    const {
      customer_email,
      customer_name,
      product_name,
      product_image_url,
      amount,
      currency,
      transaction_id,
      payment_link_id,
      lang: langInput,
      hours_left,
    } = body;

    if (!customer_email || !product_name || !payment_link_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing customer_email, product_name or payment_link_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang: Lang = langInput && (langInput === "en" || langInput === "es" || langInput === "pt") ? langInput : "pt";
    const t = i18n[lang];
    const hours = hours_left && hours_left > 0 ? hours_left : 24;

    const displayName = customer_name || customer_email.split("@")[0];
    const formattedAmount = `${currency} ${amount.toLocaleString(t.locale, { minimumFractionDigits: 2 })}`;

    const origin = req.headers.get("origin") || "https://www.tecnhogar.store";
    const payUrl = `${origin}/pay/${payment_link_id}`;

    const productImageRow = product_image_url
      ? `
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="${product_image_url}" alt="${product_name}" style="max-width: 120px; max-height: 120px; border-radius: 8px; object-fit: cover;" />
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
        <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <div style="background-color: #0f1729; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 20px; font-weight: 800; color: #ffffff;">OrderConfirm</span>
            <span style="font-size: 13px; font-weight: 600; color: #cbd5e1;">${t.banner}</span>
          </div>

          <div style="padding: 32px;">
            <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280;">${t.orderLabel}</p>
            <p style="margin: 0 0 20px; font-size: 14px; font-weight: 700; color: #111827;">${transaction_id}</p>

            <p style="margin: 0 0 16px; font-size: 15px; color: #111827;">${t.greeting(displayName)}</p>
            <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">${t.body}</p>
            <p style="margin: 0 0 24px; font-size: 14px; color: #374151;"><strong>${t.note}</strong></p>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${payUrl}"
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                ${t.payNow}
              </a>
            </div>

            <p style="margin: 0 0 24px; font-size: 13px; color: #6b7280;">${t.timeLeft(hours)}</p>

            <p style="margin: 0; font-size: 14px; color: #374151;">${t.hopeToHear}</p>
            <p style="margin: 4px 0 24px; font-size: 14px; color: #374151;">${t.regards}</p>

            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">${t.itemInOrder}</p>
              ${productImageRow}
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 600; color: #111827;">${product_name}</span>
                <span style="font-size: 14px; font-weight: 700; color: #111827;">${formattedAmount}</span>
              </div>
            </div>

            <div style="text-align: center; margin: 24px 0 0;">
              <a href="${payUrl}"
                 style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                ${t.payNow}
              </a>
            </div>
          </div>

          <div style="background-color: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">${t.needHelp}</p>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">${t.footerNote}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = [
      t.banner,
      ``,
      `${t.orderLabel}: ${transaction_id}`,
      ``,
      t.greeting(displayName),
      t.body,
      t.note,
      ``,
      `${t.payNow}: ${payUrl}`,
      ``,
      t.timeLeft(hours),
      ``,
      t.hopeToHear,
      t.regards,
      ``,
      `${t.itemInOrder}: ${product_name} - ${formattedAmount}`,
    ].join("\n");

    const emailResponse = await resend.emails.send({
      from: "OrderConfirm <noreply@tecnhogar.store>",
      reply_to: "noreply@tecnhogar.store",
      to: [customer_email],
      subject: t.subject(product_name),
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

    console.log("Payment reminder email sent to:", customer_email, "id:", emailResponse.data?.id, "lang:", lang);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending payment reminder email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
