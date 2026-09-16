import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Zap, Lock, ShieldCheck } from "lucide-react";
import { getStripePromise } from "@/lib/stripeClient";

const FLOW_STEP_ID = "cace9210-8551-4af4-876c-3eb8d08b4a6f";
const FALLBACK_PAYMENT_LINK_ID = "09150daf-5861-4ae7-a426-84b90d9af058";
const FRONT_END_LINK_ID = "df4fc3a5-0ed9-448e-87c9-3acf30f90b09";

type OfferState = "offer" | "processing" | "authenticating" | "success" | "failed";

export default function DownsellPainsExpress() {
  const [searchParams] = useSearchParams();
  const tx = searchParams.get("cashpay_tx") || searchParams.get("tx");
  const linkId = searchParams.get("cashpay_link") || searchParams.get("link") || FRONT_END_LINK_ID;

  const [state, setState] = useState<OfferState>("offer");
  const [errorMessage, setErrorMessage] = useState("");

  const goToDownloads = (extra?: string) => {
    const params = new URLSearchParams();
    if (tx) params.set("tx", tx);
    if (extra) params.set("extra", extra);
    const query = params.toString();
    window.location.href = `/telecharger/${linkId}${query ? `?${query}` : ""}`;
  };

  const payByCard = () => {
    window.location.href = `/pay/${FALLBACK_PAYMENT_LINK_ID}`;
  };

  const handleAccept = async () => {
    if (!tx) {
      payByCard();
      return;
    }
    setState("processing");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/one-click-upsell`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ parent_transaction_id: tx, flow_step_id: FLOW_STEP_ID }),
        }
      );
      let result = await response.json();

      if (result.requires_action && result.client_secret) {
        setState("authenticating");
        const stripe = await getStripePromise();
        if (!stripe) {
          setErrorMessage("Impossible de démarrer l'authentification bancaire.");
          setState("failed");
          return;
        }
        const { error: actionError } = await stripe.handleNextAction({ clientSecret: result.client_secret });
        if (actionError) {
          setErrorMessage(actionError.message || "L'authentification bancaire n'a pas abouti.");
          setState("failed");
          return;
        }
        setState("processing");
        const settleRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/one-click-upsell`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ settle_transaction_id: result.transaction_id }),
          }
        );
        result = await settleRes.json();
      }

      if (result.success) {
        setState("success");
        setTimeout(() => goToDownloads("pains-express"), 1200);
      } else {
        setErrorMessage(result.error || "L'autorisation en 1 clic a échoué.");
        setState("failed");
      }
    } catch (err) {
      console.error("Downsell error:", err);
      setErrorMessage("Délai de connexion dépassé.");
      setState("failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f3] text-gray-900 font-sans pb-12">
      <main className="max-w-xl mx-auto px-4 pt-8">
        {state === "offer" && (
          <article className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="bg-amber-600 text-white py-3 px-4 text-center text-sm font-bold uppercase tracking-wide">
              🍳 Dernière chance
            </div>
            <div className="p-5 md:p-6">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight mb-3">
                Trop occupé(e) pour allumer le four et pétrir ?
              </h1>

              <img
                src="/produits-fr/cover-pains-express.jpg"
                alt="Pains Express à la Poêle"
                className="w-full rounded-xl border border-gray-200 mb-4"
              />

              <div className="bg-amber-50 rounded-xl p-4 mb-5 border border-amber-200">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Pains &amp; Focaccias Express à la Poêle</strong> — des petits pains, naans à l'ail et galettes croustillantes cuites en 3 minutes de chaque côté, sans four.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200 text-center">
                <span className="text-3xl font-black text-[#2E7D52]">9,90 €</span>
                <p className="text-[11px] text-gray-500 mt-1">Paiement unique — carte déjà enregistrée</p>
              </div>

              <button
                onClick={handleAccept}
                className="w-full h-14 bg-[#2E7D52] hover:bg-[#256a44] active:scale-[0.99] text-white rounded-xl font-black text-base shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-current" />
                OUI, JE VEUX CETTE OFFRE POUR 9,90€
              </button>

              <button
                onClick={() => goToDownloads()}
                className="w-full mt-3.5 text-center text-xs text-gray-500 hover:text-gray-800 underline transition-colors py-2 cursor-pointer"
              >
                Non merci, je passe directement à mes téléchargements.
              </button>
            </div>
          </article>
        )}

        {state === "authenticating" && (
          <div className="bg-white rounded-2xl border border-blue-200 p-8 text-center shadow-md">
            <Lock className="w-12 h-12 text-[#2E7D52] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Confirmez avec votre banque</h2>
            <p className="text-xs text-gray-600">Approuvez la demande de votre banque pour finaliser — pas besoin de ressaisir votre carte.</p>
          </div>
        )}

        {state === "processing" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-md">
            <Loader2 className="w-12 h-12 text-[#2E7D52] mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Ajout en cours...</h2>
            <p className="text-xs text-gray-500">Merci de ne pas rafraîchir.</p>
          </div>
        )}

        {state === "success" && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-md">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Ajouté !</h2>
            <p className="text-xs text-gray-600">Redirection vers vos téléchargements...</p>
          </div>
        )}

        {state === "failed" && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-md">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Impossible d'ajouter cet article</h2>
            <p className="text-xs text-gray-600 mb-4">{errorMessage}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={payByCard} className="bg-[#2E7D52] text-white hover:bg-[#256a44] rounded-xl text-sm py-5 font-bold">
                Ajouter — payer par carte (9,90€)
              </Button>
              <Button variant="outline" onClick={() => setState("offer")} className="rounded-xl text-xs py-4 font-semibold">
                Réessayer en 1 clic
              </Button>
              <Button variant="ghost" onClick={() => goToDownloads()} className="text-xs text-gray-500 hover:text-gray-700">
                Non merci, continuer
              </Button>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
            <span className="flex items-center gap-1 font-semibold text-gray-500">
              <Lock className="w-3.5 h-3.5" /> Paiement 256-bit SSL
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5" /> Garantie Satisfait ou Remboursé
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
