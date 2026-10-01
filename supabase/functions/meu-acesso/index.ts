import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Devolve o que uma compra pagou, para a pagina "Conteudos da tua compra".
//
// Regras:
// 1) So devolve conteudo se existir um pagamento confirmado nesta compra.
// 2) Os order bumps so entram se a transacao os registou como aceites.
// 3) Cada item leva a imagem DO SEU produto.
// 4) Numa transacao de upsell, o payment_link_id guardado e o do produto
//    PRINCIPAL do funil, nao o do produto comprado — esse esta no flow_step.
//    Sem resolver isso, quem pagava um upsell nao via nada do que comprou.

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
    .select("id, parent_transaction_id, status, customer_name, customer_email, customer_phone")
    .eq("id", txId)
    .maybeSingle();

  if (!tx) return json({ pago: false, erro: "compra nao encontrada" }, 404);

  const raiz = (tx as any).parent_transaction_id ?? (tx as any).id;
  const COLUNAS = "id, payment_link_id, flow_step_id, bumps_accepted, status, created_at, access_revoked";

  const { data: cadeia } = await supabase
    .from("transactions")
    .select(COLUNAS)
    .or(`id.eq.${raiz},parent_transaction_id.eq.${raiz}`)
    .eq("status", "successful")
    .order("created_at", { ascending: true });

  // Rede de seguranca: juntar tambem o que este cliente pagou em compras que
  // ficaram soltas. Um upsell pago por MB Way (ou outro metodo que sai do
  // site) nasce sem ligacao a compra principal, e sem isto a pagina mostrava
  // so esse produto — o cliente ficava sem o que ja tinha pago.
  //
  // Procura-se pelo email e pelo telefone. Os emails temporarios que o
  // checkout cria antes de o cliente escrever o seu ficam de fora: sao
  // partilhados e juntariam compras de pessoas diferentes.
  const email = String((tx as any).customer_email ?? "").trim().toLowerCase();
  const telefone = String((tx as any).customer_phone ?? "").replace(/\D/g, "");
  const emailServe = email.includes("@") && !email.endsWith("@checkout.cashpay.co");
  const telefoneServe = telefone.length >= 9;

  const porCliente: unknown[] = [];

  // O email identifica uma pessoa, por isso vale para todo o historico: quem
  // comprou com este email tem direito a tudo o que comprou.
  if (emailServe) {
    const { data: outras } = await supabase
      .from("transactions")
      .select(COLUNAS)
      .ilike("customer_email", email)
      .eq("status", "successful")
      .order("created_at", { ascending: true });
    porCliente.push(...(outras ?? []));
  }

  // O telefone e um identificador mais fraco: ha numeros de casa partilhados e
  // ha digitos trocados ao escrever. Por isso só vale dentro da mesma ida ao
  // funil, que e o que precisamos para apanhar a compra solta do MB Way — um
  // funil completa-se em minutos, nao em dias.
  if (telefoneServe) {
    const { data: ref } = await supabase
      .from("transactions").select("created_at").eq("id", raiz).maybeSingle();
    const base = new Date(String((ref as any)?.created_at ?? (tx as any).created_at ?? Date.now()));
    const desde = new Date(base.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const ate = new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: outras } = await supabase
      .from("transactions")
      .select(COLUNAS)
      .ilike("customer_phone", `%${telefone.slice(-9)}`)
      .eq("status", "successful")
      .gte("created_at", desde)
      .lte("created_at", ate)
      .order("created_at", { ascending: true });
    porCliente.push(...(outras ?? []));
  }

  // Uma compra por identificador, pela ordem em que foram feitas. Compras com
  // o acesso retirado (devolucoes) ficam de fora.
  const porId = new Map<string, any>();
  for (const t of [...(cadeia ?? []), ...porCliente] as any[]) {
    if (t?.access_revoked === true) continue;
    porId.set(t.id, t);
  }
  const compras = [...porId.values()].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)));

  if (compras.length === 0) {
    return json({ pago: false, erro: "ainda nao ha um pagamento confirmado para esta compra" }, 200);
  }

  // Qual o produto de cada transacao: num upsell e o checkout do passo do funil.
  const passos = [...new Set(compras.map((c: any) => c.flow_step_id).filter(Boolean))];
  const produtoDoPasso = new Map<string, string>();
  if (passos.length) {
    const { data: fs } = await supabase
      .from("flow_steps").select("id, checkout_link_id, payment_link_id").in("id", passos);
    for (const p of fs ?? []) {
      const alvo = (p as any).checkout_link_id ?? (p as any).payment_link_id;
      if (alvo) produtoDoPasso.set((p as any).id, alvo);
    }
  }
  const produtoDe = (t: any): string =>
    (t.flow_step_id && produtoDoPasso.get(t.flow_step_id)) || t.payment_link_id;

  // Dados dos produtos envolvidos (nome, capa e os bumps de cada um).
  const idsProdutos = [...new Set(compras.map(produtoDe).filter(Boolean))];
  const { data: produtos } = await supabase
    .from("payment_links")
    .select("id, product_name, logo_url, " +
            "order_bump_product_id, order_bump_2_product_id, order_bump_3_product_id, order_bump_4_product_id, " +
            "order_bump_image_url, order_bump_2_image_url, order_bump_3_image_url, order_bump_4_image_url")
    .in("id", idsProdutos);
  const produto = new Map<string, any>();
  for (const p of produtos ?? []) produto.set((p as any).id, p);

  // Capas dos produtos ligados aos bumps, para cada item mostrar a sua.
  const idsBumps = new Set<string>();
  for (const p of produtos ?? []) {
    for (const k of ["order_bump_product_id", "order_bump_2_product_id",
                     "order_bump_3_product_id", "order_bump_4_product_id"]) {
      if ((p as any)[k]) idsBumps.add((p as any)[k]);
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

  for (const c of compras) {
    const t = c as any;
    const idProduto = produtoDe(t);
    const pl = produto.get(idProduto) ?? {};
    const bumps: boolean[] = Array.isArray(t.bumps_accepted) ? t.bumps_accepted.map(Boolean) : [];

    const permitidos = ["main"];
    if (bumps[0]) permitidos.push("bump1");
    if (bumps[1]) permitidos.push("bump2");
    if (bumps[2]) permitidos.push("bump3");
    if (bumps[3]) permitidos.push("bump4");

    const imagemDe = (applies: string): string | null => {
      if (applies === "bump1") return capas.get(pl.order_bump_product_id)   ?? pl.order_bump_image_url   ?? null;
      if (applies === "bump2") return capas.get(pl.order_bump_2_product_id) ?? pl.order_bump_2_image_url ?? null;
      if (applies === "bump3") return capas.get(pl.order_bump_3_product_id) ?? pl.order_bump_3_image_url ?? null;
      if (applies === "bump4") return capas.get(pl.order_bump_4_product_id) ?? pl.order_bump_4_image_url ?? null;
      return pl.logo_url ?? null;
    };

    const { data: ds } = await supabase
      .from("product_deliverables")
      .select("kind, storage_path, external_url, filename, caption, position, applies_to")
      .eq("payment_link_id", idProduto)
      .eq("is_active", true)
      .in("applies_to", permitidos)
      .order("position", { ascending: true });

    for (const d of ds ?? []) {
      const dd = d as any;

      // Comparar pelo DESTINO do conteudo, e antes de assinar. Pelo endereco
      // final nao dava: cada assinatura de um ficheiro gera um endereco novo,
      // e o mesmo produto vendido a dois precos traz o mesmo conteudo com
      // titulos diferentes — o cliente via o mesmo item duas vezes.
      const destino = dd.storage_path || dd.external_url || "";
      if (!destino || vistos.has(destino)) continue;
      vistos.add(destino);

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

      itens.push({
        titulo,
        href,
        imagem: imagemDe(String(dd.applies_to || "main")),
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
