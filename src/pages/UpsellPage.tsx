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
  checkout_link_id: string | null;
  button_accept_text: string;
  button_accept_color: string;
  button_decline_text: string;
  button_decline_color: string;
  show_accept_button: boolean;
  show_decline_button: boolean;
  page_headline: string | null;
  page_subheadline: string | null;
}

const FALLBACK_STEPS: Record<string, FlowStep> = {
  // Upsell #1: 19-Piece Chef Knife & Silicone Kitchen Utensil Set (R99 - Physical Products)
  "88888888-8888-4888-8888-888888888881": {
    id: "88888888-8888-4888-8888-888888888881",
    product_name: "19-Piece Chef Knife & Silicone Kitchen Utensil Set with Organizer",
    product_description: "Complete 19-Piece Chef Collection featuring 5 Precision Black Stainless Steel Chef Knives with Rose Gold Accents, Kitchen Shears, Heavy-Duty Cutting Board, 11 Heat-Resistant Non-Stick Silicone Utensils with Natural Wooden Handles, and Matte Black Countertop Dual Storage Organizer. Added directly to your delivery parcel with Free Shipping.",
    amount: 99,
    image_url: "/assets/upsell-19pc.png",
    step_type: "upsell",
    accept_step_id: null,
    decline_step_id: null,
    accept_redirect_url: null,
    decline_redirect_url: null,
    payment_link_id: "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34",
    checkout_link_id: "e1919191-1919-4919-8919-191919191919",
    button_accept_text: "YES! ADD 19-PIECE CHEF SET (R99)",
    button_accept_color: "#10b981",
    button_decline_text: "No thanks, I will skip this special R99 offer and proceed to my order",
    button_decline_color: "#6b7280",
    show_accept_button: true,
    show_decline_button: true,
    page_headline: "EXCLUSIVE WAREHOUSE UPGRADE: Add 19-Piece Chef Collection for ONLY R99!",
    page_subheadline: "Special Warehouse Clearance: Add the full 19-Piece Precision Knife Set, Heat-Resistant Silicone Utensils, Cutting Board & Organizer Bucket to your delivery package for just R99 (Save R1,899 Today)."
  },
  "11111111-1111-4111-8111-111111111111": {
    id: "11111111-1111-4111-8111-111111111111",
    product_name: "19-Piece Chef Knife & Silicone Kitchen Utensil Set with Organizer",
    product_description: "Complete 19-Piece Chef Collection featuring 5 Precision Black Stainless Steel Chef Knives with Rose Gold Accents, Kitchen Shears, Heavy-Duty Cutting Board, 11 Heat-Resistant Non-Stick Silicone Utensils with Natural Wooden Handles, and Matte Black Countertop Dual Storage Organizer. Added directly to your delivery parcel with Free Shipping.",
    amount: 99,
    image_url: "/assets/upsell-19pc.png",
    step_type: "upsell",
    accept_step_id: null,
    decline_step_id: null,
    accept_redirect_url: null,
    decline_redirect_url: null,
    payment_link_id: "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34",
    checkout_link_id: "e1919191-1919-4919-8919-191919191919",
    button_accept_text: "YES! ADD 19-PIECE CHEF SET (R99)",
    button_accept_color: "#10b981",
    button_decline_text: "No thanks, I will skip this special R99 offer and proceed to my order",
    button_decline_color: "#6b7280",
    show_accept_button: true,
    show_decline_button: true,
    page_headline: "EXCLUSIVE WAREHOUSE UPGRADE: Add 19-Piece Chef Collection for ONLY R99!",
    page_subheadline: "Special Warehouse Clearance: Add the full 19-Piece Precision Knife Set, Heat-Resistant Silicone Utensils, Cutting Board & Organizer Bucket to your delivery package for just R99 (Save R1,899 Today)."
  },
  "22222222-2222-4222-8222-222222222222": {
    id: "22222222-2222-4222-8222-222222222222",
    product_name: "19-Piece Chef Knife & Silicone Kitchen Utensil Set with Organizer",
    product_description: "Complete 19-Piece Chef Collection featuring 5 Precision Black Stainless Steel Chef Knives with Rose Gold Accents, Kitchen Shears, Heavy-Duty Cutting Board, 11 Heat-Resistant Non-Stick Silicone Utensils with Natural Wooden Handles, and Matte Black Countertop Dual Storage Organizer. Added directly to your delivery parcel with Free Shipping.",
    amount: 99,
    image_url: "/assets/upsell-19pc.png",
    step_type: "upsell",
    accept_step_id: null,
    decline_step_id: null,
    accept_redirect_url: null,
    decline_redirect_url: null,
    payment_link_id: "4b585d8e-6df4-4019-8ca0-2a32b8e68844",
    checkout_link_id: "e1919191-1919-4919-8919-191919191919",
    button_accept_text: "YES! ADD 19-PIECE CHEF SET (R99)",
    button_accept_color: "#10b981",
    button_decline_text: "No thanks, I will skip this special R99 offer and proceed to my order",
    button_decline_color: "#6b7280",
    show_accept_button: true,
    show_decline_button: true,
    page_headline: "EXCLUSIVE WAREHOUSE UPGRADE: Add 19-Piece Chef Collection for ONLY R99!",
    page_subheadline: "Special Warehouse Clearance: Add the full 19-Piece Precision Knife Set, Heat-Resistant Silicone Utensils, Cutting Board & Organizer Bucket to your delivery package for just R99 (Save R1,899 Today)."
  },
  "33333333-3333-4333-8333-333333333333": {
    id: "33333333-3333-4333-8333-333333333333",
    product_name: "19-Piece Chef Knife & Silicone Kitchen Utensil Set with Organizer",
    product_description: "Complete 19-Piece Chef Collection featuring 5 Precision Black Stainless Steel Chef Knives with Rose Gold Accents, Kitchen Shears, Heavy-Duty Cutting Board, 11 Heat-Resistant Non-Stick Silicone Utensils with Natural Wooden Handles, and Matte Black Countertop Dual Storage Organizer. Added directly to your delivery parcel with Free Shipping.",
    amount: 99,
    image_url: "/assets/upsell-19pc.png",
    step_type: "upsell",
    accept_step_id: null,
    decline_step_id: null,
    accept_redirect_url: null,
    decline_redirect_url: null,
    payment_link_id: "57300a28-4553-4bb4-9586-06941387717d",
    checkout_link_id: "e1919191-1919-4919-8919-191919191919",
    button_accept_text: "YES! ADD 19-PIECE CHEF SET (R99)",
    button_accept_color: "#10b981",
    button_decline_text: "No thanks, I will skip this special R99 offer and proceed to my order",
    button_decline_color: "#6b7280",
    show_accept_button: true,
    show_decline_button: true,
    page_headline: "EXCLUSIVE WAREHOUSE UPGRADE: Add 19-Piece Chef Collection for ONLY R99!",
    page_subheadline: "Special Warehouse Clearance: Add the full 19-Piece Precision Knife Set, Heat-Resistant Silicone Utensils, Cutting Board & Organizer Bucket to your delivery package for just R99 (Save R1,899 Today)."
  },
  // Upsell #1: VIP Inner Circle & Automation Suite (R247 - Digital)
  "77777777-7777-4777-8777-777777777771": {
    id: "77777777-7777-4777-8777-777777777771",
    product_name: "Lifetime VIP Access Upgrade & 2026 Automation Pack",
    product_description: "Unlock instant access to our automated store launcher, 150+ direct factory WhatsApp contacts in Joburg & Durban, and pre-negotiated PEP Paxi bulk shipping discounts.",
    amount: 247,
    image_url: "/sa_vip_upsell.jpg",
    step_type: "upsell",
    accept_step_id: "77777777-7777-4777-8777-777777777772",
    decline_step_id: "77777777-7777-4777-8777-777777777772",
    accept_redirect_url: null,
    decline_redirect_url: null,
    payment_link_id: "a7777777-7777-4777-8777-777777777777",
    checkout_link_id: "d2472472-2472-4472-8472-247247247247",
    button_accept_text: "YES! UPGRADE TO VIP INNER CIRCLE (R247)",
    button_accept_color: "#0b72e7",
    button_decline_text: "No thanks, I will manage suppliers and store setup manually",
    button_decline_color: "#6b7280",
    show_accept_button: true,
    show_decline_button: true,
    page_headline: "UPGRADE YOUR ORDER: Unlock Automated WhatsApp Store Builder & VIP Supplier Direct Line",
    page_subheadline: "Get 1-Click Access to 150+ Direct WhatsApp Wholesalers, Ready-Made Product Catalogs & Priority Dispatch Channels."
  },
  // Downsell #2: Core Fast-Track Pack (R147 - Digital)
  "77777777-7777-4777-8777-777777777772": {
    id: "77777777-7777-4777-8777-777777777772",
    product_name: "Lifetime Access VIP License (Special R100 Off)",
    product_description: "Wait! Save R100 instantly. Get Lifetime Access with zero renewal fees forever, Core WhatsApp Automation, Top 10 High-Margin Direct Supplier Contacts, and the 2026 Sales Scriptbook for just R147.",
    amount: 147,
    image_url: "/sa_vip_downsell.jpg",
    step_type: "downsell",
    accept_step_id: null,
    decline_step_id: null,
    accept_redirect_url: null,
    decline_redirect_url: null,
    payment_link_id: "a7777777-7777-4777-8777-777777777777",
    checkout_link_id: "d1471471-1471-4471-8471-147147147147",
    button_accept_text: "YES! CLAIM SPECIAL R147 LIFETIME OFFER",
    button_accept_color: "#10b981",
    button_decline_text: "No thanks, I will skip this discount and proceed to my order",
    button_decline_color: "#6b7280",
    show_accept_button: true,
    show_decline_button: true,
    page_headline: "WAIT! SPECIAL ONE-TIME DOWNSELL: Get Lifetime Access Forever for Only R147",
    page_subheadline: "We understand R247 might be tight right now. Save R100 instantly and lock in Lifetime Access forever with Core WhatsApp Automation & Supplier Fast-Pass."
  }
};

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const fetchStep = async () => {
    try {
      if (stepId && FALLBACK_STEPS[stepId]) {
        setStep(FALLBACK_STEPS[stepId]);
        setCurrency("ZAR");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("flow_steps")
        .select("*")
        .eq("id", stepId)
        .maybeSingle();

      if (error || !data) {
        const isPhysicalLink = (linkId && (
          linkId === "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34" ||
          linkId === "4b585d8e-6df4-4019-8ca0-2a32b8e68844" ||
          linkId === "57300a28-4553-4bb4-9586-06941387717d" ||
          linkId === "e1919191-1919-4919-8919-191919191919"
        )) || (stepId && (
          stepId.startsWith("8888") || stepId.startsWith("1111") || stepId.startsWith("2222") || stepId.startsWith("3333")
        ));
        const fallbackKey = isPhysicalLink ? "88888888-8888-4888-8888-888888888881" : "77777777-7777-4777-8777-777777777771";
        if (FALLBACK_STEPS[fallbackKey]) {
          setStep(FALLBACK_STEPS[fallbackKey]);
          setCurrency("ZAR");
        } else {
          goToThankYou();
        }
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
      const isPhysicalLink = (linkId && (
        linkId === "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34" ||
        linkId === "4b585d8e-6df4-4019-8ca0-2a32b8e68844" ||
        linkId === "57300a28-4553-4bb4-9586-06941387717d" ||
        linkId === "e1919191-1919-4919-8919-191919191919"
      )) || (stepId && (
        stepId.startsWith("8888") || stepId.startsWith("1111") || stepId.startsWith("2222") || stepId.startsWith("3333")
      ));
      const fallbackKey = isPhysicalLink ? "88888888-8888-4888-8888-888888888881" : "77777777-7777-4777-8777-777777777771";
      if (FALLBACK_STEPS[fallbackKey]) {
        setStep(FALLBACK_STEPS[fallbackKey]);
        setCurrency("ZAR");
      } else {
        goToThankYou();
      }
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
    const qName = searchParams.get("name");
    const qEmail = searchParams.get("email");
    const qPhone = searchParams.get("phone");
    if (qName) params.set("name", qName);
    if (qEmail) params.set("email", qEmail);
    if (qPhone) params.set("phone", qPhone);
    if (trackingParams.utm_source) params.set("utm_source", trackingParams.utm_source);
    if (trackingParams.utm_medium) params.set("utm_medium", trackingParams.utm_medium);
    if (trackingParams.utm_campaign) params.set("utm_campaign", trackingParams.utm_campaign);
    if (trackingParams.utm_content) params.set("utm_content", trackingParams.utm_content);
    if (trackingParams.utm_term) params.set("utm_term", trackingParams.utm_term);
    if (trackingParams.src) params.set("src", trackingParams.src);
    if (trackingParams.sck) params.set("sck", trackingParams.sck);
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
    const isPhys = (stepId && (stepId.startsWith("8888") || stepId.startsWith("1111") || stepId.startsWith("2222") || stepId.startsWith("3333"))) ||
      (linkId && (
        linkId === "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34" ||
        linkId === "4b585d8e-6df4-4019-8ca0-2a32b8e68844" ||
        linkId === "57300a28-4553-4bb4-9586-06941387717d" ||
        linkId === "e1919191-1919-4919-8919-191919191919"
      ));
    const stepToLink: Record<string, string> = {
      "11111111-1111-4111-8111-111111111111": "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34",
      "22222222-2222-4222-8222-222222222222": "4b585d8e-6df4-4019-8ca0-2a32b8e68844",
      "33333333-3333-4333-8333-333333333333": "57300a28-4553-4bb4-9586-06941387717d",
    };
    const mappedLink = stepId ? stepToLink[stepId] : undefined;
    const defaultPhysicalLink = "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34";
    const defaultDigitalLink = "a7777777-7777-4777-8777-777777777777";
    const targetLink = linkId || mappedLink || step?.payment_link_id || (isPhys ? defaultPhysicalLink : defaultDigitalLink);
    const path = buildInternalPath(`/thank-you/${targetLink}`);
    doRedirect(toFullUrl(path), false);
  };

  const redirectTo = async (nextStepId: string | null, redirectUrl: string | null) => {
    if (redirectUrl) {
      const separator = redirectUrl.includes("?") ? "&" : "?";
      const fullUrl = `${redirectUrl}${separator}cashpay_tx=${txId || ""}&cashpay_link=${linkId || ""}`;
      doRedirect(fullUrl, true);
    } else if (nextStepId) {
      const path = buildInternalPath(`/upsell/${nextStepId}`);
      doRedirect(toFullUrl(path), false);
    } else {
      goToThankYou();
    }
  };

  const redirectToCheckout = () => {
    if (!step) return;
    const isPhysicalUpsell = step.id === "88888888-8888-4888-8888-888888888881" ||
      step.product_name?.toLowerCase().includes("19-piece") ||
      step.product_name?.toLowerCase().includes("cookware") ||
      is99Upsell;
    const isDownsell = step.step_type === "downsell" || step.id === "77777777-7777-4777-8777-777777777772";
    const upsellLinkId = step.checkout_link_id || (isPhysicalUpsell ? "e1919191-1919-4919-8919-191919191919" : isDownsell ? "d1471471-1471-4471-8471-147147147147" : "d2472472-2472-4472-8472-247247247247");
    const qParams = new URLSearchParams();
    const qName = searchParams.get("name");
    const qEmail = searchParams.get("email");
    const qPhone = searchParams.get("phone");
    if (qName) qParams.set("name", qName);
    if (qEmail) qParams.set("email", qEmail);
    if (qPhone) qParams.set("phone", qPhone);
    if (txId && txId !== "preview") qParams.set("parent_tx", txId);
    const parentLink = linkId || step.payment_link_id;
    if (parentLink) qParams.set("parent_link", parentLink);
    if (trackingParams.utm_source) qParams.set("utm_source", trackingParams.utm_source);
    if (trackingParams.utm_medium) qParams.set("utm_medium", trackingParams.utm_medium);
    if (trackingParams.utm_campaign) qParams.set("utm_campaign", trackingParams.utm_campaign);
    if (trackingParams.utm_content) qParams.set("utm_content", trackingParams.utm_content);
    if (trackingParams.utm_term) qParams.set("utm_term", trackingParams.utm_term);
    if (trackingParams.src) qParams.set("src", trackingParams.src);
    if (trackingParams.sck) qParams.set("sck", trackingParams.sck);

    const queryStr = qParams.toString() ? `?${qParams.toString()}` : "";
    const targetUrl = `/pay/${upsellLinkId}${queryStr}`;
    doRedirect(toFullUrl(targetUrl), false);
  };

  const handleAccept = async () => {
    if (!step) return;
    if (!txId || txId === "preview") {
      redirectToCheckout();
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
          redirectToCheckout();
          return;
        }

        const { error: actionError } = await stripe.handleNextAction({
          clientSecret: result.client_secret,
        });

        if (actionError) {
          console.warn("3DS challenge failed or cancelled, redirecting to checkout:", actionError);
          redirectToCheckout();
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
          } else if (step.accept_step_id) {
            redirectTo(step.accept_step_id, null);
          } else {
            goToThankYou();
          }
        }, 1200);
      } else {
        // If 1-click charge is not accepted (e.g. no saved token or bank decline), IMMEDIATELY redirect to the offer's checkout!
        console.warn("1-click not successful, taking user directly to checkout:", result.error);
        redirectToCheckout();
      }
    } catch (err) {
      console.error("Upsell error, redirecting to checkout:", err);
      redirectToCheckout();
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
  // Each upsell falls back to ITS OWN checkout (checkout_link_id), never a shared
  // hardcoded product. Falls back to the funnel's main link only if unset.
  const upsellCheckoutLink = step.checkout_link_id || step.payment_link_id;
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
  const upsellAmount = Number(step.amount);
  const is99Upsell = upsellAmount === 99;
  const isPhysical = is99Upsell ||
    step.product_name?.toLowerCase().includes("19-piece") ||
    step.product_name?.toLowerCase().includes("cookware") ||
    step.image_url?.includes("panela") ||
    step.id === "88888888-8888-4888-8888-888888888881" ||
    (linkId && (
      linkId === "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34" ||
      linkId === "4b585d8e-6df4-4019-8ca0-2a32b8e68844" ||
      linkId === "57300a28-4553-4bb4-9586-06941387717d"
    ));

  const regularPrice = is99Upsell ? 285 : upsellAmount === 597 ? 2899 : Math.round(upsellAmount * 2);
  const savingsAmount = regularPrice - Number(step.amount);
  const discountPercent = Math.round((savingsAmount / regularPrice) * 100);

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900 font-sans pb-12">
      <main className="max-w-xl mx-auto px-4 pt-4 md:pt-6">
        {/* Top Progress & Order Security Status */}
        <section aria-label="Order security status" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>PAYMENT VERIFIED & APPROVED</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>{formatTime(countdown)}</span>
            </div>
          </div>

          {/* 3-Step Progress Tracker */}
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between relative max-w-sm mx-auto">
              <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-gray-200 z-0" />
              <div
                className="absolute top-3.5 left-6 h-0.5 bg-emerald-500 z-0 transition-all duration-500"
                style={{ width: "50%" }}
              />

              {/* Step 1: Payment */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shadow-xs font-bold">
                  ✓
                </div>
                <span className="text-[11px] font-bold text-gray-700 mt-1">Payment</span>
                <span className="text-[9px] text-emerald-600 font-semibold">Done</span>
              </div>

              {/* Step 2: Package Setup (Current Active) */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-7 h-7 rounded-full bg-[#0b72e7] text-white flex items-center justify-center text-xs shadow-md animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-[#0b72e7] mt-1">
                  {isPhysical ? "Package Upgrade" : "Portal Setup"}
                </span>
                <span className="text-[9px] text-[#0b72e7] font-semibold animate-pulse">In Progress...</span>
              </div>

              {/* Step 3: Instant Access / Dispatch */}
              <div className="flex flex-col items-center relative z-10">
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-gray-400 mt-1">
                  {isPhysical ? "Dispatched" : "Instant Access"}
                </span>
                <span className="text-[9px] text-gray-400">Next</span>
              </div>
            </div>
          </div>

          {/* Urgent Opportunity Notice */}
          <div className="p-4 bg-amber-50/70 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-bold">Wait! Do not close or refresh this window.</strong>{" "}
              {isPhysical ? (
                <span>Your main order is confirmed and being prepared at the warehouse. Before final packaging, you can add this <span className="underline font-bold">19-Piece Chef Knife & Silicone Utensil Set for ONLY R99 with instant 1-click unlock and zero extra delivery fees</span>.</span>
              ) : (
                <span>Your member portal account is currently being initialized. Before final activation, you can add this special upgrade to your account with <span className="underline font-bold">instant 1-click unlock and zero monthly fees</span>.</span>
              )}
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
                {isPhysical ? "Special Warehouse Clearance Upgrade" : "Special VIP Member Upgrade"}
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
                <span className="text-xs font-bold text-gray-700">4.9</span>
                <span className="text-xs text-gray-500">
                  ({isPhysical ? "2,480 verified buyers" : "1,842 verified members"})
                </span>
              </div>

              {/* Product Image - Mobile-first uncropped showcase */}
              {step.image_url && (() => {
                const galleryImages = isPhysical
                  ? ["/assets/upsell-19pc.png"]
                  : [step.image_url];
                const activeImg = galleryImages[selectedImgIdx] || step.image_url;

                return (
                  <div className="mb-5">
                    {/* Clean badge row ABOVE the product image */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-xs">
                        🔥 -{discountPercent}% OFF ONE-TIME DEAL
                      </span>
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {isPhysical ? "Free Combined Delivery" : "Instant Digital Unlock"}
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
                  </div>
                );
              })()}

              {/* Product Highlights */}
              <div className="bg-blue-50/60 rounded-xl p-4 mb-5 border border-blue-100">
                <p className="text-xs text-gray-700 leading-relaxed font-medium mb-3">
                  {step.product_description}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 font-medium">
                  {isPhysical ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#0b72e7]" />
                        <span>5 Precision Chef Knives</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>11 Heat-Resistant Utensils</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cutting Board & Shears</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Countertop Organizer</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#0b72e7]" />
                        <span>Instant Digital Access</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Full VIP Priority</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Weekly Supplier Updates</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Zero Monthly Fees</span>
                      </div>
                    </>
                  )}
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
                  <span className="text-xs font-bold text-gray-700 uppercase">Special Launch Upgrade Price:</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-[#178a3b]">
                      R {Number(step.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 text-center">
                  One-time charge billed to your card on file • {isPhysical ? "Free Combined Delivery" : "Instant digital activation"}
                </p>
              </div>

              {/* 1-Click Buy Action Button */}
              <button
                onClick={handleAccept}
                className="w-full h-14 bg-[#178a3b] hover:bg-[#147633] active:scale-[0.99] text-white rounded-xl font-black text-base shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-current" />
                <span>{step.button_accept_text || `YES! ADD TO ORDER — R ${Number(step.amount).toFixed(0)}`}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              {/* Decline Button */}
              <button
                onClick={handleDecline}
                className="w-full mt-3.5 text-center text-xs text-gray-500 hover:text-gray-800 underline transition-colors py-2 cursor-pointer"
              >
                {step.button_decline_text || "No thank you, please continue to my order confirmation"}
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
              Activating your VIP upgrade...
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Authorizing 1-Click upgrade with your bank. Please do not refresh.
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
              {isPhysical ? "19-Piece Chef Set Added to Your Parcel! 🎉" : "Upgrade Added to Your Account!"}
            </h2>
            <p className="text-xs text-gray-600">
              {isPhysical
                ? `${step.product_name} has been added directly to your delivery parcel with Free Shipping.`
                : `${step.product_name} has been activated on your member portal.`}
            </p>
            <p className="text-[11px] text-gray-400 mt-2">
              {isPhysical ? "Redirecting to your delivery confirmation..." : "Redirecting to your member portal..."}
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
            {isPhysical
              ? "© 2026 Kitchen Express South Africa • Direct Warehouse Fulfillment & Delivery"
              : "© 2026 SA Ecom Start 2.0 • Official Member Portal & Supplier Network"}
          </p>
        </footer>
      </main>
    </div>
  );
}
