import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download, LogOut, Lock, PackageOpen } from "lucide-react";

interface MemberItem {
  title: string;
  download_url: string;
  image_url: string | null;
  kind: "main" | "bonus" | "bump";
}

export default function Membros() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<MemberItem[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [error, setError] = useState("");

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
  const mainItems = items.filter((i) => i.kind === "main");
  const extraItems = items.filter((i) => i.kind !== "main");

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
          </>
        )}
      </main>
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
