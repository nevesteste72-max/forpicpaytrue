import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Abandoned-cart / failed-payment recovery — 3-email sequence, POR OFERTA.
 *
 * Invoked by pg_cron every ~3h. Targets EUR checkouts that captured a real email
 * but did NOT complete (pending/failed). Detects the offer (aves vs bovinos) from
 * the product name and sends the matching copy + a CTA that reopens the EXACT
 * checkout the person abandoned (/pay/<payment_link_id>). Dedups by email keeping
 * the most advanced row. Buyers are excluded.
 */

const CRON_KEY = "cron_9f2b7a13e6c84d5f0a1bd7e4";
const PAY_BASE = "https://www.tecnhogar.store/pay/";

const SKIP_EMAILS = new Set([
  "ivanilsondagraca40@gmail.com",
  "ivanilsondagraca4@gmail.com",
  "ivanilsonjsousa@gmail.com",
  "ivanilsonjsousa2@gmail.com",
  "iba@gmai.com",
  "iva@gmail.com",
  "ivoferggghhtrrdtyccufuufcu@gmail.com",
  "nevesteste72@gmail.com",
  "julio@gmail.com",
]);

const HOUR = 60 * 60 * 1000;
const STEP_GAP = 22 * HOUR;
const STATUSES = ["pending", "failed"];

type Row = {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
  recovery_stage: number | null;
  recovery_email_sent_at: string | null;
  payment_link_id: string | null;
  stripe_payment_intent_id: string | null;
  amount: number | string | null;
};

type Offer = "aves" | "bovinos";

interface OfferCfg {
  emoji: string;
  brand: string;
  tag: string;
  product: string;
  from: string;
  reassureMain: string;
  signsTitle: string;
  signs: [string, string][];
  extraSign: string;
  costLine: string;
}

const OFFERS: Record<Offer, OfferCfg> = {
  aves: {
    emoji: "🐔",
    brand: "Saúde das Aves",
    tag: "Guia +300 Sinais",
    product: "Guia +300 Sinais de Doenças em Galinhas",
    from: "Saúde das Aves <noreply@tecnhogar.store>",
    reassureMain: "+300 sinais ilustrados",
    signsTitle: "🐔 3 sinais que aparecem ANTES da doença varrer o galinheiro",
    signs: [
      ["1. Penas arrepiadas e abatimento.", "A galinha que se encolhe a um canto e fica apática é, muitas vezes, a primeira a adoecer — antes de qualquer outro sinal visível."],
      ["2. Crista pálida ou arroxeada.", "A cor da crista muda cedo quando algo não está bem — um alarme que passa despercebido a quem não sabe o que procurar."],
      ["3. Espirros, secreção nasal ou respiração ofegante.", "Apanhados cedo, evitam que a doença passe para o resto do bando em 48h."],
    ],
    extraSign: "diarreia esverdeada, penas eriçadas e quebra súbita na postura costumam aparecer juntas num bando que está a adoecer",
    costLine: "Perder o bando por não reconhecer a doença a tempo são dezenas de galinhas — e uma doença espalha-se pelo galinheiro em 48h. O guia custa uma fração disso e fica contigo <strong>para sempre</strong>.",
  },
  bovinos: {
    emoji: "🐄",
    brand: "Saúde Bovina",
    tag: "Guia +300 Técnicas",
    product: "Guia +300 Técnicas de Identificação de Doenças Bovinas",
    from: "Saúde Bovina <noreply@tecnhogar.store>",
    reassureMain: "+300 técnicas ilustradas",
    signsTitle: "🩺 3 sinais que aparecem ANTES da doença se instalar",
    signs: [
      ["1. Afastamento do rebanho.", "Um animal que se isola e fica apático é, muitas vezes, o primeiro a adoecer — antes de qualquer febre visível."],
      ["2. Quebra no apetite ou na ruminação.", "Deixar de ruminar ou comer menos é um alarme precoce que passa despercebido a quem não sabe o que procurar."],
      ["3. Corrimento nasal/ocular ou respiração ofegante.", "Pequenos sinais que, apanhados cedo, evitam que a doença passe para o resto do gado."],
    ],
    extraSign: "febre, pelo arrepiado e orelhas caídas costumam aparecer juntos num animal que está a adoecer",
    costLine: "Perder um animal por não reconhecer a doença a tempo são <strong>centenas de euros</strong> — mais o risco de contagiar o resto do rebanho. O guia custa uma fração disso e fica contigo <strong>para sempre</strong>.",
  },
};

function offerFor(productName: string | null): Offer {
  const p = (productName || "").toLowerCase();
  if (/aves|galinh|frango|poede|capoeira|ovo/.test(p)) return "aves";
  return "bovinos";
}

function firstName(name: string | null, email: string): string {
  const raw = (name || "").trim().split(/\s+/)[0] || email.split("@")[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function header(o: OfferCfg): string {
  return `<tr><td style='background-color:#1b5e20;padding:22px 28px;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr><td style='color:#ffffff;font-size:19px;font-weight:700;letter-spacing:0.2px;'>${o.emoji} ${o.brand}</td><td align='right' style='color:#a5d6a7;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;'>${o.tag}</td></tr></table></td></tr>`;
}

function footer(o: OfferCfg): string {
  return `<tr><td style='background-color:#f4f1ea;padding:20px 30px;'><p style='margin:0 0 4px 0;color:#9a9a8c;font-size:12px;line-height:1.5;'>Recebeste este email porque começaste uma encomenda em ${o.brand}.</p><p style='margin:0;color:#9a9a8c;font-size:12px;line-height:1.5;'>${o.brand} · Portugal</p></td></tr>`;
}

function cta(label: string, url: string): string {
  return `<tr><td align='center' style='padding:24px 30px 8px 30px;'><table role='presentation' cellpadding='0' cellspacing='0'><tr><td align='center' style='background-color:#e08a1e;border-radius:10px;'><a href='${url}' style='display:inline-block;padding:16px 40px;color:#ffffff;font-size:17px;font-weight:800;text-decoration:none;letter-spacing:0.3px;'>${label}</a></td></tr></table><p style='margin:12px 0 0 0;color:#8a8a7e;font-size:13px;'>Acesso imediato · Pagas com MB Way ou cartão</p></td></tr>`;
}

function shell(o: OfferCfg, inner: string): string {
  return `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background-color:#f4f1ea;margin:0;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;'><tr><td align='center'><table role='presentation' width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(27,60,32,0.08);'>${header(o)}${inner}${footer(o)}</table></td></tr></table>`;
}

function reassuranceBlock(o: OfferCfg): string {
  return `<tr><td style='padding:18px 30px 6px 30px;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #ecebe4;'><tr><td style='padding:18px 0 0 0;'><p style='margin:0 0 8px 0;color:#33372e;font-size:14px;line-height:1.55;'>✅ <strong>Acesso vitalício</strong> — descarregas e é teu para sempre.</p><p style='margin:0 0 8px 0;color:#33372e;font-size:14px;line-height:1.55;'>✅ <strong>${o.reassureMain}</strong> — feito para o terreno, não para a estante.</p><p style='margin:0 0 0 0;color:#33372e;font-size:14px;line-height:1.55;'>✅ <strong>Pagamento seguro</strong> — e recebes tudo no email em segundos.</p></td></tr></table></td></tr>`;
}

function buildSubject(o: OfferCfg, stage: number, n: string): string {
  if (stage === 1) return `${n}, o teu guia ficou reservado ${o.emoji} (e trago-te uma dica de brinde)`;
  if (stage === 2) return `${n}, ainda vais a tempo — mas não vale a pena arriscar`;
  return `Último email sobre isto, ${n} ${o.emoji}`;
}

function signsHtml(o: OfferCfg): string {
  const items = o.signs.map(
    (s) => `<p style='margin:0 0 12px 0;color:#33372e;font-size:15px;line-height:1.55;'><strong>${s[0]}</strong> ${s[1]}</p>`
  ).join("");
  return `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background-color:#eef4ea;border-left:4px solid #2e7d32;border-radius:8px;'><tr><td style='padding:20px 22px;'><p style='margin:0 0 14px 0;color:#1b5e20;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;'>${o.signsTitle}</p>${items}</td></tr></table>`;
}

function buildHtml(o: OfferCfg, stage: number, n: string, url: string): string {
  if (stage === 1) {
    const inner = `<tr><td style='padding:34px 30px 8px 30px;'><p style='margin:0 0 6px 0;color:#e08a1e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;'>Ficou algo por terminar</p><h1 style='margin:0 0 14px 0;color:#1c2a1e;font-size:26px;line-height:1.25;font-weight:800;'>Olá ${n}, o teu guia ficou reservado 👇</h1><p style='margin:0 0 16px 0;color:#4a4a42;font-size:16px;line-height:1.6;'>Reparei que começaste a garantir o <strong>${o.product}</strong>, mas o pagamento não chegou a ser concluído. Sem problema — está aqui à tua espera.</p><p style='margin:0 0 4px 0;color:#4a4a42;font-size:16px;line-height:1.6;'>E, para não saíres daqui de mãos a abanar, deixo-te já <strong>3 sinais de alerta</strong> que valem ouro:</p></td></tr><tr><td style='padding:12px 30px 8px 30px;'>${signsHtml(o)}<p style='margin:16px 2px 0 2px;color:#4a4a42;font-size:15px;line-height:1.6;'>Estes são <strong>3</strong>. No guia completo tens <strong>${o.reassureMain}</strong> — com fotos reais — para reconheceres a doença logo no início e agires antes que seja tarde.</p></td></tr>${cta("Terminar e receber o meu guia →", url)}${reassuranceBlock(o)}<tr><td style='padding:20px 30px 30px 30px;'><p style='margin:0;color:#6b6b60;font-size:14px;line-height:1.6;'><strong style='color:#1b5e20;'>P.S.</strong> Cada dia conta. Um único animal salvo paga o guia muitas vezes. <a href='${url}' style='color:#2e7d32;font-weight:700;'>Termina aqui em 1 minuto.</a></p></td></tr>`;
    return shell(o, inner);
  }
  if (stage === 2) {
    const inner = `<tr><td style='padding:34px 30px 8px 30px;'><p style='margin:0 0 6px 0;color:#e08a1e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;'>Ainda vais a tempo</p><h1 style='margin:0 0 14px 0;color:#1c2a1e;font-size:26px;line-height:1.25;font-weight:800;'>${n}, não vale a pena arriscar ${o.emoji}</h1><p style='margin:0 0 16px 0;color:#4a4a42;font-size:16px;line-height:1.6;'>Sei que a vida no terreno é corrida — por isso volto só para te lembrar: o teu <strong>${o.product}</strong> continua reservado.</p></td></tr><tr><td style='padding:6px 30px 8px 30px;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background-color:#fdf3e7;border-left:4px solid #e08a1e;border-radius:8px;'><tr><td style='padding:20px 22px;'><p style='margin:0 0 12px 0;color:#a35a09;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;'>💡 Pensa no custo de NÃO agir</p><p style='margin:0;color:#33372e;font-size:15px;line-height:1.55;'>${o.costLine}</p></td></tr></table><p style='margin:16px 2px 0 2px;color:#4a4a42;font-size:15px;line-height:1.6;'>Mais um sinal para guardares: <strong>${o.extraSign}</strong>. No guia tens ${o.reassureMain}.</p></td></tr>${cta("Terminar o meu pedido →", url)}${reassuranceBlock(o)}<tr><td style='padding:20px 30px 30px 30px;'><p style='margin:0;color:#6b6b60;font-size:14px;line-height:1.6;'><strong style='color:#1b5e20;'>P.S.</strong> Quanto mais cedo souberes ler os sinais, menos animais perdes. É esse o objetivo do guia.</p></td></tr>`;
    return shell(o, inner);
  }
  const inner = `<tr><td style='padding:34px 30px 8px 30px;'><p style='margin:0 0 6px 0;color:#e08a1e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;'>Último lembrete</p><h1 style='margin:0 0 14px 0;color:#1c2a1e;font-size:26px;line-height:1.25;font-weight:800;'>Último email sobre isto, ${n} ${o.emoji}</h1><p style='margin:0 0 8px 0;color:#4a4a42;font-size:16px;line-height:1.6;'>Não te quero encher a caixa de entrada, por isso fica só o essencial do que vais receber:</p></td></tr>${reassuranceBlock(o)}${cta("Garantir o meu guia →", url)}<tr><td style='padding:20px 30px 30px 30px;'><p style='margin:0;color:#6b6b60;font-size:14px;line-height:1.6;'>Se fizer sentido para ti, é só terminar em 1 minuto. Se não, sem problema — desejo-te muita saúde para os teus animais. ${o.emoji}</p></td></tr>`;
  return shell(o, inner);
}

function buildText(o: OfferCfg, stage: number, n: string, url: string): string {
  if (stage === 1) {
    return [
      `Olá ${n}, o teu guia ficou reservado.`, ``,
      `Reparei que começaste a garantir o ${o.product}, mas o pagamento não chegou a ser concluído. Está aqui à tua espera.`, ``,
      `3 sinais de alerta que valem ouro:`,
      ...o.signs.map((s) => `${s[0]} ${s[1]}`), ``,
      `Estes são 3. No guia completo tens ${o.reassureMain}, com fotos reais.`, ``,
      `Termina e recebe o teu guia: ${url}`, ``,
      `Acesso vitalício · Pagamento seguro (MB Way ou cartão) · Acesso imediato.`, ``,
      `${o.brand} · Portugal`,
    ].join("\n");
  }
  if (stage === 2) {
    return [
      `Olá ${n}, ainda vais a tempo.`, ``,
      `Volto só para te lembrar que o teu ${o.product} continua reservado.`, ``,
      `Pensa no custo de NÃO agir: ${o.costLine.replace(/<[^>]+>/g, "")}`, ``,
      `Mais um sinal: ${o.extraSign}.`, ``,
      `Termina aqui: ${url}`, ``,
      `Garantia + acesso imediato + MB Way/cartão.`, ``,
      `${o.brand} · Portugal`,
    ].join("\n");
  }
  return [
    `Olá ${n}, este é o último email que te envio sobre isto.`, ``,
    `Fica só o essencial:`,
    `- ${o.reassureMain} para identificar as doenças a tempo`,
    `- Acesso vitalício — descarregas e é teu`,
    `- Pagamento seguro (MB Way ou cartão), acesso imediato`, ``,
    `Se faz sentido para ti, o teu guia está aqui: ${url}`, ``,
    `Se não, sem problema — desejo-te muita saúde para os teus animais.`, ``,
    `${o.brand} · Portugal`,
  ].join("\n");
}


type Voucher = { entity: string; reference: string; expiresAt: number };

/**
 * A Multibanco voucher means the person did NOT abandon — they chose to pay at
 * an ATM/homebanking and have an open reference with a deadline. Mailing them
 * "you left something behind" invites either giving up or paying twice, so they
 * get a reminder of their own reference instead.
 */
async function multibancoVoucher(
  paymentIntentId: string | null,
  stripeKey: string | null
): Promise<Voucher | null> {
  if (!paymentIntentId || !stripeKey) return null;
  try {
    const resp = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!resp.ok) return null;
    const pi = await resp.json();
    if (pi.status !== "requires_action") return null;
    const d = pi.next_action?.multibanco_display_details;
    if (!d?.reference) return null;
    // An expired voucher is no longer a reason to hold back the normal sequence.
    if (d.expires_at && d.expires_at * 1000 < Date.now()) return null;
    return {
      entity: String(d.entity || ""),
      reference: String(d.reference),
      expiresAt: Number(d.expires_at || 0),
    };
  } catch {
    return null;
  }
}

function euro(v: number | string | null): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return `${(n || 0).toFixed(2).replace(".", ",")} EUR`;
}

function voucherDeadline(expiresAt: number): string {
  if (!expiresAt) return "";
  return new Date(expiresAt * 1000).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Lisbon",
  });
}

function buildVoucherSubject(o: OfferCfg, n: string): string {
  return `${n}, a tua referencia Multibanco esta ativa ${o.emoji}`;
}

function buildVoucherHtml(o: OfferCfg, n: string, v: Voucher, amount: string, url: string): string {
  const prazo = voucherDeadline(v.expiresAt);
  const ate = prazo ? ` ate <strong>${prazo}</strong>` : "";
  const inner = `<tr><td style='padding:34px 30px 8px 30px;'><p style='margin:0 0 6px 0;color:#e08a1e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;'>Falta so pagar</p><h1 style='margin:0 0 14px 0;color:#1c2a1e;font-size:26px;line-height:1.25;font-weight:800;'>Ola ${n}, a tua referencia esta a tua espera</h1><p style='margin:0 0 16px 0;color:#4a4a42;font-size:16px;line-height:1.6;'>Escolheste pagar o <strong>${o.product}</strong> por Multibanco. A referencia esta ativa e podes paga-la no multibanco ou no homebanking${ate}.</p></td></tr><tr><td style='padding:8px 30px;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background-color:#eef4ea;border-left:4px solid #2e7d32;border-radius:8px;'><tr><td style='padding:22px;'><p style='margin:0 0 8px 0;color:#6b6b60;font-size:13px;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;'>Entidade</p><p style='margin:0 0 16px 0;color:#1b5e20;font-size:26px;font-weight:800;letter-spacing:2px;'>${v.entity}</p><p style='margin:0 0 8px 0;color:#6b6b60;font-size:13px;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;'>Referencia</p><p style='margin:0 0 16px 0;color:#1b5e20;font-size:26px;font-weight:800;letter-spacing:2px;'>${v.reference}</p><p style='margin:0 0 8px 0;color:#6b6b60;font-size:13px;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;'>Valor</p><p style='margin:0;color:#1b5e20;font-size:26px;font-weight:800;'>${amount}</p></td></tr></table><p style='margin:16px 2px 0 2px;color:#4a4a42;font-size:15px;line-height:1.6;'>Assim que o pagamento entrar, recebes o guia completo neste mesmo email, automaticamente.</p></td></tr>${reassuranceBlock(o)}<tr><td style='padding:20px 30px 30px 30px;'><p style='margin:0;color:#6b6b60;font-size:14px;line-height:1.6;'>Preferes pagar por MB Way ou cartao e receber ja? <a href='${url}' style='color:#2e7d32;font-weight:700;'>Podes faze-lo aqui.</a> Se pagares por ai, ignora a referencia acima — nao pagues as duas.</p></td></tr>`;
  return shell(o, inner);
}

function buildVoucherText(o: OfferCfg, n: string, v: Voucher, amount: string, url: string): string {
  const prazo = voucherDeadline(v.expiresAt);
  const ate = prazo ? ` ate ${prazo}` : "";
  return [
    `Ola ${n},`,
    "",
    `Escolheste pagar o ${o.product} por Multibanco e a tua referencia esta ativa${ate}:`,
    "",
    `Entidade: ${v.entity}`,
    `Referencia: ${v.reference}`,
    `Valor: ${amount}`,
    "",
    "Assim que o pagamento entrar, recebes o guia neste email, automaticamente.",
    "",
    `Preferes pagar por MB Way ou cartao e receber ja? ${url}`,
    "Se pagares por ai, ignora a referencia acima - nao pagues as duas.",
    "",
    o.brand,
  ].join("\n");
}

serve(async (req) => {
  if (req.headers.get("x-cron-key") !== CRON_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    // Used only to tell "waiting on a Multibanco reference" apart from "gone".
    const { data: settings } = await supabase
      .from("app_settings").select("stripe_secret_key").eq("id", 1).maybeSingle();
    // The column is empty in this project; the live key lives in the env var.
    const stripeKey: string | null =
      settings?.stripe_secret_key || Deno.env.get("STRIPE_SECRET_KEY") || null;
    if (!stripeKey) console.warn("[RECOVERY] no Stripe key - Multibanco vouchers cannot be detected");

    const now = Date.now();
    const oneHourAgo = new Date(now - HOUR).toISOString();
    const fiveDaysAgo = new Date(now - 5 * 24 * HOUR).toISOString();

    const { data: rawCandidates, error: candErr } = await supabase
      .from("transactions")
      .select("id, customer_email, customer_name, created_at, recovery_stage, recovery_email_sent_at, payment_link_id, stripe_payment_intent_id, amount")
      .in("status", STATUSES)
      .eq("currency", "EUR")
      .lt("recovery_stage", 3)
      .lt("created_at", oneHourAgo)
      .gt("created_at", fiveDaysAgo)
      .order("created_at", { ascending: false });
    if (candErr) throw candErr;

    const { data: buyers, error: buyErr } = await supabase
      .from("transactions").select("customer_email").eq("status", "successful");
    if (buyErr) throw buyErr;
    const buyerSet = new Set((buyers || []).map((b) => (b.customer_email || "").toLowerCase()));

    // Product names for offer detection
    const linkIds = [...new Set((rawCandidates || []).map((r) => r.payment_link_id).filter(Boolean))] as string[];
    const linkNames = new Map<string, string>();
    if (linkIds.length) {
      const { data: links } = await supabase.from("payment_links").select("id, product_name").in("id", linkIds);
      for (const l of links || []) linkNames.set(l.id, l.product_name || "");
    }

    // Dedup by email keeping the MOST ADVANCED row.
    const byEmail = new Map<string, Row>();
    for (const row of (rawCandidates || []) as Row[]) {
      const lower = (row.customer_email || "").trim().toLowerCase();
      if (!lower) continue;
      const cur = byEmail.get(lower);
      if (!cur) { byEmail.set(lower, row); continue; }
      const a = row.recovery_stage ?? 0, b = cur.recovery_stage ?? 0;
      if (a > b) { byEmail.set(lower, row); continue; }
      if (a === b) {
        const at = row.recovery_email_sent_at ? new Date(row.recovery_email_sent_at).getTime() : 0;
        const bt = cur.recovery_email_sent_at ? new Date(cur.recovery_email_sent_at).getTime() : 0;
        if (at > bt) byEmail.set(lower, row);
      }
    }

    const results: { email: string; stage: number; offer: string; ok: boolean; id?: string; error?: string }[] = [];

    for (const [lower, row] of byEmail) {
      const email = (row.customer_email || "").trim();
      if (!email || !email.includes("@")) continue;
      if (lower.includes("@checkout.cashpay.co")) continue;
      // Second line of defence: never mail a malformed address (bounces hurt the
      // sending domain, which is shared with the purchase emails).
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(lower)) continue;
      if (lower.includes("ivanilson")) continue;
      if (SKIP_EMAILS.has(lower)) continue;
      if (buyerSet.has(lower)) continue;

      const stageDone = row.recovery_stage ?? 0;
      const ageMs = now - new Date(row.created_at).getTime();

      const voucher = await multibancoVoucher(row.stripe_payment_intent_id, stripeKey);
      if (voucher) {
        // Remind them of their own reference once, then stay quiet while it is
        // valid. If it expires unpaid, the normal sequence resumes from stage 2.
        if (stageDone > 0) continue;
        const offerV = offerFor(linkNames.get(row.payment_link_id || "") || "");
        const oV = OFFERS[offerV];
        const urlV = row.payment_link_id ? `${PAY_BASE}${row.payment_link_id}` : "https://www.tecnhogar.store/aves/";
        const nV = firstName(row.customer_name, email);
        const tag = `${offerV}/multibanco`;
        try {
          const respV = await resend.emails.send({
            from: oV.from,
            reply_to: "ivanilsonjsousa@gmail.com",
            to: [email],
            subject: buildVoucherSubject(oV, nV),
            html: buildVoucherHtml(oV, nV, voucher, euro(row.amount), urlV),
            text: buildVoucherText(oV, nV, voucher, euro(row.amount), urlV),
            headers: {
              "List-Unsubscribe": "<mailto:noreply@tecnhogar.store?subject=unsubscribe>",
              "X-Entity-Ref-ID": `${row.id}-mb`,
            },
          });
          if (respV.error) {
            results.push({ email, stage: 1, offer: tag, ok: false, error: respV.error.message });
            continue;
          }
          await supabase
            .from("transactions")
            .update({ recovery_stage: 1, recovery_email_sent_at: new Date().toISOString() })
            .eq("id", row.id);
          results.push({ email, stage: 1, offer: tag, ok: true, id: respV.data?.id });
        } catch (e) {
          results.push({ email, stage: 1, offer: tag, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        continue;
      }
      const sinceLast = row.recovery_email_sent_at ? now - new Date(row.recovery_email_sent_at).getTime() : Infinity;

      let stage = 0;
      if (stageDone === 0 && ageMs >= HOUR) stage = 1;
      else if (stageDone === 1 && sinceLast >= STEP_GAP) stage = 2;
      else if (stageDone === 2 && sinceLast >= STEP_GAP) stage = 3;
      else continue;

      const offer = offerFor(linkNames.get(row.payment_link_id || "") || "");
      const o = OFFERS[offer];
      const url = row.payment_link_id ? `${PAY_BASE}${row.payment_link_id}` : "https://www.tecnhogar.store/aves/";
      const n = firstName(row.customer_name, email);
      try {
        const resp = await resend.emails.send({
          from: o.from,
          reply_to: "ivanilsonjsousa@gmail.com",
          to: [email],
          subject: buildSubject(o, stage, n),
          html: buildHtml(o, stage, n, url),
          text: buildText(o, stage, n, url),
          headers: {
            "List-Unsubscribe": "<mailto:noreply@tecnhogar.store?subject=unsubscribe>",
            "X-Entity-Ref-ID": `${row.id}-s${stage}`,
          },
        });
        if (resp.error) {
          results.push({ email, stage, offer, ok: false, error: resp.error.message });
          continue;
        }
        await supabase
          .from("transactions")
          .update({ recovery_stage: stage, recovery_email_sent_at: new Date().toISOString() })
          .in("status", STATUSES)
          .ilike("customer_email", email);
        results.push({ email, stage, offer, ok: true, id: resp.data?.id });
      } catch (e) {
        results.push({ email, stage, offer, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    console.log(`[RECOVERY] emails=${byEmail.size} sent=${sent}`, JSON.stringify(results));
    return new Response(JSON.stringify({ success: true, sent, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[RECOVERY] error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
