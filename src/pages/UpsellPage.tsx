import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Zap, ArrowRight } from "lucide-react";
import cashpayLogoFull from "@/assets/cashpay-logo-full.png";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { useUtmifyScript } from "@/hooks/useUtmifyScript";

interface FlowStep {
  id: string;
  product_name: string;
  product_description: string | null;
  amount: number;
  image_url: string | null;
  step_type: string;
  accept_step_id: string | null;
  decline_step_id: string | null;
  accept_redirect_url: string | null;
  decline_redirect_url: string | null;
  payment_link_id: string;
  button_accept_text: string;
  button_accept_color: string;
  button_decline_text: string;
  button_decline_color: string;
  show_accept_button: boolean;
  show_decline_button: boolean;
  page_headline: string | null;
  page_subheadline: string | null;
}

type UpsellState = "offer" | "processing" | "success" | "failed";

const translations = {
  pt: {
    exclusiveOffer: "Oferta exclusiva — disponivel apenas agora!",
    specialOffer: "Oferta Especial",
    recommendedUpgrade: "Upgrade Recomendado",
    specialPrice: "Preco especial por tempo limitado",
    addForOnly: "Adicione por apenas",
    singlePayment: "Pagamento unico - Cobrado no mesmo cartao",
    defaultAccept: "SIM! Eu quero!",
    defaultDecline: "Nao, obrigado. Nao quero esta oferta.",
    processing: "Processando pagamento...",
    processingDesc: "Cobrando no mesmo cartao. Aguarde um momento.",
    purchaseSuccess: "Compra realizada!",
    addedSuccess: "adicionado com sucesso.",
    paymentFailed: "Pagamento falhou",
    tryAgain: "Tentar novamente",
    continueWithout: "Continuar sem esta oferta",
    continue: "Continuar",
  },
  en: {
    exclusiveOffer: "Exclusive offer — available only now!",
    specialOffer: "Special Offer",
    recommendedUpgrade: "Recommended Upgrade",
    specialPrice: "Special price for a limited time",
    addForOnly: "Add for only",
    singlePayment: "One-time payment - Charged to the same card",
    defaultAccept: "YES! I want it!",
    defaultDecline: "No thanks. I don't want this offer.",
    processing: "Processing payment...",
    processingDesc: "Charging to the same card. Please wait.",
    purchaseSuccess: "Purchase complete!",
    addedSuccess: "added successfully.",
    paymentFailed: "Payment failed",
    tryAgain: "Try again",
    continueWithout: "Continue without this offer",
    continue: "Continue",
  },
};

export default function UpsellPage() {
  const { stepId } = useParams<{ stepId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const txId = searchParams.get("tx");
  const linkId = searchParams.get("link");
  const isEmbed = searchParams.get("embed") === "true";

  // Capture tracking params from URL to pass to one-click-upsell
  const trackingParams = {
    src: searchParams.get("src") || searchParams.get("ref") || null,
    sck: searchParams.get("sck") || null,
    utm_source: searchParams.get("utm_source") || null,
    utm_campaign: searchParams.get("utm_campaign") || null,
    utm_medium: searchParams.get("utm_medium") || null,
    utm_content: searchParams.get("utm_content") || null,
    utm_term: searchParams.get("utm_term") || null,
  };

  const [step, setStep] = useState<FlowStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UpsellState>("offer");
  const [errorMessage, setErrorMessage] = useState("");
  const [currency, setCurrency] = useState("ZAR");
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [countdown, setCountdown] = useState(15);
  const [pixelId, setPixelId] = useState<string | null>(null);

  // Facebook Pixel tracking
  const { trackPurchase } = useFacebookPixel(pixelId);

  // UTMify tracking script
  useUtmifyScript();

  // Auto-resize for embed mode
  useEffect(() => {
    if (!isEmbed) return;
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "cashpay-resize", height }, "*");
    };
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isEmbed, state]);

  useEffect(() => {
    if (stepId) {
      // Reset state when navigating between upsell steps
      setState("offer");
      setLoading(true);
      setErrorMessage("");
      setCountdown(15);
      fetchStep();
    }
  }, [stepId]);

  // Countdown timer for urgency
  useEffect(() => {
    if (state !== "offer") return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 15 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);

  const t = translations[lang];

  const fetchStep = async () => {
    try {
      const { data, error } = await supabase
        .from("flow_steps")
        .select("*")
        .eq("id", stepId)
        .maybeSingle();

      if (error || !data) {
        goToThankYou();
        return;
      }

      setStep(data as unknown as FlowStep);

      // Fetch currency, language and pixel from payment link
      const { data: linkData } = await supabase
        .from("payment_links")
        .select("currency, checkout_language, facebook_pixel_id")
        .eq("id", data.payment_link_id)
        .maybeSingle();

      if (linkData) {
        setCurrency(linkData.currency || "ZAR");
        setLang(linkData.checkout_language === "en" ? "en" : "pt");
        if (linkData.facebook_pixel_id) {
          setPixelId(linkData.facebook_pixel_id);
        }
      }
    } catch {
      goToThankYou();
    } finally {
      setLoading(false);
    }
  };

  /** Convert internal paths to full CashPay URLs for embed mode */
  const toFullUrl = (path: string) => {
    if (isEmbed) {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

  const buildInternalPath = (basePath: string) => {
    const params = new URLSearchParams();
    if (txId) params.set("tx", txId);
    if (linkId) params.set("link", linkId);
    if (isEmbed) params.set("embed", "true");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const doRedirect = (url: string, isExternal: boolean) => {
    if (isExternal) {
      window.open(url, "_blank");
    } else {
      const fullUrl = isEmbed ? `${window.location.origin}${url}` : url;
      window.open(fullUrl, "_blank");
    }
  };

  const goToThankYou = () => {
    const path = buildInternalPath(`/thank-you/${linkId || "default"}`);
    doRedirect(toFullUrl(path), false);
  };

  /** Redirect based on redirect_url or step_id — always appending cashpay params */
  const redirectTo = async (nextStepId: string | null, redirectUrl: string | null) => {
    if (redirectUrl) {
      const separator = redirectUrl.includes("?") ? "&" : "?";
      const fullUrl = `${redirectUrl}${separator}cashpay_tx=${txId || ""}&cashpay_link=${linkId || ""}`;
      doRedirect(fullUrl, true);
    } else if (nextStepId) {
      try {
        const { data: nextStep } = await supabase
          .from("flow_steps")
          .select("page_url")
          .eq("id", nextStepId)
          .maybeSingle();

        const pageUrl = nextStep?.page_url;
        if (pageUrl) {
          const separator = pageUrl.includes("?") ? "&" : "?";
          const externalUrl = `${pageUrl}${separator}cashpay_tx=${txId || ""}&cashpay_link=${linkId || ""}`;
          doRedirect(externalUrl, true);
        } else {
          const path = buildInternalPath(`/upsell/${nextStepId}`);
          doRedirect(toFullUrl(path), false);
        }
      } catch {
        const path = buildInternalPath(`/upsell/${nextStepId}`);
        doRedirect(toFullUrl(path), false);
      }
    } else {
      goToThankYou();
    }
  };

  const handleAccept = async () => {
    if (!step || !txId) return;
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
          body: JSON.stringify({
            parent_transaction_id: txId,
            flow_step_id: step.id,
            tracking_params: trackingParams,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Fire Facebook Pixel Purchase event for the upsell
        trackPurchase(Number(step.amount), currency, result.transaction_id || undefined);
        redirectTo(step.accept_step_id, step.accept_redirect_url);
      } else {
        setErrorMessage(result.error || "Payment failed");
        setState("failed");
      }
    } catch (err) {
      console.error("Upsell error:", err);
      setErrorMessage("Connection error. Please try again.");
      setState("failed");
    }
  };

  const handleDecline = () => {
    if (!step) {
      goToThankYou();
      return;
    }
    redirectTo(step.decline_step_id, step.decline_redirect_url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!step) {
    return null;
  }

  const locale = currency === "ZAR" ? "en-ZA" : "pt-MZ";
  const isDownsell = step.step_type === "downsell";

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Urgency Bar */}
        {state === "offer" && (
          <div className="bg-destructive text-white text-center py-2.5 px-4 rounded-t-2xl text-sm font-semibold animate-pulse">
            {t.exclusiveOffer}
          </div>
        )}

        <div className="bg-card rounded-b-3xl rounded-t-none shadow-xl shadow-muted-foreground/5 overflow-hidden border border-border border-t-0">
          {state === "offer" && (
            <div className="p-6 md:p-8">
              {/* Badge */}
              <div className="flex justify-center mb-4">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isDownsell
                    ? "bg-blue-500/10 text-blue-600"
                    : "bg-primary/10 text-primary"
                }`}>
                  {isDownsell ? t.specialOffer : t.recommendedUpgrade}
                </span>
              </div>

              {/* Custom Headline */}
              {step.page_headline && (
                <h2 className="text-lg font-bold text-foreground text-center mb-2">
                  {step.page_headline}
                </h2>
              )}
              {step.page_subheadline && (
                <p className="text-sm text-muted-foreground text-center mb-4">
                  {step.page_subheadline}
                </p>
              )}

              {/* Product Image */}
              {step.image_url && (
                <div className="mb-6">
                  <img
                    src={step.image_url}
                    alt={step.product_name}
                    className="w-full h-48 object-cover rounded-xl"
                  />
                </div>
              )}

              {/* Product Info */}
              <h1 className="text-2xl font-bold text-foreground text-center mb-3">
                {step.product_name}
              </h1>

              {step.product_description && (
                <p className="text-muted-foreground text-center mb-6 leading-relaxed">
                  {step.product_description}
                </p>
              )}

              {/* Price */}
              <div className="bg-muted/50 rounded-xl p-6 mb-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {isDownsell ? t.specialPrice : t.addForOnly}
                </p>
                <p className="text-4xl font-bold text-primary">
                  {currency} {Number(step.amount).toLocaleString(locale, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t.singlePayment}
                </p>
              </div>

              {/* One-Click CTA */}
              {step.show_accept_button && (
                <button
                  onClick={handleAccept}
                  className="w-full h-14 text-lg rounded-xl text-white font-bold shadow-lg active:scale-[0.98] transition-all group relative overflow-hidden"
                  style={{ backgroundColor: step.button_accept_color }}
                >
                  <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    {step.button_accept_text || t.defaultAccept}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              )}

              {/* Decline */}
              {step.show_decline_button && (
                <button
                  onClick={handleDecline}
                  className="w-full mt-4 text-center text-sm font-medium transition-colors py-2.5 rounded-lg border-2"
                  style={{ color: step.button_decline_color, borderColor: step.button_decline_color }}
                >
                  {step.button_decline_text || t.defaultDecline}
                </button>
              )}

              {/* Fallback if both buttons hidden */}
              {!step.show_accept_button && !step.show_decline_button && (
                <button
                  onClick={handleDecline}
                  className="w-full mt-4 text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  {t.continue} →
                </button>
              )}
            </div>
          )}

          {state === "processing" && (
            <div className="p-8 text-center">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold mb-2 text-foreground">
                {t.processing}
              </h2>
              <p className="text-muted-foreground">
                {t.processingDesc}
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">
                {t.purchaseSuccess}
              </h2>
              <p className="text-muted-foreground">
                {step.product_name} {t.addedSuccess}
              </p>
            </div>
          )}

          {state === "failed" && (
            <div className="p-8 text-center">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2 text-foreground">
                {t.paymentFailed}
              </h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setState("offer")} className="gradient-primary text-white rounded-lg">
                  {t.tryAgain}
                </Button>
                <Button variant="outline" onClick={handleDecline} className="rounded-lg">
                  {t.continueWithout}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <img src={cashpayLogoFull} alt="Cashpay" className="h-7 mx-auto opacity-60" />
        </div>
      </div>
    </div>
  );
}
