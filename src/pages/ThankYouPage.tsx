import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  Package,
  Truck,
  Home,
  Clock,
  ShieldCheck,
  Mail,
  ExternalLink,
  Sparkles,
  PackageOpen,
  PartyPopper
} from "lucide-react";
import cashpayLogoFull from "@/assets/picpay-logo.jpeg";
import { useUtmifyScript } from "@/hooks/useUtmifyScript";

interface ProductFallback {
  name: string;
  subtitle: string;
  price: number;
  image: string;
}

const PRODUCTS_MAP: Record<string, ProductFallback> = {
  // Smeg 3-Piece
  "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34": {
    name: "Smeg 3-Piece Breakfast Set",
    subtitle: "Toaster, Kettle & Blender • Luxury Matte Black Edition",
    price: 697,
    image: "/images/p1.png",
  },
  // Russell Hobbs Air Fryer
  "4b585d8e-6df4-4019-8ca0-2a32b8e68844": {
    name: "Russell Hobbs Dual Basket 9L Air Fryer",
    subtitle: "Model: RHAF09DSS • 1700W Rapid Air Digital Sync",
    price: 597,
    image: "/images/air_1.png",
  },
  // Berlinger Haus Cookware
  "57300a28-4553-4bb4-9586-06941387717d": {
    name: "Berlinger Haus 15-Piece Non-Stick Cookware Set",
    subtitle: "Metallic Grey Edition • Induction Turbo Bottom",
    price: 597,
    image: "https://wlbuboolvvguqstsjhtb.supabase.co/storage/v1/object/public/payment-images/be249323-7d67-4861-b660-afe337e7e940/57300a28-4553-4bb4-9586-06941387717d-1785530752538-2a1c0d51-ff72-4d2c-9a4f-56011c793ff6.png",
  },
};

interface PaymentLinkInfo {
  product_name: string;
  product_type?: string;
  redirect_url: string | null;
  thank_you_title: string | null;
  thank_you_message: string | null;
  thank_you_video_url: string | null;
  currency: string;
  checkout_language: string;
}

export default function ThankYouPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const txId = searchParams.get("tx");

  // UTMify script on thank you page
  useUtmifyScript();

  const [linkInfo, setLinkInfo] = useState<PaymentLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [txData, setTxData] = useState<any>(null);

  // Fallback info — only used for the small set of known physical-goods offers above.
  // Any other product (including every digital offer) gets a generic, brand-free fallback
  // so a DB hiccup never shows the wrong item's name/photo on someone else's thank-you page.
  const genericFallback: ProductFallback = { name: "Your product", subtitle: "", price: 0, image: "" };
  const fallbackProduct = (linkId && PRODUCTS_MAP[linkId]) || genericFallback;

  const isCookwareOrPhysical =
    (linkId ? Boolean(PRODUCTS_MAP[linkId]) : false) ||
    linkInfo?.product_type === "physical";

  useEffect(() => {
    fetchData();
  }, [linkId, txId]);

  const fetchData = async () => {
    try {
      if (linkId) {
        const { data: link, error: linkErr } = await supabase
          .from("payment_links")
          .select("id, product_name, product_type, redirect_url, thank_you_title, thank_you_message, thank_you_video_url, currency, checkout_language")
          .eq("id", linkId)
          .maybeSingle();

        if (link && !linkErr) {
          setLinkInfo(link as any);
        } else {
          // The real payment_links row could not be loaded (network hiccup, bad id, ...).
          // Show a generic, product-agnostic confirmation instead of guessing a product —
          // this thank-you page is shared by every offer, digital or physical.
          setLinkInfo({
            product_name: "Your product",
            product_type: null,
            redirect_url: null,
            thank_you_title: "Order Confirmed!",
            thank_you_message: "Your payment is confirmed. Check your email for access details.",
            thank_you_video_url: null,
            currency: "USD",
            checkout_language: "en"
          });
        }
      }

      if (txId) {
        const { data: mainTx } = await supabase
          .from("transactions")
          .select("amount, customer_name, customer_email, payment_links(product_name, currency, checkout_language, facebook_pixel_id)")
          .eq("id", txId)
          .maybeSingle();

        if (mainTx) {
          setTxData(mainTx);
          const val = Number(mainTx.amount);
          const curr = (mainTx.payment_links as any)?.currency || "ZAR";
          const prodName = (mainTx.payment_links as any)?.product_name || fallbackProduct.name;

          // Deduplicated purchase tracking
          if (typeof window !== "undefined" && (window as any).fbq) {
            (window as any).fbq('track', 'Purchase', {
              value: val,
              currency: curr,
              content_name: prodName,
              content_type: 'product'
            }, { eventID: txId });
          }
          if (typeof window !== "undefined" && (window as any).ttq) {
            (window as any).ttq.track('CompletePayment', {
              value: val,
              currency: curr,
              content_name: prodName
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch thank you data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Dynamic delivery date estimate (7 to 14 business days)
  const today = new Date();
  const minDelivery = new Date(today);
  minDelivery.setDate(today.getDate() + 7);
  const maxDelivery = new Date(today);
  maxDelivery.setDate(today.getDate() + 14);

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const minDateStr = minDelivery.toLocaleDateString('en-ZA', dateOptions);
  const maxDateStr = maxDelivery.toLocaleDateString('en-ZA', dateOptions);

  const currentProductName = linkInfo?.product_name || txData?.payment_links?.product_name || fallbackProduct.name;
  const currentProductImage = fallbackProduct.image;
  const currentProductSubtitle = fallbackProduct.subtitle;
  const currentPrice = txData?.amount ? Number(txData.amount) : fallbackProduct.price;

  // ==========================================
  // PHYSICAL PRODUCTS POST-PURCHASE TRACKING
  // ==========================================
  if (isCookwareOrPhysical) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-3 sm:p-6 font-sans text-slate-800">
        <div className="w-full max-w-lg space-y-4">
          
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 sm:p-8 text-center text-white relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-white/30 animate-pulse">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Order Confirmed! 🎉
              </h1>
              <p className="text-emerald-100 text-sm mt-1 max-w-md mx-auto">
                {isCookwareOrPhysical ? (
                  <>Thank you! Your payment is confirmed and your <strong>{currentProductName}</strong> is now being prepared for express delivery.</>
                ) : (
                  <>Thank you! Your payment for <strong>{currentProductName}</strong> is confirmed.</>
                )}
              </p>
              {txId && (
                <div className="mt-3 inline-block bg-emerald-800/60 px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-100">
                  Order Ref: #{txId.slice(0, 8).toUpperCase()}
                </div>
              )}
            </div>

            <div className="p-5 sm:p-8 space-y-5">

              {/* Product Confirmation Card with 100% visible uncropped image */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-4">
                {currentProductImage && (
                  <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                    <img
                      src={currentProductImage}
                      alt={currentProductName}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
                    {currentProductName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {currentProductSubtitle}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-500 font-medium">Total Paid:</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      {linkInfo?.currency === "ZAR" ? "R " : linkInfo?.currency === "EUR" ? "€" : "$"}
                      {currentPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live 4-Step Tracking Timeline */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Live Order Status
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    In Preparation
                  </span>
                </div>

                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">1. Payment Approved</h4>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">Done</span>
                    </div>
                    <p className="text-[11px] text-slate-500">256-bit encrypted checkout verified.</p>
                  </div>
                </div>

                {/* Step 2 (Active) */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm ring-4 ring-amber-100 animate-pulse mt-0.5">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-950">2. Warehouse Packaging</h4>
                      <span className="text-[10px] text-amber-800 bg-amber-100 font-extrabold px-1.5 py-0.5 rounded">Active Now</span>
                    </div>
                    <p className="text-[11px] text-slate-600">Quality check & secure packaging in progress.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 opacity-60">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-slate-700">3. Courier Dispatch</h4>
                    <p className="text-[11px] text-slate-500">Courier pickup scheduled within 24h.</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 opacity-60">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Home className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-slate-700">4. Doorstep Delivery</h4>
                    <p className="text-[11px] text-slate-500">Estimated: {minDateStr} – {maxDateStr} (7-14 business days).</p>
                  </div>
                </div>
              </div>

              {/* High Demand Notice */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <span className="text-base">🔥</span>
                  <span>HIGH DEMAND NOTICE — NATIONWIDE POPULARITY</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Due to <strong>extremely high demand across South Africa</strong>, orders are currently being prepared in batches to ensure strict quality control. Your order is <strong>100% reserved and secured</strong>.
                </p>
                <div className="pt-2 border-t border-amber-200/70 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">Estimated Delivery Window: 1 to 2 Weeks</h4>
                    <p className="text-[11px] text-amber-800 font-medium">{minDateStr} — {maxDateStr} (7-14 business days)</p>
                  </div>
                </div>
              </div>

              {/* Customer Support */}
              <div className="pt-2 text-center space-y-2">
                <a
                  href={`mailto:support673@gmail.com?subject=Order%20Inquiry%20${encodeURIComponent(currentProductName)}`}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                >
                  <Mail className="w-4 h-4" />
                  Contact Customer Support (support673@gmail.com)
                </a>
                <p className="text-[11px] text-slate-500">
                  Need to update your delivery address? Our customer care team responds in 2-4 hours.
                </p>
              </div>

            </div>
          </div>

          <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-bit Encrypted SSL Confirmation & Verified Courier Logistics</span>
          </div>

        </div>
      </div>
    );
  }

  // Fallback for digital products (e.g. SA Ecom Start 2.0 & Web App Vault)
  const lang = linkInfo?.checkout_language === "pt" ? "pt" : "en";
  const portalUrl = linkInfo?.redirect_url || "/vault";
  const productName = linkInfo?.product_name || "SA Ecom Start 2.0 — Reseller Web App & Supplier Vault";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-b from-emerald-950/80 to-slate-900 border-b border-emerald-500/20 p-6 sm:p-8 text-center relative">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-bounce" />
            </div>
            <span className="inline-block bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Payment Confirmed • Instant Access
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {lang === "en" ? "Welcome to the Portal!" : "Acesso Liberado com Sucesso!"}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-sm mx-auto">
              Your order for <strong>{productName}</strong> is complete. You can access your member vault immediately below.
            </p>
            {txId && (
              <div className="mt-3 inline-block bg-slate-800/90 border border-slate-700 px-3 py-1 rounded-full text-xs font-mono text-slate-300">
                Order Ref: #{txId.slice(0, 8).toUpperCase()}
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            
            {/* Main CTA Button to Access Deliverable / Vault */}
            <div className="space-y-2">
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 transition-all transform active:scale-[0.98] text-center"
              >
                <PackageOpen className="w-5 h-5 shrink-0" />
                <span>{lang === "en" ? "Click Here to Access Your Vault Now" : "Clique Aqui Para Acessar Seu Portal"}</span>
                <ExternalLink className="w-4 h-4 shrink-0 opacity-80" />
              </a>
              <p className="text-[11px] text-center text-slate-400">
                ⚡ Instant unlock: All 50+ WhatsApp suppliers, scripts, and PEP Paxi tools are ready.
              </p>
            </div>

            {/* Email Notification & Spam Box */}
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4.5 space-y-2 text-left">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Access Sent to Email (Check Spam / Junk)</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                We have also sent your official access receipt and backup link directly to your email address.
              </p>
              <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <span className="font-bold">⚠️ Tip:</span>
                <span>If you don't see our email in your Primary Inbox within 5 minutes, please check your <strong>Spam / Junk / Promotions</strong> folder and mark it as "Not Spam".</span>
              </div>
            </div>

            {/* Quick Support Link */}
            <div className="pt-2 text-center border-t border-slate-800">
              <p className="text-xs text-slate-400">
                Need help with your order? Contact us at{" "}
                <a
                  href="mailto:support673@gmail.com"
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  support673@gmail.com
                </a>
              </p>
            </div>

          </div>
        </div>

        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1 mt-6">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>256-Bit SSL Encrypted Access • Official Reseller Portal</span>
        </div>
      </div>
    </div>
  );
}
