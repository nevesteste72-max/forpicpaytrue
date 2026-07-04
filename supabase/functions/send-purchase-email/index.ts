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
}

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
    } = body;

    if (!customer_email || !product_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing customer_email or product_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const displayName = customer_name || customer_email.split("@")[0];
    const formattedAmount = `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
    const purchaseDate = new Date().toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Maputo" });

    // Build order bump row if applicable
    let orderBumpRow = "";
    if (order_bump_accepted && order_bump_name && order_bump_amount && order_bump_amount > 0) {
      orderBumpRow = `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">+ ${order_bump_name}</td>
          <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px;">${currency} ${order_bump_amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }

    // Build access button if redirect_url exists
    let accessButton = "";
    if (redirect_url) {
      accessButton = `
        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="${redirect_url}" 
             style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Access Your Product
          </a>
        </div>
      `;
    }

    const whatsappButton = "";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background-color: #ecfdf5; border-radius: 50%; padding: 12px; margin-bottom: 16px;">
              <span style="font-size: 32px;">✅</span>
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">Payment Confirmed!</h1>
            <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Thank you, ${displayName} — your payment was successfully received and your order is confirmed.</p>
          </div>

          <!-- Amount Paid -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <div style="font-size: 12px; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 0.05em;">Amount Paid</div>
            <div style="font-size: 28px; font-weight: 700; color: #047857; margin: 8px 0;">${formattedAmount}</div>
            <div style="font-size: 12px; color: #059669;">Confirmed on ${purchaseDate}</div>
          </div>

          <!-- Order Summary -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Order Summary</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 14px; font-weight: 500;">${product_name}</td>
                <td style="padding: 8px 0; text-align: right; color: #374151; font-size: 14px; font-weight: 500;">${formattedAmount}</td>
              </tr>
              ${orderBumpRow}
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 12px 0 0; color: #111827; font-size: 16px; font-weight: 700;">Total Paid</td>
                <td style="padding: 12px 0 0; text-align: right; color: #111827; font-size: 16px; font-weight: 700;">${formattedAmount}</td>
              </tr>
            </table>
          </div>

          <!-- Access Button -->
          ${accessButton}

          <!-- WhatsApp Button -->
          ${whatsappButton}

          <!-- Transaction ID -->
          <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Transaction ID: ${transaction_id}</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 24px;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">Powered by CashPay</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Plain text version to improve deliverability and reduce spam score
    const textContent = [
      `Payment Confirmed!`,
      ``,
      `Hi ${displayName},`,
      `Your payment was successfully received and your order is confirmed.`,
      ``,
      `Amount Paid: ${formattedAmount}`,
      `Confirmed on: ${purchaseDate}`,
      ``,
      `Order Summary:`,
      `${product_name}: ${formattedAmount}`,
      order_bump_accepted && order_bump_name && order_bump_amount ? `+ ${order_bump_name}: ${currency} ${order_bump_amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "",
      ``,
      redirect_url ? `Access your product: ${redirect_url}` : "",
      ``,
      `Transaction ID: ${transaction_id}`,
      ``,
      `— CashPay`,
    ].filter(Boolean).join("\n");

    const emailResponse = await resend.emails.send({
      from: "CashPay <noreply@tecnhogar.store>",
      reply_to: "noreply@tecnhogar.store",
      to: [customer_email],
      subject: `Payment confirmed: ${product_name} - ${formattedAmount}`,
      html,
      text: textContent,
      headers: {
        "X-Entity-Ref-ID": transaction_id,
      },
    });

    // Explicitly check for errors from Resend SDK (it returns { data, error }, not throws)
    if (emailResponse?.error) {
      console.error("Resend email sending error:", emailResponse.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error.message ?? "Unknown Resend error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Purchase email sent to:", customer_email, "response:", JSON.stringify(emailResponse));

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
