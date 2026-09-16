import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PartyPopper, Download, Gift, Loader2 } from "lucide-react";

interface DownloadItem {
  title: string;
  desc: string;
  href: string;
  emoji: string;
}

export default function DownloadHubFR() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const tx = searchParams.get("tx") || searchParams.get("cashpay_tx");
  const extra = searchParams.get("extra");

  const [productName, setProductName] = useState("Le Soulagement Dans Chaque Assiette");
  const [bumpsAccepted, setBumpsAccepted] = useState<boolean[]>([false, false]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (linkId) {
          const { data } = await supabase
            .from("payment_links")
            .select("product_name")
            .eq("id", linkId)
            .maybeSingle();
          if (data?.product_name) setProductName(data.product_name);
        }
        if (tx) {
          const { data } = await supabase
            .from("transactions")
            .select("bumps_accepted")
            .eq("id", tx)
            .maybeSingle();
          const accepted = data?.bumps_accepted;
          if (Array.isArray(accepted)) {
            setBumpsAccepted([Boolean(accepted[0]), Boolean(accepted[1])]);
          }
        }
      } catch (err) {
        console.error("Failed to load download hub data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [linkId, tx]);

  const items: DownloadItem[] = [
    {
      emoji: "📘",
      title: "Votre Guide Principal — 500 Recettes",
      desc: "Le Soulagement Dans Chaque Assiette, par Marie Dubois",
      href: "/livrables/500-recettes.html",
    },
    {
      emoji: "🎁",
      title: "Vos 9 Bonus Offerts",
      desc: "Inclus immédiatement avec votre collection",
      href: "/livrables/bonus-pack.html",
    },
  ];

  if (bumpsAccepted[0]) {
    items.push({
      emoji: "🌙",
      title: "Élixirs & Infusions Drainantes du Soir",
      desc: "Le Rituel Ventre Plat Nocturne",
      href: "/livrables/elixirs-du-soir.html",
    });
  }
  if (bumpsAccepted[1]) {
    items.push({
      emoji: "🛒",
      title: "Le Guide des Courses & Décodeur d'Étiquettes",
      desc: "Votre antisèche smartphone Carrefour, Delhaize, Lidl",
      href: "/livrables/guide-courses.html",
    });
  }
  if (extra === "boulangerie") {
    items.push({
      emoji: "🥖",
      title: "Le Grand Pack Boulangerie & Pâtisserie Sans Gluten",
      desc: "Baguettes, pains de campagne, brioches, quiches",
      href: "/livrables/boulangerie-sans-gluten.html",
    });
  }
  if (extra === "pains-express") {
    items.push({
      emoji: "🍳",
      title: "Pains & Focaccias Express à la Poêle",
      desc: "Du pain frais chaud en 10 minutes, sans four",
      href: "/livrables/pains-express-poele.html",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D52]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-xl border border-[#eee] overflow-hidden">
          <div className="bg-[#2E7D52]/10 border-b border-[#2E7D52]/15 p-8 text-center">
            <div className="w-16 h-16 bg-[#2E7D52]/15 rounded-full flex items-center justify-center mx-auto mb-3">
              <PartyPopper className="w-8 h-8 text-[#2E7D52]" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Merci pour votre achat !</h1>
            <p className="text-sm text-gray-600 mt-1">{productName}</p>
          </div>

          <div className="p-5 md:p-6 space-y-3">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 hover:border-[#2E7D52]/50 bg-gray-50 hover:bg-[#2E7D52]/5 p-4 transition-colors"
              >
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 leading-snug">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <Download className="w-4 h-4 text-[#2E7D52] shrink-0" />
              </a>
            ))}
          </div>

          <div className="px-6 pb-6">
            <p className="text-[11px] text-center text-gray-400 flex items-center justify-center gap-1">
              <Gift className="w-3 h-3" />
              Cliquez sur chaque bouton pour ouvrir votre contenu — aucun email requis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
