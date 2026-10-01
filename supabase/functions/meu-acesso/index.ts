import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveDeliverablePaymentLinkId } from "./access-products.ts";

// Devolve o que uma compra pagou, para a pagina "Conteudos da tua compra".
//
// Regras:
// 1) So devolve conteudo se existir um pagamento confirmado nesta compra.
// 2) Os order bumps so entram se a transacao os registou como aceites.
// 3) Cada item leva a imagem DO SEU produto. Antes herdavam todos a capa do
//    produto do checkout, e os extras apareciam com a imagem errada.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL = 60 * 60 * 24;

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  let txId = url.searchParams.get("tx") ?? "";
  if (!txId && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    txId = (b as any).transaction_id ?? (b as any).tx ?? "";
  }
  if (!txId) return json({ pago: false, erro: "falta o identificador da compra" }, 400);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txId)) {
    return json({ pago: false, erro: "identificador invalido" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, parent_transaction_id, status, customer_name")
    .eq("id", txId)
    .maybeSingle();

  if (!tx) return json({ pago: false, erro: "compra nao encontrada" }, 404);

  const raiz = (tx as any).parent_transaction_id ?? (tx as any).id;

  const { data: cadeia } = await supabase
    .from("transactions")
    .select("id, payment_link_id, flow_step_id, bumps_accepted, status, created_at")
    .or(`id.eq.${raiz},parent_transaction_id.eq.${raiz}`)
    .eq("status", "successful")
    .order("created_at", { ascending: true });

  if (!cadeia || cadeia.length === 0) {
    return json({ pago: false, erro: "ainda nao ha um pagamento confirmado para esta compra" }, 200);
  }

  // Uma transação de upsell legacy mantém o payment_link_id do checkout inicial.
  // O checkout_link_id do passo aponta para o produto cujos materiais foram pagos.
  const flowStepIds = [...new Set(
    cadeia
      .map((c: any) => c.flow_step_id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
  )];
  const checkoutLinkByStepId = new Map<string, string>();
  if (flowStepIds.length) {
    const { data: flowSteps, error: flowStepsError } = await supabase
      .from("flow_steps")
      .select("id, checkout_link_id")
      .in("id", flowStepIds);

    if (flowStepsError) console.error("Failed to resolve purchased flow-step products:", flowStepsError);
    for (const step of flowSteps ?? []) {
      if (step.checkout_link_id) checkoutLinkByStepId.set(step.id, step.checkout_link_id);
    }
  }

  const linkIdByTransaction = new Map<string, string>();
  const paymentLinkIds = new Set<string>();
  for (const c of cadeia as any[]) {
    const productLinkId = resolveDeliverablePaymentLinkId(c, checkoutLinkByStepId);
    if (productLinkId) {
      linkIdByTransaction.set(c.id, productLinkId);
      paymentLinkIds.add(productLinkId);
    }
    if (c.payment_link_id) paymentLinkIds.add(c.payment_link_id);
  }

  const linksById = new Map<string, any>();
  if (paymentLinkIds.size) {
    const { data: productLinks } = await supabase
      .from("payment_links")
      .select(
        "id, product_name, logo_url, " +
        "order_bump_product_id, order_bump_2_product_id, order_bump_3_product_id, order_bump_4_product_id, " +
        "order_bump_image_url, order_bump_2_image_url, order_bump_3_image_url, order_bump_4_image_url",
      )
      .in("id", [...paymentLinkIds]);
    for (const link of (productLinks ?? []) as any[]) linksById.set(link.id, link);
  }

  // Capas dos produtos ligados aos bumps, para cada item mostrar a sua.
  const idsBumps = new Set<string>();
  for (const c of cadeia) {
    const pl = linksById.get((c as any).payment_link_id) ?? {};
    for (const k of [
      "order_bump_product_id", "order_bump_2_product_id",
      "order_bump_3_product_id", "order_bump_4_product_id",
    ]) {
      if (pl[k]) idsBumps.add(pl[k]);
    }
  }
  const capas = new Map<string, string | null>();
  if (idsBumps.size) {
    const { data: prods } = await supabase
      .from("payment_links").select("id, logo_url").in("id", [...idsBumps]);
    for (const p of prods ?? []) capas.set((p as any).id, (p as any).logo_url ?? null);
  }

  const itens: unknown[] = [];
  const vistos = new Set<string>();

  for (const c of cadeia) {
    const t = c as any;
    const paymentLinkId = linkIdByTransaction.get(t.id);
    if (!paymentLinkId) continue;

    const pl = linksById.get(paymentLinkId) ?? {};
    const checkoutPl = linksById.get(t.payment_link_id) ?? pl;
    const bumps: boolean[] = Array.isArray(t.bumps_accepted) ? t.bumps_accepted.map(Boolean) : [];

    const permitidos = ["main"];
    if (bumps[0]) permitidos.push("bump1");
    if (bumps[1]) permitidos.push("bump2");
    if (bumps[2]) permitidos.push("bump3");
    if (bumps[3]) permitidos.push("bump4");

    // A imagem certa para cada origem.
    const imagemDe = (applies: string, titulo?: string): string | null => {
      const t = (titulo || "").toLowerCase();
      if (t.includes("chá seca barriga") || t.includes("cha seca barriga")) {
        return "https://www.tecnhogar.store/produtos/chas-detox.webp";
      }
      if (t.includes("sucos detox") || t.includes("suco detox")) {
        return "https://www.tecnhogar.store/produtos/chas-detox.webp";
      }
      if (t.includes("farmácia caseira") || t.includes("farmacia caseira")) {
        return "https://www.tecnhogar.store/produtos/plantas-e-chas.webp";
      }
      if (t.includes("air fryer") || t.includes("airfryer")) {
        return "https://www.tecnhogar.store/produtos/150-receitas-airfryer.webp";
      }
      if (t.includes("marmitas fit")) {
        return "https://www.tecnhogar.store/produtos/receitas-de-mamitas-fit-congelada.webp";
      }
      if (t.includes("bolos sem açúcar") || t.includes("bolos sem acucar")) {
        return "https://www.tecnhogar.store/produtos/receitas-de-bolos-sem-acucar.webp";
      }
      if (t.includes("170 planos")) {
        return "https://www.tecnhogar.store/produtos/170-cardapios.webp";
      }
      if (t.includes("desafio 24 dias")) {
        return "https://www.tecnhogar.store/desafio-24-dias/assets/desafio-24-dias-hero.png";
      }
      if (t.includes("155 receitas") || t.includes("150 receitas fitness")) {
        return "https://www.tecnhogar.store/produtos/155-receitas-fitness.png";
      }
      if (applies === "bump1") return capas.get(checkoutPl.order_bump_product_id)   ?? checkoutPl.order_bump_image_url   ?? null;
      if (applies === "bump2") return capas.get(checkoutPl.order_bump_2_product_id) ?? checkoutPl.order_bump_2_image_url ?? null;
      if (applies === "bump3") return capas.get(checkoutPl.order_bump_3_product_id) ?? checkoutPl.order_bump_3_image_url ?? null;
      if (applies === "bump4") return capas.get(checkoutPl.order_bump_4_product_id) ?? checkoutPl.order_bump_4_image_url ?? null;
      return pl.logo_url ?? null;
    };

    const { data: ds } = await supabase
      .from("product_deliverables")
      .select("kind, storage_path, external_url, filename, caption, position, applies_to")
      .eq("payment_link_id", paymentLinkId)
      .eq("is_active", true)
      .in("applies_to", permitidos)
      .order("position", { ascending: true });

    for (const d of ds ?? []) {
      const dd = d as any;
      let href: string | null = null;

      if (dd.kind === "link" && dd.external_url) {
        href = dd.external_url;
      } else if (dd.kind === "file" && dd.storage_path) {
        const { data: signed } = await supabase.storage
          .from("deliverables").createSignedUrl(dd.storage_path, TTL);
        href = signed?.signedUrl ?? null;
      }
      if (!href) continue;

      const titulo = dd.caption || dd.filename || pl.product_name || "Conteúdo";
      const chave = `${titulo}|${href}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      itens.push({
        titulo,
        href,
        imagem: imagemDe(String(dd.applies_to || "main"), titulo),
        tipo: dd.kind,
      });
    }
  }

  return json({
    pago: true,
    nome: (tx as any).customer_name ?? null,
    total: itens.length,
    itens,
  });
});
