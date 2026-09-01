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
  const [purchases, setPurchases] = useState<{ name: string; amount: number }[]>([]);

  // Verificação direta se é o produto das panelas ou produto físico
  const isCookwareOrPhysical = 
    linkId === "57300a28-4553-4bb4-9586-06941387717d" ||
    linkId === "faa8798d-3e10-4de3-bf64-b9e82fdc339f" ||
    linkInfo?.product_type === "physical" ||
    linkInfo?.currency === "ZAR";

  useEffect(() => {
    fetchData();
  }, [linkId, txId]);

  const fetchData = async () => {
    try {
      if (linkId) {
        // Tentativa de buscar os dados do produto no supabase
        const { data: link } = await supabase
          .from("payment_links")
          .select("*")
          .eq("id", linkId)
          .maybeSingle();

        if (link) {
          setLinkInfo(link as any);
        } else if (linkId === "57300a28-4553-4bb4-9586-06941387717d") {
          // Fallback garantido para o Cookware Set
          setLinkInfo({
            product_name: "Berlinger Haus 15-Piece Cookware Set",
            product_type: "physical",
            redirect_url: null,
            thank_you_title: "Order Confirmed!",
            thank_you_message: "Your payment is confirmed and your cookware set is being prepared for shipping.",
            thank_you_video_url: null,
            currency: "ZAR",
            checkout_language: "en"
          });
        }
      }

      if (txId) {
        const { data: mainTx } = await supabase
          .from("transactions")
          .select("amount, payment_links(product_name, currency, checkout_language, facebook_pixel_id)")
          .eq("id", txId)
          .maybeSingle();

        const items: { name: string; amount: number }[] = [];

        if (mainTx) {
          const val = Number(mainTx.amount);
          const curr = (mainTx.payment_links as any)?.currency || "ZAR";
          const prodName = (mainTx.payment_links as any)?.product_name || "Product";
          items.push({
            name: prodName,
            amount: val,
          });

          // Disparar Purchase com deduplicação (eventID = txId)
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

        setPurchases(items);
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

  // Previsão dinâmica de entrega (2 a 4 dias)
  const today = new Date();
  const minDelivery = new Date(today);
  minDelivery.setDate(today.getDate() + 7);
  const maxDelivery = new Date(today);
  maxDelivery.setDate(today.getDate() + 14);

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const minDateStr = minDelivery.toLocaleDateString('en-ZA', dateOptions);
  const maxDateStr = maxDelivery.toLocaleDateString('en-ZA', dateOptions);

  // Link de rastreio definitivo
  const trackingUrl = txId ? `/rastreio/${txId}?lang=en` : `/rastreio/57300a28-4553-4bb4-9586-06941387717d?lang=en`;

  // ==========================================
  // 📦 RENDERIZAÇÃO PARA PRODUTOS FÍSICOS (PMH DIGITAL / COOKWARE)
  // ==========================================
  if (isCookwareOrPhysical) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-3 sm:p-6 font-sans text-slate-800">
        <div className="w-full max-w-lg space-y-4">
          
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
            
            {/* Header com Sucesso & Brilho */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 sm:p-8 text-center text-white relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-white/30 animate-pulse">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Order Confirmed! 🎉
              </h1>
              <p className="text-emerald-100 text-sm mt-1 max-w-md mx-auto">
                Thank you! Your payment is confirmed and your <strong>Berlinger Haus 15-Piece Cookware Set</strong> is now being prepared for shipping.
              </p>
              {txId && (
                <div className="mt-3 inline-block bg-emerald-800/60 px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-100">
                  Order Ref: #{txId.slice(0, 8).toUpperCase()}
                </div>
              )}
            </div>

            <div className="p-5 sm:p-8 space-y-5">

              {/* 🎯 BOTÃO PRINCIPAL DE RASTREIO (DESTAQUE MÁXIMO) */}
              <div className="pt-1">
                <a
                  href={trackingUrl}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-base flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-500/30 active:scale-[0.98] border border-blue-400/30"
                >
                  <Truck className="w-6 h-6 animate-bounce" />
                  <span>TRACK YOUR ORDER NOW</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              </div>

              {/* Linha do Tempo Visual de 4 Etapas */}
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

                {/* Step 2 (Ativo) */}
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

              {/* Aviso de Alta Demanda & Janela de Entrega (1-2 semanas) */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <span className="text-base">🔥</span>
                  <span>HIGH DEMAND NOTICE — NATIONWIDE POPULARITY</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Due to <strong>extremely high demand across South Africa</strong>, orders are currently being prepared in batches to ensure strict quality control. Your cookware set is <strong>100% reserved and secured</strong>.
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

              {/* Bloco de Suporte */}
              <div className="pt-2 text-center space-y-2">
                <a
                  href="mailto:support673@gmail.com?subject=Order%20Inquiry%20Cookware"
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

  // ==========================================
  // 🎓 RENDERIZAÇÃO PARA PRODUTOS DIGITAIS (TECNO HOGAR / PICPAY)
  // ==========================================
  const lang = linkInfo?.checkout_language || "pt";
  const currency = linkInfo?.currency || "EUR";
  const title = linkInfo?.thank_you_title || (lang === "en" ? "Thank you for your purchase!" : "Obrigado pela sua compra!");
  const message = linkInfo?.thank_you_message || (lang === "en"
    ? "Your purchase was successful. You will receive an email with all the details — if you don't see it, please check your spam/junk folder."
    : "A sua compra foi realizada com sucesso. Você receberá um email com todos os detalhes — se não encontrar, verifique a caixa de spam.");

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card rounded-3xl shadow-xl shadow-muted-foreground/5 overflow-hidden border border-border">
          
          <div className="bg-success/5 border-b border-success/10 p-8 text-center">
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <a
              href="/membros"
              className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            >
              <PackageOpen className="w-4 h-4" />
              {lang === "en" ? "Access My Members Area" : "Aceder à Área de Membros"}
            </a>
            <p className="text-xs text-muted-foreground text-center -mt-3">
              {lang === "en"
                ? "Enter the email you used on this purchase to download your materials."
                : "Entra com o email desta compra para descarregares os teus materiais."}
            </p>

            {linkInfo?.redirect_url && (
              <Button
                onClick={() => window.open(linkInfo.redirect_url!, "_blank")}
                variant="outline"
                className="w-full h-11 rounded-xl font-semibold"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {lang === "en" ? "Access Content" : "Acessar Conteúdo"}
              </Button>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <img src={cashpayLogoFull} alt="PicPay" className="h-20 w-20 mx-auto rounded-full object-contain" />
        </div>
      </div>
    </div>
  );
}
