import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Reenvio de materiais a pedido do cliente.
 *
 * A pessoa escreve o email e recebe outra vez os links da ultima compra. Serve
 * para quem apagou o email, o tem no spam, ou escreveu o endereco com um erro
 * e agora corrige.
 *
 * Duas decisoes deliberadas:
 * - A resposta e SEMPRE a mesma, haja compra ou nao. Dizer "esse email nao tem
 *   compras" deixaria qualquer pessoa descobrir quem comprou.
 * - So reenvia para o endereco que consta da compra, nunca para outro indicado
 *   no pedido, para o endpoint nao servir de forma de enviar material a
 *   terceiros.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESPOSTA_NEUTRA = {
  success: true,
  message:
    "Se houver uma compra associada a esse email, os materiais foram reenviados. Verifica tambem a pasta de spam.",
};

const INTERVALO_MIN = 5; // um reenvio por email a cada 5 minutos

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { email } = await req.json();
    const alvo = String(email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(alvo)) {
      return json({ success: false, message: "Escreve um email valido." }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: compras } = await supabase
      .from("transactions")
      .select("id, customer_email, customer_name, amount, currency, payment_link_id, created_at, resent_at")
      .eq("status", "successful")
      .ilike("customer_email", alvo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!compras?.length) return json(RESPOSTA_NEUTRA);

    // Trava anti-abuso: nao repetir envios em rajada para o mesmo endereco.
    const ultimo = compras.find((c) => c.resent_at)?.resent_at;
    if (ultimo && Date.now() - new Date(ultimo).getTime() < INTERVALO_MIN * 60 * 1000) {
      return json(RESPOSTA_NEUTRA);
    }

    const linkIds = [...new Set(compras.map((c) => c.payment_link_id).filter(Boolean))] as string[];
    const nomes = new Map<string, string>();
    if (linkIds.length) {
      const { data: links } = await supabase
        .from("payment_links")
        .select("id, product_name, checkout_language")
        .in("id", linkIds);
      for (const l of links || []) nomes.set(l.id, l.product_name || "O teu material");
    }

    let enviados = 0;
    for (const c of compras) {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-purchase-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_email: c.customer_email, // nunca o email do pedido
          customer_name: c.customer_name || "",
          product_name: nomes.get(c.payment_link_id || "") || "O teu material",
          amount: Number(c.amount),
          currency: (c.currency || "EUR").toUpperCase(),
          transaction_id: c.id,
        }),
      });
      if (resp.ok) enviados++;
    }

    if (enviados) {
      await supabase
        .from("transactions")
        .update({ resent_at: new Date().toISOString() })
        .in("id", compras.map((c) => c.id));
    }

    console.log(`[REENVIO] ${alvo}: ${enviados}/${compras.length} emails reenviados`);
    return json(RESPOSTA_NEUTRA);
  } catch (e) {
    console.error("[REENVIO] erro:", e);
    return json({ success: false, message: "Nao foi possivel processar o pedido." }, 500);
  }
});
