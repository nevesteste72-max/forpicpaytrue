import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download, LogOut, Lock, PackageOpen, Award, X } from "lucide-react";

interface MemberItem {
  title: string;
  download_url: string;
  image_url: string | null;
  kind: "main" | "bonus" | "bump" | "certificate";
}

export default function Membros() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<MemberItem[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [certOpen, setCertOpen] = useState(false);

  const enter = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) {
      setError("Introduz um email válido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("get-member-products", {
        body: { email: clean },
      });
      if (fnErr) throw fnErr;
      setItems(data?.items || []);
      setCustomerName(data?.customer_name || null);
      setSearched(true);
    } catch (e) {
      setError("Ocorreu um erro ao procurar as tuas compras. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setSearched(false);
    setItems([]);
    setCustomerName(null);
  };

  const firstName = customerName ? customerName.split(" ")[0] : null;
  const certItem = items.find((i) => i.kind === "certificate");
  const normalItems = items.filter((i) => i.kind !== "certificate");
  const mainItems = normalItems.filter((i) => i.kind === "main");
  const extraItems = normalItems.filter((i) => i.kind !== "main");

  const brand = {
    forest: "#0f2e19",
    forest2: "#1a4d2b",
    gold: "#9a6e03",
  };

  // ---------- Login screen ----------
  if (!searched) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-5"
        style={{ background: "radial-gradient(1100px 380px at 50% -6%, rgba(26,77,43,.12), transparent 60%), #f3f5ef" }}
      >
        <div className="w-full max-w-[400px] bg-white rounded-3xl border border-[#e0e4da] shadow-xl p-8 text-center">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center text-3xl text-white"
            style={{ background: `linear-gradient(150deg, ${brand.forest2}, ${brand.forest})` }}
          >
            🐄
          </div>
          <h1 className="text-2xl font-bold text-[#182016]" style={{ fontFamily: "Georgia, serif" }}>
            A Tua Área de Membros
          </h1>
          <p className="text-sm text-[#5c6a58] mt-1.5 mb-6">
            Introduz o email que usaste na compra para acederes aos teus materiais.
          </p>
          <div className="text-left mb-3">
            <label className="block text-xs font-semibold mb-1.5 text-[#182016]">Email da compra</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enter()}
              placeholder="exemplo@email.com"
              className="h-12 rounded-xl"
            />
          </div>
          {error && <p className="text-sm text-destructive text-left mb-3">{error}</p>}
          <Button
            onClick={enter}
            disabled={loading}
            className="w-full h-12 rounded-xl text-white font-semibold text-base"
            style={{ background: brand.gold }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Aceder aos meus produtos"}
          </Button>
          <p className="text-xs text-[#5c6a58] mt-4 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Acesso vitalício aos teus materiais
          </p>
        </div>
      </div>
    );
  }

  // ---------- Members dashboard ----------
  return (
    <div className="min-h-screen bg-[#f3f5ef]">
      <header style={{ background: brand.forest }} className="text-[#eef3ea] sticky top-0 z-10">
        <div className="max-w-[940px] mx-auto px-5 h-[62px] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg grid place-items-center text-lg" style={{ background: brand.forest2 }}>🐄</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Técnicas de Identificação Animal</div>
            <div className="text-[11px] text-[#9db69f]">Área de Membros</div>
          </div>
          <div className="flex-1" />
          <span className="text-xs text-[#cfe0cd] hidden sm:block">{email.toLowerCase()}</span>
          <Button onClick={logout} variant="ghost" className="text-[#cfe0cd] hover:bg-white/10 h-9 px-3 text-sm">
            <LogOut className="w-4 h-4 mr-1.5" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-[940px] mx-auto px-5 pb-16">
        <div className="pt-9 pb-2">
          <h2 className="text-2xl font-bold text-[#182016]" style={{ fontFamily: "Georgia, serif" }}>
            Olá{firstName ? `, ${firstName}` : ""} 👋
          </h2>
          <p className="text-[#5c6a58] mt-1">
            {items.length > 0
              ? "Aqui estão todos os materiais que já garantiste. Descarrega quando quiseres."
              : ""}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e0e4da] p-10 text-center mt-4">
            <PackageOpen className="w-10 h-10 mx-auto mb-3 text-[#9aa896]" />
            <h3 className="font-semibold text-[#182016] mb-1">Ainda não encontrámos compras neste email</h3>
            <p className="text-sm text-[#5c6a58]">
              Confirma que usaste o mesmo email da compra. Se acabaste de comprar, aguarda a confirmação do pagamento.
            </p>
            <Button onClick={logout} variant="outline" className="mt-4 rounded-xl">Tentar outro email</Button>
          </div>
        ) : (
          <>
            <ItemGroup title="Produto principal" items={mainItems} gold={brand.gold} forest={brand.forest} />
            {extraItems.length > 0 && (
              <ItemGroup title="Bónus e extras" count={`${extraItems.length} materiais`} items={extraItems} gold={brand.gold} forest={brand.forest} />
            )}

            {certItem && (
              <section className="pt-6">
                <div className="flex items-baseline gap-2.5 mb-3.5">
                  <h3 className="text-base font-semibold text-[#182016]" style={{ fontFamily: "Georgia, serif" }}>Certificado</h3>
                  <div className="flex-1 h-px bg-[#e0e4da]" />
                </div>
                <div className="bg-white border border-[#e0e4da] rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-center shadow-sm">
                  <div className="w-14 h-14 rounded-xl flex-none grid place-items-center text-white" style={{ background: `linear-gradient(155deg, ${brand.gold}, #6f4e02)` }}>
                    <Award className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h4 className="text-sm font-semibold text-[#182016]">Certificado de Conclusão</h4>
                    <p className="text-xs text-[#5c6a58] mt-0.5">Coloca o teu nome e descarrega o teu certificado personalizado.</p>
                  </div>
                  <Button onClick={() => setCertOpen(true)} className="flex-none text-white font-semibold rounded-xl" style={{ background: brand.gold }}>
                    <Award className="w-4 h-4 mr-1.5" /> Gerar o meu certificado
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {certOpen && (
        <CertificateModal defaultName={customerName || ""} onClose={() => setCertOpen(false)} gold={brand.gold} forest={brand.forest} />
      )}
    </div>
  );
}

function CertificateModal({ defaultName, onClose, gold, forest }: { defaultName: string; onClose: () => void; gold: string; forest: string }) {
  const [name, setName] = useState(defaultName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const templateRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { templateRef.current = img; setReady(true); };
    img.src = "/saudebovina/certificado-base.webp";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = templateRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    // Name on the blank line
    const display = (name || "").trim().toUpperCase() || "O TEU NOME";
    ctx.fillStyle = "#2e2013";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let size = 64;
    ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
    while (ctx.measureText(display).width > 840 && size > 26) {
      size -= 2;
      ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
    }
    ctx.fillText(display, 712, 556);

    // Today's date in the blank date fields
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    ctx.fillStyle = "#3a2a17";
    ctx.font = "bold 30px Georgia, serif";
    ctx.fillText(dd, 1163, 884);
    ctx.fillText(mm, 1253, 884);
    ctx.fillText(yyyy, 1372, 884);
  }, [name, ready]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = (name || "").trim().replace(/\s+/g, "-").toLowerCase() || "conclusao";
      a.href = url;
      a.download = `certificado-${safe}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[#182016]" style={{ fontFamily: "Georgia, serif" }}>O teu Certificado</h3>
          <button onClick={onClose} className="text-[#5c6a58] hover:text-[#182016]"><X className="w-5 h-5" /></button>
        </div>
        <div className="rounded-xl overflow-hidden border border-[#e0e4da] bg-[#f3f5ef]">
          {ready ? (
            <canvas ref={canvasRef} className="w-full h-auto block" />
          ) : (
            <div className="aspect-[3/2] grid place-items-center text-[#9aa896]"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
        </div>
        <label className="block text-xs font-semibold mt-4 mb-1.5 text-[#182016]">O teu nome (como quiseres que apareça no certificado)</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ivanilson Graça" className="h-12 rounded-xl" maxLength={40} />
        <Button onClick={download} disabled={!ready || !name.trim()} className="w-full h-12 rounded-xl text-white font-semibold mt-4" style={{ background: gold }}>
          <Download className="w-4 h-4 mr-2" /> Descarregar certificado
        </Button>
      </div>
    </div>
  );
}

function ItemGroup({
  title, count, items, gold, forest,
}: { title: string; count?: string; items: MemberItem[]; gold: string; forest: string }) {
  return (
    <section className="pt-6">
      <div className="flex items-baseline gap-2.5 mb-3.5">
        <h3 className="text-base font-semibold text-[#182016]" style={{ fontFamily: "Georgia, serif" }}>{title}</h3>
        {count && <span className="text-xs text-[#5c6a58]">{count}</span>}
        <div className="flex-1 h-px bg-[#e0e4da]" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3.5">
        {items.map((it) => (
          <div key={it.download_url} className="bg-white border border-[#e0e4da] rounded-2xl p-4 flex gap-3.5 items-center shadow-sm">
            <div
              className="w-14 h-14 rounded-xl flex-none grid place-items-center text-2xl text-white overflow-hidden"
              style={{ background: `linear-gradient(155deg, ${forest}, #0a1c11)` }}
            >
              {it.image_url ? (
                <img
                  src={it.image_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : "📄"}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-[#182016] leading-snug">{it.title}</h4>
              <div className="text-xs text-[#5c6a58] mt-0.5">PDF · Acesso vitalício</div>
            </div>
            <a
              href={it.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold border-[1.5px] transition-colors"
              style={{ borderColor: gold, color: gold }}
              onMouseEnter={(e) => { e.currentTarget.style.background = gold; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = gold; }}
            >
              <Download className="w-4 h-4" /> Descarregar
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
