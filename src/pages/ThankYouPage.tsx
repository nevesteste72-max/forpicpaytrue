import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ShieldCheck, Mail, Truck } from "lucide-react";
import { useUtmifyScript } from "@/hooks/useUtmifyScript";

interface ProductFallback {
  name: string;
  subtitle: string;
  price: number;
  image: string;
}

const PRODUCTS: Record<string, ProductFallback> = {
  // Smeg 3-Piece
  "9a3b936a-9b0f-48b6-9744-3a6a81fd2b34": {
    name: "Smeg 3-Piece Breakfast Set",
    subtitle: "Toaster, Kettle and Blender • Luxury Matte Black Edition",
    price: 697,
    image: "https://wlbuboolvvguqstsjhtb.supabase.co/storage/v1/object/public/payment-images/be249323-7d67-4861-b660-afe337e7e940/9a3b936a-9b0f-48b6-9744-3a6a81fd2b34-1785608273170-fd806842-56b8-4f22-a86c-55d7ba56c2d8.png",
  },
  // Russell Hobbs Air Fryer
  "4b585d8e-6df4-4019-8ca0-2a32b8e68844": {
    name: "Russell Hobbs Dual Basket 9L Air Fryer",
    subtitle: "Model: RHAF09DSS • 1700W Rapid Air Digital Sync",
    price: 597,
    image: "https://wlbuboolvvguqstsjhtb.supabase.co/storage/v1/object/public/payment-images/be249323-7d67-4861-b660-afe337e7e940/4b585d8e-6df4-4019-8ca0-2a32b8e68844-1787909690783-21a2123e-6bd1-457a-9549-17b1aeaf7916.png",
  },
  // Berlinger Haus Cookware
  "57300a28-4553-4bb4-9586-06941387717d": {
    name: "Berlinger Haus 15-Piece Non-Stick Cookware Set",
    subtitle: "Metallic Grey Edition • Induction Turbo Bottom",
    price: 597,
    image: "https://wlbuboolvvguqstsjhtb.supabase.co/storage/v1/object/public/payment-images/be249323-7d67-4861-b660-afe337e7e940/57300a28-4553-4bb4-9586-06941387717d-1785530752538-2a1c0d51-ff72-4d2c-9a4f-56011c793ff6.png",
  },
};

export default function ThankYouPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const txId = searchParams.get("tx");

  useUtmifyScript();

  const [dbProduct, setDbProduct] = useState<{ name: string; price: number; image?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Identify fallback product
  const defaultProductKey = linkId && PRODUCTS[linkId] 
    ? linkId 
    : "4b585d8e-6df4-4019-8ca0-2a32b8e68844";
  const fallback = PRODUCTS[defaultProductKey];

  useEffect(() => {
    const loadData = async () => {
      try {
        if (linkId && PRODUCTS[linkId]) {
          const { data } = await supabase
            .from("payment_links")
            .select("product_name, amount, logo_url")
            .eq("id", linkId)
            .maybeSingle();

          if (data) {
            setDbProduct({
              name: data.product_name,
              price: Number(data.amount),
              image: data.logo_url || undefined,
            });
          }
        }

        if (txId) {
          const { data: tx } = await supabase
            .from("transactions")
            .select("amount, currency, payment_links(product_name, currency, facebook_pixel_id)")
            .eq("id", txId)
            .maybeSingle();

          if (tx) {
            const val = Number(tx.amount);
            const curr = (tx.payment_links as any)?.currency || "ZAR";
            const prodName = (tx.payment_links as any)?.product_name || fallback.name;

            if (typeof window !== "undefined" && (window as any).fbq) {
              (window as any).fbq("track", "Purchase", {
                value: val,
                currency: curr,
                content_name: prodName,
                content_type: "product",
              }, { eventID: txId });
            }
            if (typeof window !== "undefined" && (window as any).ttq) {
              (window as any).ttq.track("CompletePayment", {
                value: val,
                currency: curr,
                content_name: prodName,
              });
            }
          }
        }
      } catch (e) {
        console.error("Error loading thank you data:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [linkId, txId]);

  const productName = dbProduct?.name || fallback.name;
  const productPrice = dbProduct?.price || fallback.price;
  const productImage = dbProduct?.image || fallback.image;
  const productSubtitle = fallback.subtitle;

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#1f2937] font-sans">
      {/* Official Takealot Header */}
      <header className="bg-[#0b6ecb] px-4 py-3 text-white flex items-center justify-between shadow-sm">
        <div className="max-w-[580px] w-full mx-auto flex items-center justify-between">
          <a href="#" className="text-xl font-black tracking-tight text-white select-none">
            takealot<span className="text-[#facc15]">.com</span>
          </a>
          <div className="text-xs font-semibold flex items-center gap-1.5 opacity-90">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Secure Delivery</span>
          </div>
        </div>
      </header>

      <main className="max-w-[580px] mx-auto px-4 py-6 space-y-4">
        {/* Main Confirmation Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50 animate-pulse">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>

          <h1 className="text-center text-2xl font-black text-gray-900 mb-1.5 tracking-tight">
            Order Confirmed!
          </h1>
          <p className="text-center text-xs text-gray-600 max-w-md mx-auto leading-relaxed mb-5">
            Thank you! Your payment has been received and your package is being packed for priority dispatch.
          </p>

          {/* Status Box */}
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 flex items-center justify-between text-xs mb-5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-gray-600">Status:</span>
              <strong className="text-emerald-700 font-bold">Paid &amp; Approved</strong>
            </div>
            <div>
              <span className="text-gray-600">Delivery:</span>{' '}
              <strong className="text-gray-900 font-bold">1 - 2 Business Days</strong>
            </div>
          </div>

          {txId && (
            <div className="text-center -mt-2 mb-4">
              <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-[11px] font-mono font-bold">
                Order Ref: #{txId.slice(0, 8).toUpperCase()}
              </span>
            </div>
          )}

          {/* Product Row */}
          <div className="flex items-center gap-3.5 py-4 border-t border-b border-gray-200">
            <img
              src={productImage}
              alt={productName}
              className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-gray-900 leading-snug truncate">
                {productName}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{productSubtitle}</p>
              <span className="inline-block text-[11px] font-semibold text-gray-600 mt-1">Qty: 1</span>
            </div>
            <div className="text-sm font-black text-[#0b6ecb] shrink-0">
              R {productPrice.toFixed(0)}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="pt-4 space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>R {productPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Express Delivery Nationwide</span>
              <span className="text-emerald-600 font-bold uppercase text-[11px]">FREE</span>
            </div>
            <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-200 pt-2.5 mt-1">
              <span>Total Paid</span>
              <span className="text-[#0b6ecb]">R {productPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Live Delivery & Tracking Timeline Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0b6ecb]" />
            Delivery &amp; Tracking Information
          </h3>

          <div className="space-y-3.5 pt-1">
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ✓
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-gray-900">1. Payment Approved</h4>
                <p className="text-gray-500 text-[11px]">256-bit encrypted checkout verified and funds captured.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 animate-pulse">
                📦
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-amber-950 flex items-center gap-2">
                  2. Warehouse Packaging
                  <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase">In Progress</span>
                </h4>
                <p className="text-gray-600 text-[11px]">
                  Our South Africa warehouse is safely preparing your parcel for courier dispatch.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start opacity-70">
              <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                🚚
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-gray-800">3. Fast Courier Delivery</h4>
                <p className="text-gray-500 text-[11px]">
                  Delivered straight to your doorstep across Cape Town, Johannesburg, Durban &amp; Nationwide.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start opacity-70">
              <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ✉️
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-gray-800">4. Tracking Link via Email</h4>
                <p className="text-gray-500 text-[11px]">
                  Check your email inbox and spam/junk folder for your courier tracking link.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Support Box */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center text-xs text-gray-600 space-y-1.5">
          <p className="font-medium">Need assistance or want to update your delivery address?</p>
          <a
            href="mailto:support@kitchen-deals.store?subject=Order%20Inquiry"
            className="inline-flex items-center gap-1.5 text-[#0b6ecb] font-bold hover:underline"
          >
            <Mail className="w-3.5 h-3.5" />
            support@kitchen-deals.store
          </a>
          <p className="text-[11px] text-gray-400">Our South Africa support team responds within 2-4 hours.</p>
        </div>

        {/* Trust Footer */}
        <div className="text-center py-2 text-gray-400 text-[11px] flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>256-Bit SSL Encrypted Verification • Official Takealot Logistics</span>
        </div>
      </main>
    </div>
  );
}
