import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("Evolution API credentials not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth header
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

    const body = await req.json();
    const { action, instance_id } = body;

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const headers = {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    };

    switch (action) {
      case "create": {
        const { instance_name, agent_prompt } = body;
        if (!instance_name) {
          return new Response(JSON.stringify({ error: "instance_name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Pre-cleanup: try deleting existing instance with same name
        try {
          await fetch(`${baseUrl}/instance/delete/${instance_name}`, {
            method: "DELETE",
            headers,
          });
        } catch {
          // Ignore errors - instance might not exist
        }

        // Webhook URL pointing to our whatsapp-webhook function
        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

        // Create instance with webhook
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            instanceName: instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"],
            },
          }),
        });

        const createData = await createRes.json();
        console.log("Evolution create response:", JSON.stringify(createData));

        if (!createRes.ok) {
          return new Response(JSON.stringify({ error: createData.message || "Failed to create instance" }), {
            status: createRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save instance to DB
        const qrCode = createData.qrcode?.base64 || createData.qrcode?.pairingCode || null;

        const { data: dbInstance, error: dbError } = await supabaseAdmin
          .from("whatsapp_instances")
          .insert({
            user_id: user.id,
            instance_name,
            instance_id: createData.instance?.instanceId || null,
            status: qrCode ? "qr_ready" : "created",
            qr_code: qrCode,
            agent_prompt: agent_prompt || "Você é um assistente de atendimento ao cliente. Seja educado, prestativo e responda em português.",
          })
          .select()
          .single();

        if (dbError) {
          console.error("DB insert error:", dbError);
          return new Response(JSON.stringify({ error: "Failed to save instance" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, instance: dbInstance, qrcode: qrCode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "qrcode": {
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get instance from DB
        const { data: inst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .eq("user_id", user.id)
          .single();

        if (!inst) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Connect to get fresh QR code
        const connectRes = await fetch(`${baseUrl}/instance/connect/${inst.instance_name}`, {
          method: "GET",
          headers,
        });

        const connectData = await connectRes.json();
        const qrCode = connectData.base64 || connectData.qrcode?.base64 || null;

        if (qrCode) {
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({ qr_code: qrCode, status: "qr_ready" })
            .eq("id", instance_id);
        }

        return new Response(JSON.stringify({ success: true, qrcode: qrCode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .eq("user_id", user.id)
          .single();

        if (!inst) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const statusRes = await fetch(`${baseUrl}/instance/connectionState/${inst.instance_name}`, {
          method: "GET",
          headers,
        });

        const statusData = await statusRes.json();
        const state = statusData.instance?.state || statusData.state || "unknown";

        // Map Evolution states to our status
        let dbStatus = "disconnected";
        if (state === "open" || state === "connected") dbStatus = "connected";
        else if (state === "connecting") dbStatus = "connecting";
        else if (state === "close" || state === "closed") dbStatus = "disconnected";

        await supabaseAdmin
          .from("whatsapp_instances")
          .update({ status: dbStatus })
          .eq("id", instance_id);

        return new Response(JSON.stringify({ success: true, status: dbStatus, raw_state: state }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .eq("user_id", user.id)
          .single();

        if (!inst) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await fetch(`${baseUrl}/instance/logout/${inst.instance_name}`, {
          method: "DELETE",
          headers,
        });

        await supabaseAdmin
          .from("whatsapp_instances")
          .update({ status: "disconnected", qr_code: null })
          .eq("id", instance_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .eq("user_id", user.id)
          .single();

        if (inst) {
          try {
            await fetch(`${baseUrl}/instance/delete/${inst.instance_name}`, {
              method: "DELETE",
              headers,
            });
          } catch {
            // Ignore
          }
        }

        await supabaseAdmin
          .from("whatsapp_instances")
          .delete()
          .eq("id", instance_id)
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_prompt": {
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { agent_prompt, auto_delivery_enabled, auto_recovery_enabled, auto_support_enabled, msg_template_approved, msg_template_pending, msg_template_failed } = body;

        const updateData: Record<string, unknown> = {};
        if (agent_prompt !== undefined) updateData.agent_prompt = agent_prompt;
        if (auto_delivery_enabled !== undefined) updateData.auto_delivery_enabled = auto_delivery_enabled;
        if (auto_recovery_enabled !== undefined) updateData.auto_recovery_enabled = auto_recovery_enabled;
        if (auto_support_enabled !== undefined) updateData.auto_support_enabled = auto_support_enabled;
        if (msg_template_approved !== undefined) updateData.msg_template_approved = msg_template_approved;
        if (msg_template_pending !== undefined) updateData.msg_template_pending = msg_template_pending;
        if (msg_template_failed !== undefined) updateData.msg_template_failed = msg_template_failed;

        await supabaseAdmin
          .from("whatsapp_instances")
          .update(updateData)
          .eq("id", instance_id)
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reconnect": {
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("*")
          .eq("id", instance_id)
          .eq("user_id", user.id)
          .single();

        if (!inst) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 1. Logout first to release the WhatsApp session
        try {
          console.log(`Logging out instance: ${inst.instance_name}`);
          const logoutRes = await fetch(`${baseUrl}/instance/logout/${inst.instance_name}`, {
            method: "DELETE",
            headers,
          });
          console.log(`Logout response: ${logoutRes.status}`);
        } catch (e) {
          console.log("Logout error (ignored):", e);
        }

        // 2. Wait for logout to propagate
        await new Promise((r) => setTimeout(r, 2000));

        // 3. Delete instance from Evolution
        try {
          console.log(`Deleting instance: ${inst.instance_name}`);
          const delRes = await fetch(`${baseUrl}/instance/delete/${inst.instance_name}`, {
            method: "DELETE",
            headers,
          });
          console.log(`Delete response: ${delRes.status}`);
        } catch (e) {
          console.log("Delete error (ignored):", e);
        }

        // 4. Wait for cleanup
        await new Promise((r) => setTimeout(r, 3000));

        // 5. Recreate instance with webhook
        console.log(`Creating new instance: ${inst.instance_name}`);
        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            instanceName: inst.instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"],
            },
          }),
        });

        const createData = await createRes.json();
        console.log("Reconnect create response:", JSON.stringify(createData));

        if (!createRes.ok) {
          return new Response(JSON.stringify({ error: createData.message || "Failed to recreate instance" }), {
            status: createRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const qrCode = createData.qrcode?.base64 || createData.qrcode?.pairingCode || null;

        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            status: qrCode ? "qr_ready" : "created",
            qr_code: qrCode,
            instance_id: createData.instance?.instanceId || inst.instance_id,
          })
          .eq("id", instance_id);

        return new Response(JSON.stringify({ success: true, qrcode: qrCode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_message": {
        const { instance_id: sendInstId, phone, message } = body;
        if (!sendInstId || !phone || !message) {
          return new Response(JSON.stringify({ error: "instance_id, phone, and message are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: sendInst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("*")
          .eq("id", sendInstId)
          .eq("user_id", user.id)
          .single();

        if (!sendInst) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Normalize phone: strip non-digits, handle country codes
        let normalizedPhone = phone.replace(/[\s\-\+\(\)]/g, "");
        // Mozambique local numbers: 9 digits starting with 8
        if (normalizedPhone.startsWith("8") && normalizedPhone.length === 9) {
          normalizedPhone = "258" + normalizedPhone;
        }
        // South Africa local numbers: 9-10 digits starting with 0
        if (normalizedPhone.startsWith("0") && (normalizedPhone.length === 10)) {
          normalizedPhone = "27" + normalizedPhone.substring(1);
        }
        console.log(`Sending message to normalized phone: ${normalizedPhone} (original: ${phone})`);

        const sendRes = await fetch(`${baseUrl}/message/sendText/${sendInst.instance_name}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ number: normalizedPhone, text: message }),
        });

        const sendData = await sendRes.json();
        console.log("Manual send response:", JSON.stringify(sendData).substring(0, 200));

        if (!sendRes.ok) {
          console.warn(`Evolution API send failed (${sendRes.status}): ${JSON.stringify(sendData).substring(0, 300)}`);
          // Still save the message attempt and don't block the flow
          // The number might not exist on WhatsApp but we still want to track the attempt
        }

        // Save to DB with normalized phone
        await supabaseAdmin.from("whatsapp_messages").insert({
          instance_id: sendInstId,
          user_id: user.id,
          remote_jid: `${normalizedPhone}@s.whatsapp.net`,
          sender: "bot",
          message: message,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_webhook": {
        // Force set webhook on existing instance
        if (!instance_id) {
          return new Response(JSON.stringify({ error: "instance_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: whInst } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("id", instance_id)
          .eq("user_id", user.id)
          .single();

        if (!whInst) {
          return new Response(JSON.stringify({ error: "Instance not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const whUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
        const setRes = await fetch(`${baseUrl}/webhook/set/${whInst.instance_name}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            enabled: true,
            url: whUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"],
          }),
        });

        const setData = await setRes.json();
        console.log("Set webhook response:", JSON.stringify(setData));

        return new Response(JSON.stringify({ success: true, data: setData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("WhatsApp connect error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
