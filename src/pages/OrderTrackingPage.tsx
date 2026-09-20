import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ShieldCheck,
  Mail,
  Sparkles,
  PackageOpen,
  ArrowRight,
  Truck,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PHYSICAL_PRODUCTS: Record<string, { name: string; subtitle: string; price: number; image: string }> = {
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
  // Berlinger Haus Cookware (Panela)
  "57300a28-4553-4bb4-9586-06941387717d": {
    name: "Berlinger Haus 15-Piece Non-Stick Cookware Set",
    subtitle: "Metallic Grey Edition • Induction Turbo Bottom",
    price: 597,
    image: "/images/panela_hero.png",
  },
  // 19-Piece Chef Knife & Silicone Kitchen Utensil Set
  "e1919191-1919-4919-8919-191919191919": {
    name: "19-Piece Chef Knife & Silicone Kitchen Utensil Set with Organizer",
    subtitle: "Complete Chef Collection • 5 Knives • 11 Utensils • Cutting Board • Organizer",
    price: 99,
    image: "/assets/upsell-19pc.png",
  },
};

export default function OrderTrackingPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [searchParams] = useSearchParams();

  const [dbTx, setDbTx] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transactionId) {
      setLoading(true);
      supabase
        .from("transactions")
        .select("id, amount, currency, status, created_at, customer_name, customer_email, payment_link_id, payment_links(product_name, currency, checkout_language, product_type, redirect_url, logo_url)")
        .eq("id", transactionId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setDbTx(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [transactionId]);

  const linkId = dbTx?.payment_link_id;
  const rawProductName =
    dbTx?.payment_links?.product_name ||
    searchParams.get("product") ||
    "";

  const isPhysical =
    (linkId && PHYSICAL_PRODUCTS[linkId]) ||
    dbTx?.payment_links?.product_type === "physical" ||
    linkId === "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34" ||
    linkId === "4b585d8e-6df4-4019-8ca0-2a32b8e68844" ||
    linkId === "57300a28-4553-4bb4-9586-06941387717d" ||
    linkId === "e1919191-1919-4919-8919-191919191919" ||
    rawProductName?.toLowerCase().includes("smeg") ||
    rawProductName?.toLowerCase().includes("air fryer") ||
    rawProductName?.toLowerCase().includes("airfryer") ||
    rawProductName?.toLowerCase().includes("cookware") ||
    rawProductName?.toLowerCase().includes("panela") ||
    rawProductName?.toLowerCase().includes("19-piece");

  const fallbackData = (linkId && PHYSICAL_PRODUCTS[linkId]) || null;
  const productName = fallbackData?.name || rawProductName || "SA Ecom Start 2.0 — South Africa WhatsApp & Reseller Web App Portal";
  const productImage = fallbackData?.image || dbTx?.payment_links?.logo_url;
  const amount = dbTx?.amount || searchParams.get("amount") || fallbackData?.price || 197;
  const currency = dbTx?.currency || searchParams.get("currency") || "ZAR";
  const portalUrl = dbTx?.payment_links?.redirect_url || searchParams.get("access") || "/vault";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // =========================================================================
  // 📦 PHYSICAL PRODUCT FLOW (SMEG / AIR FRYER / COOKWARE / 19-PIECE UPSELL)
  // =========================================================================
  if (isPhysical) {
    const today = new Date();
    const minDelivery = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const maxDelivery = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const dateRange = `${minDelivery.toLocaleDateString("en-ZA", options)} – ${maxDelivery.toLocaleDateString("en-ZA", options)}`;

    return (
      <div className="min-h-screen bg-[#f4f5f7] text-gray-900 font-sans p-3.5 sm:p-6 flex items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
            
            {/* Header */}
            <div className="bg-gradient-to-b from-emerald-600 to-teal-700 p-6 sm:p-8 text-center text-white relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/15 border border-white/25 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-lg ring-4 ring-white/10">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>

              <div className="inline-flex items-center gap-1.5 bg-black/20 border border-white/20 text-emerald-100 text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Payment Approved • Order Secured</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Order Confirmed! 📦
              </h1>

              <p className="text-emerald-50 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
                Thank you for your order! Your parcel is being prepared for dispatch from our South Africa distribution warehouse.
              </p>

              {transactionId && (
                <div className="mt-3 inline-block bg-black/25 border border-white/20 px-3.5 py-1 rounded-full text-xs font-mono text-emerald-200 font-bold">
                  Order Ref: #{transactionId.slice(0, 8).toUpperCase()}
                </div>
              )}
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              {/* 4-Step Fulfillment Tracker */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-3.5">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Parcel Dispatch & Delivery Timeline</span>
                </h3>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      ✓
                    </div>
                    <div className="flex-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">1. Payment Verified</span>
                      <span className="text-emerald-600 font-semibold text-[11px]">Completed</span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#0b72e7] text-white flex items-center justify-center text-xs font-bold shrink-0 animate-pulse">
                      ●
                    </div>
                    <div className="flex-1 flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0b72e7]">2. Warehouse Packaging</span>
                      <span className="bg-blue-50 text-[#0b72e7] border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">Active Now</span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-center gap-3 opacity-60">
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">
                      3
                    </div>
                    <div className="flex-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-600">3. Handover to Courier (Fastway / Courier Guy)</span>
                      <span className="text-gray-400 text-[11px]">Within 24h</span>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-center gap-3 opacity-60">
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0">
                      4
                    </div>
                    <div className="flex-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-600">4. Doorstep Delivery</span>
                      <span className="text-gray-500 text-[11px] font-bold">{dateRange}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Summary Box */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  {productImage ? (
                    <img
                      src={productImage}
                      alt={productName}
                      className="w-12 h-12 object-contain rounded-lg border border-gray-100 p-1 shrink-0 bg-gray-50"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <PackageOpen className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {productName}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Fastway / Courier Guy • Free Delivery Included
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Paid</span>
                  <span className="text-sm sm:text-base font-black text-emerald-600">
                    {currency === "ZAR" ? "R " : "$"}{Number(amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* SMS & Tracking Info */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2 text-left text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>SMS & Email Tracking Notice</span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  You will receive an automated SMS and email notification with your live waybill tracking number as soon as your parcel is scanned by the courier driver.
                </p>
              </div>

              {/* Customer Support */}
              <div className="pt-2 text-center border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Need to update your delivery address? Email us anytime at{" "}
                  <a
                    href="mailto:support673@gmail.com"
                    className="text-emerald-600 hover:underline font-bold"
                  >
                    support673@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Security Trust Badge */}
          <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit SSL Secured • Kitchen Express South Africa Direct Fulfillment</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 🎓 DIGITAL INFOPRODUCT & WEB APP VAULT DELIVERABLE (ONLY FOR DIGITAL)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-3.5 sm:p-6 font-sans">
      <div className="w-full max-w-lg space-y-4">
        
        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-b from-emerald-950/90 via-emerald-900/40 to-slate-900 border-b border-emerald-500/20 p-6 sm:p-8 text-center relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-950/60 ring-4 ring-emerald-500/10">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400" />
            </div>
            
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Payment Approved • Instant Access</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Welcome to the Portal! 🎉
            </h1>
            
            <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
              Your payment is confirmed. Your full access to the <strong>SA Ecom Start 2.0 Member Vault</strong> is ready below.
            </p>

            {transactionId && (
              <div className="mt-3 inline-block bg-slate-800/90 border border-slate-700/80 px-3.5 py-1 rounded-full text-xs font-mono text-emerald-300 font-bold">
                Order Ref: #{transactionId.slice(0, 8).toUpperCase()}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-7 space-y-5">
            
            {/* Product Summary Box */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <PackageOpen className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                    {productName}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Full Web App Access • 50+ Wholesalers
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Paid</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-400">
                  {currency === "ZAR" ? "R " : "$"}{Number(amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* HIGH-IMPACT ACCESS BUTTON (DELIVERABLE) */}
            <div className="space-y-2 pt-1">
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25 transition-all transform active:scale-[0.98] text-center uppercase tracking-wide cursor-pointer"
              >
                <span>Click Here to Access Your Vault Now</span>
                <ArrowRight className="w-5 h-5 shrink-0" />
              </a>
              <p className="text-[11px] text-center text-slate-400">
                ⚡ Unlocks immediately: WhatsApp Suppliers, Scriptbook, and PEP Paxi Guide.
              </p>
            </div>

            {/* EMAIL NOTIFICATION & SPAM ALERT BOX */}
            <div className="bg-amber-950/25 border border-amber-500/35 rounded-2xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                <Mail className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                <span>Access Sent to Email (Check Spam / Junk)</span>
              </div>
              <p className="text-xs text-amber-100/90 leading-relaxed">
                We have also sent your official receipt and backup access link directly to your email address.
              </p>
              <div className="bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-2">
                <span className="font-bold text-amber-300 shrink-0">⚠️ Notice:</span>
                <span>If you do not see the email in your Primary Inbox within 5 minutes, please check your <strong>Spam / Junk / Promotions</strong> folder and mark it as <strong>"Not Spam"</strong> so you receive supplier updates.</span>
              </div>
            </div>

            {/* Customer Support */}
            <div className="pt-2 text-center border-t border-slate-800">
              <p className="text-xs text-slate-400">
                Questions or support? Email us anytime at{" "}
                <a
                  href="mailto:support673@gmail.com"
                  className="text-emerald-400 hover:underline font-bold"
                >
                  support673@gmail.com
                </a>
              </p>
            </div>

          </div>
        </div>

        {/* Security Trust Badge */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>256-Bit SSL Encrypted Access • Official South Africa Reseller Portal</span>
        </div>

      </div>
    </div>
  );
}
