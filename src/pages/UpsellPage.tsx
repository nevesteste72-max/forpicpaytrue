import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  ArrowRight, 
  Package, 
  Truck, 
  ShieldCheck, 
  Clock, 
  Star, 
  Lock, 
  Sparkles,
  AlertCircle
} from "lucide-react";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { useUtmifyScript, getStoredTracking } from "@/hooks/useUtmifyScript";
import { cn } from "@/lib/utils";
import { getStripePromise } from "@/lib/stripeClient";

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

type UpsellState = "offer" | "processing" | "authenticating" | "success" | "failed";

export default function UpsellPage() {
  const { stepId } = useParams<{ stepId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const txId = searchParams.get("tx");
  const linkId = searchParams.get("link");
  const isEmbed = searchParams.get("embed") === "true";

  // Capture tracking params from URL + sessionStorage
  const trackingParams = (() => {
    const stored = getStoredTracking();
    const fromUrl = {
      src: searchParams.get("src") || searchParams.get("ref") || null,
      sck: searchParams.get("sck") || null,
      utm_source: searchParams.get("utm_source") || null,
      utm_campaign: searchParams.get("utm_campaign") || null,
      utm_medium: searchParams.get("utm_medium") || null,
      utm_content: searchParams.get("utm_content") || null,
      utm_term: searchParams.get("utm_term") || null,
    };
    return {
      src: fromUrl.src || stored.src || null,
      sck: fromUrl.sck || stored.sck || null,
      utm_source: fromUrl.utm_source || stored.utm_source || null,
      utm_campaign: fromUrl.utm_campaign || stored.utm_campaign || null,
      utm_medium: fromUrl.utm_medium || stored.utm_medium || null,
      utm_content: fromUrl.utm_content || stored.utm_content || null,
      utm_term: fromUrl.utm_term || stored.utm_term || null,
    };
  })();

  const [step, setStep] = useState<FlowStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UpsellState>("offer");
  const [errorMessage, setErrorMessage] = useState("");
  const [currency, setCurrency] = useState("ZAR");
  const [countdown, setCountdown] = useState(180); // 3 minutes urgency
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);

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
      setState("offer");
      setLoading(true);
      setErrorMessage("");
      fetchStep();
    }
  }, [stepId]);

  // Urgency timer
  useEffect(() => {
    if (state !== "offer") return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

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

      // Fetch currency and pixel from payment link
      const { data: linkData } = await supabase
        .from("payment_links")
        .select("currency, facebook_pixel_id")
        .eq("id", data.payment_link_id)
        .maybeSingle();

      if (linkData) {
        setCurrency(linkData.currency || "ZAR");
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
      window.location.href = url;
    } else {
      const fullUrl = isEmbed ? `${window.location.origin}${url}` : url;
      window.location.href = fullUrl;
    }
  };

  const goToThankYou = () => {
    const targetLink = linkId || step?.payment_link_id || "";
    const path = buildInternalPath(`/thank-you/${targetLink}`);
    doRedirect(toFullUrl(path), false);
  };

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
    if (!step) return;
    if (!txId || txId === "preview") {
      // No saved card to charge off-session -> send to this product's own checkout page
      const upsellLinkId = step.payment_link_id;
      const qParams = new URLSearchParams();
      const qName = searchParams.get("name");
      const qEmail = searchParams.get("email");
      const qPhone = searchParams.get("phone");
      if (qName) qParams.set("name", qName);
      if (qEmail) qParams.set("email", qEmail);
      if (qPhone) qParams.set("phone", qPhone);
      const queryStr = qParams.toString() ? `?${qParams.toString()}` : "";
      window.location.href = buildInternalPath(`/pay/${upsellLinkId}${queryStr}`);
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
          body: JSON.stringify({
            parent_transaction_id: txId,
            flow_step_id: step.id,
            tracking_params: trackingParams,
          }),
        }
      );

      let result = await response.json();

      // The bank wants the cardholder to approve (OTP / banking app). Run that
      // challenge right here so the buyer never has to re-enter the card.
      if (result.requires_action && result.client_secret) {
        setState("authenticating");
        const stripe = await getStripePromise();
        if (!stripe) {
          setErrorMessage("Could not start card authentication.");
          setState("failed");
          return;
        }

        const { error: actionError } = await stripe.handleNextAction({
          clientSecret: result.client_secret,
        });

        if (actionError) {
          setErrorMessage(actionError.message || "Card authentication was not completed.");
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
        trackPurchase(Number(step.amount), currency, result.transaction_id || undefined);
        setState("success");
        setTimeout(() => {
          if (step.accept_redirect_url) {
            redirectTo(step.accept_step_id, step.accept_redirect_url);
          } else {
            goToThankYou();
          }
        }, 1200);
      } else {
        setErrorMessage(result.error || "1-Click authorization failed. Please proceed to order confirmation.");
        setState("failed");
      }
    } catch (err) {
      console.error("Upsell error:", err);
      setErrorMessage("Connection timeout. Redirecting to your confirmation.");
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
      <div className="min-h-screen bg-[#f4f5f7] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <Loader2 className="w-10 h-10 animate-spin text-[#0b72e7] mx-auto mb-4" />
          <p className="text-sm font-semibold text-gray-800">Securing your order confirmation...</p>
          <p className="text-xs text-gray-500 mt-1">Connecting to express dispatch center</p>
        </div>
      </div>
    );
  }

  if (!step) {
    return null;
  }

  // Same product, same price, but paid on a normal checkout page. Used when
  // the off-session 1-click charge is declined (typically 3DS/SCA) or tested.
  const upsellCheckoutLink = "e1919191-1919-4919-8919-191919191919";
  const payByCard = () => {
    const qParams = new URLSearchParams();
    const qName = searchParams.get("name");
    const qEmail = searchParams.get("email");
    const qPhone = searchParams.get("phone");
    if (qName) qParams.set("name", qName);
    if (qEmail) qParams.set("email", qEmail);
    if (qPhone) qParams.set("phone", qPhone);
    if (txId && txId !== "preview") qParams.set("parent_tx", txId);
    const queryStr = qParams.toString() ? `?${qParams.toString()}` : "";
    window.location.href = buildInternalPath(`/pay/${upsellCheckoutLink}${queryStr}`);
  };

  // Calculate comparative regular price for clearance display
  // Takealot reference price is R 285 ZAR, our special sale price is R 99 ZAR (65% OFF)
  const is99Upsell = Number(step.amount) === 99;
  const regularPrice = is99Upsell ? 285 : Number(step.amount) === 597 ? 2899 : 3499;
  const savingsAmount = regularPrice - Number(step.amount);
  const discountPercent = Math.round((savingsAmount / regularPrice) * 100);

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900 font-sans pb-12">
      <main className="max-w-xl mx-auto px-4 pt-4 md:pt-6">
        {/* Real-time Order Feedback Banner */}
        <section className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide uppercase">Payment Verified & Approved</p>
                <p className="text-xs text-white/90">Your initial order has been successfully placed!</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded text-[11px] font-mono shrink-0">
              <Clock className="w-3 h-3 text-amber-300" />
              <span>{formatTimer(countdown)}</span>
            </div>
          </div>

          {/* 3-Step Live Dispatch Timeline */}
          <div className="p-4 bg-gray-50/70 border-b border-gray-100">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-6 right-6 top-3.5 h-0.5 bg-gray-200 -z-0" />
              
              {/* Step 1: Paid */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs">
                  ✓
                </div>
                <span className="text-[11px] font-bold text-gray-700 mt-1">Payment</span>
                <span className="text-[9px] text-emerald-600 font-semibold">Done</span>
              </div>

              {/* Step 2: Packaging (Current Active) */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-7 h-7 rounded-full bg-[#0b72e7] text-white flex items-center justify-center text-xs shadow-md animate-pulse">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-[#0b72e7] mt-1">Packaging</span>
                <span className="text-[9px] text-[#0b72e7] font-semibold animate-pulse">In Progress...</span>
              </div>

              {/* Step 3: Dispatch */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-gray-400 mt-1">Dispatch</span>
                <span className="text-[9px] text-gray-400">Next</span>
              </div>
            </div>
          </div>

          {/* Urgent Opportunity Notice */}
          <div className="p-4 bg-amber-50/70 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-bold">Wait! Do not close or refresh this window.</strong> Your package is currently open at our Johannesburg distribution hub. Before final sealing, you can add this matching item into your parcel with <span className="underline font-bold">ZERO additional delivery fees</span>.
            </p>
          </div>
        </section>

        {/* Upsell Offer Container */}
        {state === "offer" && (
          <article className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            {/* Deal Badge Header */}
            <div className="bg-[#0b72e7] text-white py-2 px-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Exclusive Dispatch Upgrade
              </span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">
                Save {discountPercent}% OFF
              </span>
            </div>

            <div className="p-5 md:p-6">
              {/* Product Headline */}
              <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight mb-2">
                {step.product_name}
              </h1>

              {/* Reviews & Social Proof */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-700">4.8</span>
                <span className="text-xs text-gray-500">(1,842 verified customer reviews)</span>
              </div>

              {/* Product Image - Mobile-first uncropped showcase */}
              {step.image_url && (() => {
                const is19Pc = step.product_name?.toLowerCase().includes("19-piece") || step.image_url?.includes("upsell-19pc");
                const isAirFryer = !is19Pc && step.product_name?.toLowerCase().includes("air fryer");
                const galleryImages = is19Pc
                  ? [step.image_url || "/assets/upsell-19pc.png"]
                  : isAirFryer
                    ? ["/images/air_1.png", "/images/air_2.png", "/images/air_3.png"]
                    : [step.image_url || "/images/p1.png"];
                const activeImg = galleryImages[selectedImgIdx] || step.image_url;

                return (
                  <div className="mb-5">
                    {/* Clean badge row ABOVE the product image - nothing overlaps the product */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-xs">
                        🔥 -{discountPercent}% OFF {is99Upsell ? "TAKEALOT PRICE" : "CLEARANCE"}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        In Stock • JHB Hub
                      </span>
                    </div>

                    {/* Uncropped Product Display Container */}
                    <div className="w-full bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 flex items-center justify-center shadow-xs">
                      <img
                        src={activeImg}
                        alt={step.product_name}
                        className="w-auto h-auto max-h-[300px] sm:max-h-[360px] max-w-full object-contain block mx-auto"
                        style={{ maxHeight: "300px", width: "auto", maxWidth: "100%" }}
                        loading="eager"
                      />
                    </div>

                    {/* Interactive Angle Selectors for multi-angle view */}
                    {galleryImages.length > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        {galleryImages.map((img, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedImgIdx(idx)}
                            className={cn(
                              "w-14 h-14 rounded-xl border-2 p-1 bg-white transition-all flex items-center justify-center cursor-pointer",
                              selectedImgIdx === idx
                                ? "border-[#0b72e7] shadow-xs ring-2 ring-[#0b72e7]/20"
                                : "border-gray-200 opacity-60 hover:opacity-100"
                            )}
                          >
                            <img src={img} alt="" className="max-h-full max-w-full object-contain" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Product Highlights */}
              <div className="bg-blue-50/60 rounded-xl p-4 mb-5 border border-blue-100">
                <p className="text-xs text-gray-700 leading-relaxed font-medium mb-3">
                  {step.product_description}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#0b72e7]" />
                    <span>Combined Free Courier</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2-Year Full Warranty</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>100% Genuine Retail Pack</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Instant 1-Click Addition</span>
                  </div>
                </div>
              </div>

              {/* Pricing Breakdown Box */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-500 line-through">
                    {is99Upsell ? "Takealot List Price: R 285.00" : `Standard List Price: R ${regularPrice.toFixed(2)}`}
                  </span>
                  <span className="text-xs font-bold text-red-600">
                    You Save: R {savingsAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase">Special Dispatch Price:</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-[#178a3b]">
                      R {Number(step.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 text-center">
                  One-time charge billed to your card on file • Zero extra shipping fees
                </p>
              </div>

              {/* 1-Click Buy Action Button */}
              <button
                onClick={handleAccept}
                className="w-full h-14 bg-[#178a3b] hover:bg-[#147633] active:scale-[0.99] text-white rounded-xl font-black text-base shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-current" />
                <span>YES! ADD TO MY PACKAGE — R {Number(step.amount).toFixed(0)}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              {/* Decline Button */}
              <button
                onClick={handleDecline}
                className="w-full mt-3.5 text-center text-xs text-gray-500 hover:text-gray-800 underline transition-colors py-2 cursor-pointer"
              >
                No thank you, please dispatch only my original order without this item
              </button>
            </div>
          </article>
        )}

        {/* Processing State with Animated Feedback */}
        {state === "authenticating" && (
          <div className="bg-white rounded-2xl border border-blue-200 p-8 text-center shadow-md">
            <Lock className="w-12 h-12 text-[#0b72e7] mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Approve with your bank
            </h2>
            <p className="text-xs text-gray-600">
              Your bank is asking you to confirm this addition. Approve the prompt
              (SMS code or your banking app) to finish — no need to re-enter your card.
            </p>
            <p className="text-[11px] text-gray-400 mt-3">Please do not close this page.</p>
          </div>
        )}

        {state === "processing" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-md">
            <Loader2 className="w-12 h-12 text-[#0b72e7] mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Adding to your package...
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Authorizing 1-Click addition with your bank. Please do not refresh.
            </p>
            <div className="w-48 h-1.5 bg-gray-100 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-[#0b72e7] rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Success State */}
        {state === "success" && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-md">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Item Added to Your Parcel!
            </h2>
            <p className="text-xs text-gray-600">
              {step.product_name} has been added to your combined shipment.
            </p>
            <p className="text-[11px] text-gray-400 mt-2">
              Redirecting to your order confirmation summary...
            </p>
          </div>
        )}

        {/* Failed State */}
        {state === "failed" && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-md">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Could Not Add Item
            </h2>
            <p className="text-xs text-gray-600 mb-4">{errorMessage}</p>
            <p className="text-[11px] text-gray-500 mb-4">
              Your bank asked for extra confirmation, so the saved card could not be
              charged automatically. You can still add it by entering your card below —
              same price, same delivery.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={payByCard} className="bg-[#178a3b] text-white hover:bg-[#147633] rounded-xl text-sm py-5 font-bold">
                Add it — pay by card (R {Number(step.amount).toFixed(0)})
              </Button>
              <Button variant="outline" onClick={() => setState("offer")} className="rounded-xl text-xs py-4 font-semibold">
                Try 1-Click Again
              </Button>
              <Button variant="ghost" onClick={handleDecline} className="text-xs text-gray-500 hover:text-gray-700">
                No thanks, continue to my order confirmation
              </Button>
            </div>
          </div>
        )}

        {/* Trust Badges Footer */}
        <footer className="mt-8 text-center">
          <div className="flex items-center justify-center gap-4 text-gray-400 text-xs mb-3">
            <span className="flex items-center gap-1 font-semibold text-gray-500">
              <Lock className="w-3.5 h-3.5 text-gray-600" />
              256-Bit SSL Secured
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-600" />
              Quality Guarantee
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            © 2026 Combined Express Warehouse Dispatch • All Rights Reserved
          </p>
        </footer>
      </main>
    </div>
  );
}
