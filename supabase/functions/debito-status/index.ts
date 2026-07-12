import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEBITO_API_URL = "https://my.debito.co.mz/api/v1";

/**
 * Fires UTMify notification in the background (non-blocking).
 */
async function notifyUtmify(
  supabaseUrl: string,
  serviceRoleKey: string,
  txData: {
    transaction_id: string;
    product_name: string;
    product_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    amount: number;
    currency: string;
    order_bump_accepted: boolean;
    order_bump_amount: number;
    payment_method: string;
    status: string;
    created_at: string;
    tracking_params?: Record<string, string | null>;
  }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/utmify-notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...txData,
        approved_at: new Date().toISOString(),
      }),
    });
    console.log("UTMify notification sent for tx:", txData.transaction_id);
  } catch (err) {
    console.error("Failed to notify UTMify:", err);
  }
}

/**
 * Fires purchase confirmation email via Resend (non-blocking).
 */
async function sendPurchaseEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  data: {
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
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-purchase-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    console.log("Purchase email sent for tx:", data.transaction_id);
  } catch (err) {
    console.error("Failed to send purchase email:", err);
  }
}

/**
 * Fires Facebook Conversions API in the background (non-blocking).
 */
async function notifyFacebook(
  supabaseUrl: string,
  serviceRoleKey: string,
  data: {
    transaction_id: string;
    pixel_id: string;
    access_token: string;
    value: number;
    currency: string;
    customer_email: string;
    customer_phone: string;
  }
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/facebook-conversion`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    console.log("Facebook conversion sent for tx:", data.transaction_id);
  } catch (err) {
    console.error("Failed to notify Facebook:", err);
  }
}

  /**
   * Sends automatic WhatsApp message based on transaction event.
   */
  async function sendAutoWhatsApp(
    supabaseAdmin: ReturnType<typeof createClient>,
    txData: { customer_phone: string; customer_name: string; amount: number; currency: string; product_name: string },
    eventType: "approved" | "pending" | "failed"
  ) {
    try {
      const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
      const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !txData.customer_phone) return;

      const { data: instances } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("id, instance_name, user_id, msg_template_approved, msg_template_pending, msg_template_failed, auto_recovery_enabled, auto_delivery_enabled")
        .eq("status", "connected")
        .limit(10);

      if (!instances || instances.length === 0) return;

      const templateField = eventType === "approved" ? "msg_template_approved" : eventType === "failed" ? "msg_template_failed" : "msg_template_pending";

      for (const inst of instances) {
        if (eventType === "approved" && !inst.auto_delivery_enabled) continue;
        if ((eventType === "pending" || eventType === "failed") && !inst.auto_recovery_enabled) continue;

        const template = (inst as Record<string, unknown>)[templateField] as string;
        if (!template) continue;

        const message = template
          .replace(/\{name\}/g, txData.customer_name || "Cliente")
          .replace(/\{amount\}/g, txData.amount.toFixed(2))
          .replace(/\{currency\}/g, txData.currency)
          .replace(/\{product\}/g, txData.product_name);

        let normalizedPhone = txData.customer_phone.replace(/[\s\-\+\(\)]/g, "");
        if (normalizedPhone.startsWith("8") && normalizedPhone.length === 9) {
          normalizedPhone = "258" + normalizedPhone;
        }
        if (normalizedPhone.startsWith("0") && normalizedPhone.length === 10) {
          normalizedPhone = "27" + normalizedPhone.substring(1);
        }

        const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
        console.log(`Auto WhatsApp [${eventType}] to ${normalizedPhone} via ${inst.instance_name}`);

        const sendRes = await fetch(`${baseUrl}/message/sendText/${inst.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({ number: normalizedPhone, text: message }),
        });
        const sendData = await sendRes.json();
        console.log(`Auto WhatsApp send result: ${JSON.stringify(sendData).substring(0, 200)}`);

        await supabaseAdmin.from("whatsapp_messages").insert({
          instance_id: inst.id,
          user_id: inst.user_id,
          remote_jid: `${normalizedPhone}@s.whatsapp.net`,
          sender: "bot",
          message: message,
        });

        break;
      }
    } catch (err) {
      console.error("Auto WhatsApp error:", err);
    }
  }

  serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEBITO_API_TOKEN = Deno.env.get("DEBITO_API_TOKEN");
    if (!DEBITO_API_TOKEN) throw new Error("DEBITO_API_TOKEN is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const debito_reference = url.searchParams.get("reference");
    const transaction_id = url.searchParams.get("transaction_id");
    const trackingParamsRaw = url.searchParams.get("tracking_params");
    let tracking_params: Record<string, string | null> | undefined;
    try {
      if (trackingParamsRaw) tracking_params = JSON.parse(trackingParamsRaw);
    } catch { /* ignore */ }

    if (!debito_reference) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing reference parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking status for reference: ${debito_reference}`);

    const response = await fetch(
      `${DEBITO_API_URL}/transactions/${debito_reference}/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${DEBITO_API_TOKEN}`,
          Accept: "application/json",
        },
      }
    );

    let data;
    const responseText = await response.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Debito status returned non-JSON:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: "Invalid response from Débito" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.error("Debito API status error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || "Failed to get transaction status",
          details: data,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transaction status from Débito:", JSON.stringify(data));

    // Map Débito status to our internal status
    const debitoStatus = (data.status || "").toUpperCase();
    let internalStatus = "pending";
    if (debitoStatus === "SUCCESSFUL" || debitoStatus === "COMPLETED" || debitoStatus === "SUCCESS") {
      internalStatus = "successful";
    } else if (debitoStatus === "FAILED" || debitoStatus === "CANCELLED" || debitoStatus === "REJECTED") {
      internalStatus = "failed";
    }

    // Update transaction in DB if we have a transaction_id and status changed
    if (transaction_id && internalStatus !== "pending") {
      // Bind the update to the exact debito_reference we just verified so a caller
      // can't apply a real reference's status to an unrelated transaction_id.
      const { error: updateErr } = await supabaseAdmin
        .from("transactions")
        .update({ status: internalStatus })
        .eq("id", transaction_id)
        .eq("debito_reference", debito_reference)
        .eq("status", "pending");


      if (updateErr) {
        console.error("Failed to update transaction:", updateErr);
      } else {
        console.log(`Transaction ${transaction_id} updated to ${internalStatus}`);

        // If payment succeeded, notify UTMify
        if (internalStatus === "successful" && transaction_id) {
          const { data: txRow } = await supabaseAdmin
            .from("transactions")
            .select("*, payment_links(product_name, id, facebook_pixel_id, facebook_token, redirect_url, order_bump_name, order_bump_price, order_bump_2_name, order_bump_2_price, order_bump_3_name, order_bump_3_price, product_type, checkout_language)")
            .eq("id", transaction_id)
            .single();

          if (txRow) {
            // Build order bumps array for UTMify products[]
            const pl = txRow.payment_links;
            const orderBumps: { id: string; name: string; price: number }[] = [];
            if (pl?.order_bump_name && pl?.order_bump_price) {
              orderBumps.push({ id: `bump-1-${txRow.payment_link_id}`, name: pl.order_bump_name, price: Number(pl.order_bump_price) });
            }
            if (pl?.order_bump_2_name && pl?.order_bump_2_price) {
              orderBumps.push({ id: `bump-2-${txRow.payment_link_id}`, name: pl.order_bump_2_name, price: Number(pl.order_bump_2_price) });
            }
            if (pl?.order_bump_3_name && pl?.order_bump_3_price) {
              orderBumps.push({ id: `bump-3-${txRow.payment_link_id}`, name: pl.order_bump_3_name, price: Number(pl.order_bump_3_price) });
            }

            await notifyUtmify(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              transaction_id: txRow.id,
              product_name: txRow.payment_links?.product_name || "Product",
              product_id: txRow.payment_link_id,
              customer_name: txRow.customer_email?.split("@")[0] || "",
              customer_email: txRow.customer_email,
              customer_phone: txRow.customer_phone || "",
              amount: Number(txRow.amount),
              currency: txRow.currency || "MZN",
              order_bump_accepted: txRow.order_bump_accepted || false,
              order_bump_amount: Number(txRow.order_bump_amount || 0),
              payment_method: "debito",
              status: "successful",
              created_at: txRow.created_at,
              tracking_params: tracking_params || undefined,
              order_bumps: txRow.order_bump_accepted ? orderBumps : undefined,
            });

            // Fire Facebook Conversions API if configured
            const pixelId = txRow.payment_links?.facebook_pixel_id;
            const fbToken = txRow.payment_links?.facebook_token;
            if (pixelId && fbToken) {
              const totalAmount = Number(txRow.amount) + (txRow.order_bump_accepted ? Number(txRow.order_bump_amount || 0) : 0);
              await notifyFacebook(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                transaction_id: txRow.id,
                pixel_id: pixelId,
                access_token: fbToken,
                value: totalAmount,
                currency: txRow.currency || "MZN",
                customer_email: txRow.customer_email,
                customer_phone: txRow.customer_phone || "",
              });
            }

            // Fire purchase confirmation email
            await sendPurchaseEmail(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              customer_email: txRow.customer_email,
              customer_name: txRow.customer_name || "",
              product_name: txRow.payment_links?.product_name || "Product",
              amount: Number(txRow.amount),
              currency: txRow.currency || "MZN",
              transaction_id: txRow.id,
              redirect_url: txRow.payment_links?.redirect_url || null,
              order_bump_accepted: txRow.order_bump_accepted || false,
              order_bump_name: txRow.payment_links?.order_bump_name || null,
              order_bump_amount: Number(txRow.order_bump_amount || 0),
              product_type: txRow.payment_links?.product_type || "digital",
              lang: txRow.payment_links?.checkout_language || "pt",
            });

            // Auto WhatsApp for approved payment
            await sendAutoWhatsApp(supabaseAdmin, {
              customer_phone: txRow.customer_phone || "",
              customer_name: txRow.customer_name || "Cliente",
              amount: Number(txRow.amount),
              currency: txRow.currency || "MZN",
              product_name: txRow.payment_links?.product_name || "Product",
            }, "approved");
          }
        }

        // If payment failed, send auto WhatsApp for failed
        if (internalStatus === "failed" && transaction_id) {
          const { data: failedTx } = await supabaseAdmin
            .from("transactions")
            .select("*, payment_links(product_name)")
            .eq("id", transaction_id)
            .single();

          if (failedTx) {
            await sendAutoWhatsApp(supabaseAdmin, {
              customer_phone: failedTx.customer_phone || "",
              customer_name: failedTx.customer_name || "Cliente",
              amount: Number(failedTx.amount),
              currency: failedTx.currency || "MZN",
              product_name: failedTx.payment_links?.product_name || "Product",
            }, "failed");
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...data,
        status: internalStatus,
        debito_status: debitoStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Status check error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
