import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callGemini(apiKey: string, messages: { role: string; content: string }[]) {
  // Convert chat format to Gemini format
  const systemInstruction = messages.find(m => m.role === "system")?.content || "";
  const chatMessages = messages.filter(m => m.role !== "system");

  const contents = chatMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a shared secret so only the configured Evolution webhook can post here.
    // Configure Evolution to send this header (or ?secret=... query param) with the value
    // of the WHATSAPP_WEBHOOK_SECRET environment secret.
    const WHATSAPP_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
    if (WHATSAPP_WEBHOOK_SECRET) {
      const providedSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-evolution-webhook-secret") ||
        new URL(req.url).searchParams.get("secret") ||
        "";
      if (providedSecret !== WHATSAPP_WEBHOOK_SECRET) {
        console.warn("Rejected whatsapp-webhook call: missing or invalid shared secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.error("WHATSAPP_WEBHOOK_SECRET is not configured; rejecting inbound webhook.");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    console.log("Webhook received:", JSON.stringify(body).substring(0, 500));

    const rawEvent = body.event || "";
    const event = rawEvent.toLowerCase().replace(/_/g, ".").replace(/\s+/g, ".");
    const instanceName = body.instance || body.instanceName || "";

    const { data: instance } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .single();

    if (!instance) {
      console.log("Instance not found in DB:", instanceName);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle CONNECTION_UPDATE
    if (event.includes("connection")) {
      const state = body.data?.state || body.data?.status || "";
      let dbStatus = "disconnected";
      if (state === "open" || state === "connected") dbStatus = "connected";
      else if (state === "connecting") dbStatus = "connecting";

      await supabaseAdmin
        .from("whatsapp_instances")
        .update({ status: dbStatus, qr_code: dbStatus === "connected" ? null : instance.qr_code })
        .eq("id", instance.id);

      console.log(`Instance ${instanceName} connection updated: ${dbStatus}`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle MESSAGES_UPSERT
    if (event.includes("messages")) {
      const messages = body.data || [];
      const messageArray = Array.isArray(messages) ? messages : [messages];

      for (const msg of messageArray) {
        const key = msg.key || {};
        const messageContent = msg.message || {};

        if (key.fromMe) continue;
        if (key.remoteJid?.endsWith("@g.us")) continue;
        if (key.remoteJid === "status@broadcast") continue;

        const text =
          messageContent.conversation ||
          messageContent.extendedTextMessage?.text ||
          messageContent.imageMessage?.caption ||
          messageContent.videoMessage?.caption ||
          "";

        if (!text.trim()) continue;

        const remoteJid = key.remoteJid || "";
        const messageId = key.id || "";

        await supabaseAdmin.from("whatsapp_messages").insert({
          instance_id: instance.id,
          user_id: instance.user_id,
          remote_jid: remoteJid,
          sender: "customer",
          message: text,
          whatsapp_message_id: messageId,
        });

        console.log(`Message saved from ${remoteJid}: ${text.substring(0, 100)}`);

        if (!instance.auto_support_enabled) continue;
        if (!GEMINI_API_KEY || !EVOLUTION_API_URL || !EVOLUTION_API_KEY) continue;

        try {
          // Get last 10 messages for context
          const { data: history } = await supabaseAdmin
            .from("whatsapp_messages")
            .select("sender, message")
            .eq("instance_id", instance.id)
            .eq("remote_jid", remoteJid)
            .order("created_at", { ascending: false })
            .limit(10);

          const chatHistory = (history || []).reverse().map((m) => ({
            role: m.sender === "customer" ? "user" : "assistant",
            content: m.message,
          }));

          // Check recent transactions for context
          const phoneDigits = remoteJid.replace("@s.whatsapp.net", "");
          const { data: recentTx } = await supabaseAdmin
            .from("transactions")
            .select("id, amount, status, customer_name, customer_email, payment_link_id, created_at")
            .or(`customer_phone.ilike.%${phoneDigits}%`)
            .order("created_at", { ascending: false })
            .limit(5);

          // Detect language from payment links
          let detectedLanguage = "pt"; // default Portuguese
          if (recentTx && recentTx.length > 0) {
            const paymentLinkIds = [...new Set(recentTx.map(t => t.payment_link_id))];
            const { data: paymentLinks } = await supabaseAdmin
              .from("payment_links")
              .select("checkout_language")
              .in("id", paymentLinkIds)
              .limit(5);

            if (paymentLinks && paymentLinks.length > 0) {
              const languages = paymentLinks.map(p => p.checkout_language);
              // If any product is in English, respond in English
              detectedLanguage = languages.includes("en") ? "en" : "pt";
            }
          }

          const isEnglish = detectedLanguage === "en";

          let contextPrompt = instance.agent_prompt || (
            isEnglish
              ? "You are a friendly customer support assistant. Always respond in English."
              : "Você é um assistente de atendimento ao cliente amigável. Sempre responda em português."
          );

          // Force language instruction
          contextPrompt += isEnglish
            ? "\n\nIMPORTANT: Always respond in English."
            : "\n\nIMPORTANTE: Sempre responda em português.";

          // Refund policy instructions
          contextPrompt += isEnglish
            ? "\n\nREFUND POLICY: If a customer asks for a refund, first try to understand their issue and offer solutions (re-delivery, support, etc.). Be empathetic but firm. If the customer insists heavily on a refund, you may offer a PARTIAL refund of up to 40% of the purchase value as a last resort. Never offer a full refund. Always frame it as a goodwill gesture."
            : "\n\nPOLÍTICA DE REEMBOLSO: Se um cliente pedir reembolso, primeiro tente entender o problema e oferecer soluções (re-entrega, suporte, etc.). Seja empático mas firme. Se o cliente insistir muito no reembolso, você pode oferecer um reembolso PARCIAL de até 40% do valor da compra como último recurso. Nunca ofereça reembolso total. Sempre apresente como um gesto de boa vontade.";

          if (recentTx && recentTx.length > 0) {
            const txLabel = isEnglish ? "Purchase history for this customer" : "Histórico de compras deste cliente";
            const txInfo = recentTx.map((t) =>
              `- ${t.status}: ${t.amount} (${new Date(t.created_at).toLocaleDateString(isEnglish ? "en-US" : "pt-BR")})`
            ).join("\n");
            contextPrompt += `\n\n${txLabel}:\n${txInfo}`;

            const pendingTx = recentTx.filter((t) => t.status === "pending" || t.status === "failed" || t.status === "cancelled");
            if (pendingTx.length > 0 && instance.auto_recovery_enabled) {
              contextPrompt += isEnglish
                ? "\n\nThis customer has pending/failed purchases. Gently encourage them to complete the purchase if appropriate."
                : "\n\nEste cliente tem compras pendentes/falhadas. Tente gentilmente incentivá-lo a completar a compra se apropriado.";
            }

            const completedTx = recentTx.filter((t) => t.status === "completed" || t.status === "success" || t.status === "successful");
            if (completedTx.length > 0 && instance.auto_delivery_enabled) {
              contextPrompt += isEnglish
                ? "\n\nThis customer has completed purchases. Offer support about product delivery if they ask."
                : "\n\nEste cliente tem compras concluídas. Ofereça suporte sobre a entrega do produto se ele perguntar.";
            }
          }

          // Call Gemini API
          const reply = await callGemini(GEMINI_API_KEY, [
            { role: "system", content: contextPrompt },
            ...chatHistory,
          ]);

          if (!reply.trim()) continue;

          // Send reply via Evolution API
          const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
          const sendRes = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: remoteJid.replace("@s.whatsapp.net", ""),
              text: reply,
            }),
          });

          const sendData = await sendRes.json();
          console.log("Message sent:", JSON.stringify(sendData).substring(0, 200));

          // Save bot reply
          await supabaseAdmin.from("whatsapp_messages").insert({
            instance_id: instance.id,
            user_id: instance.user_id,
            remote_jid: remoteJid,
            sender: "bot",
            message: reply,
          });
        } catch (aiErr) {
          console.error("Gemini/send error:", aiErr);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
