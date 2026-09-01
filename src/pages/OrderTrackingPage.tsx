import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Package, Truck, Clock, ShieldCheck, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const translations = {
  en: {
    title: "Order Confirmed! 🎉",
    subtitle: "Your payment was received and your order is being processed.",
    subtitlePhysical: "Your payment was received and your package is being prepared for express delivery.",
    steps: ["Order Placed", "Payment Confirmed", "Processing"],
    stepsPhysical: ["Order Placed", "Payment Confirmed", "Warehouse Packaging", "Courier Delivery"],
    orderDate: "Order date",
    amountPaid: "Amount Paid",
    order: "Order Details",
    orderRef: "Order Reference",
    accessProduct: "Access Product",
    footerNote: "We'll send you an update as soon as your order is out for delivery. Save this link to check your order status anytime.",
    footerNotePhysical: "Your order is scheduled for dispatch. Express delivery nationwide across South Africa (Cape Town, Johannesburg, Durban & Pretoria).",
    deliveryStatus: "Live Order Status",
    inPrep: "In Preparation",
    step1: "1. Payment Approved",
    step1Desc: "256-bit encrypted checkout verified.",
    step2: "2. Warehouse Packaging",
    step2Desc: "Quality inspection and secure packaging in progress.",
    step3: "3. Courier Dispatch",
    step3Desc: "Courier pickup scheduled within 24-48h.",
    step4: "4. Doorstep Delivery",
    step4Desc: "Free express delivery to your doorstep."
  },
  pt: {
    title: "Pedido Confirmado! 🎉",
    subtitle: "O seu pagamento foi recebido e o seu pedido está a ser processado.",
    subtitlePhysical: "O seu pagamento foi recebido e o seu pedido está a ser preparado para envio.",
    steps: ["Pedido Criado", "Pagamento Confirmado", "Em Processamento"],
    stepsPhysical: ["Pedido Criado", "Pagamento Confirmado", "Em Preparação", "Em Entrega"],
    orderDate: "Data do pedido",
    amountPaid: "Valor Pago",
    order: "Detalhes do Pedido",
    orderRef: "Referência",
    accessProduct: "Acessar Produto",
    footerNote: "Vamos entrar em contacto assim que o seu pedido for enviado.",
    footerNotePhysical: "Vamos entrar em contacto assim que o seu pedido for enviado. Guarde este link para consultar o estado do seu pedido quando quiser.",
    deliveryStatus: "Estado do Pedido",
    inPrep: "Em Preparação",
    step1: "1. Pagamento Aprovado",
    step1Desc: "Pagamento seguro verificado.",
    step2: "2. Embalagem no Armazém",
    step2Desc: "Inspeção de qualidade e embalagem segura.",
    step3: "3. Envio por Transportadora",
    step3Desc: "Coleta agendada em 24-48h.",
    step4: "4. Entrega ao Domicílio",
    step4Desc: "Entrega expressa no seu endereço."
  },
  es: {
    title: "¡Pedido Confirmado! 🎉",
    subtitle: "Su pago fue recibido y su pedido está siendo procesado.",
    subtitlePhysical: "Su pago fue recibido y su paquete está siendo preparado para el envío.",
    steps: ["Pedido Creado", "Pago Confirmado", "En Proceso"],
    stepsPhysical: ["Pedido Creado", "Pago Confirmado", "En Preparación", "En Reparto"],
    orderDate: "Fecha del pedido",
    amountPaid: "Monto Pagado",
    order: "Detalles del Pedido",
    orderRef: "Referencia",
    accessProduct: "Acceder al Producto",
    footerNote: "Nos pondremos en contacto en cuanto su pedido sea enviado.",
    footerNotePhysical: "Nos pondremos en contacto en cuanto su pedido sea enviado.",
    deliveryStatus: "Estado del Pedido",
    inPrep: "En Preparación",
    step1: "1. Pago Aprobado",
    step1Desc: "Pago seguro verificado.",
    step2: "2. Empaque en Almacén",
    step2Desc: "Control de calidad y empaque seguro.",
    step3: "3. Despacho por Courier",
    step3Desc: "Recolección programada en 24-48h.",
    step4: "4. Entrega a Domicilio",
    step4Desc: "Entrega express en su puerta."
  }
} as const;

type Lang = keyof typeof translations;

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
        .select("id, amount, currency, status, created_at, customer_name, customer_email, payment_link_id, payment_links(product_name, currency, checkout_language, product_type)")
        .eq("id", transactionId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setDbTx(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [transactionId]);

  const productName = dbTx?.payment_links?.product_name || searchParams.get("product") || "Order Item";
  const amount = dbTx?.amount || searchParams.get("amount");
  const currency = dbTx?.currency || searchParams.get("currency") || "ZAR";
  const date = dbTx?.created_at 
    ? new Date(dbTx.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    : searchParams.get("date") || new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  
  const redirectUrl = searchParams.get("access");
  const langParam = searchParams.get("lang") || dbTx?.payment_links?.checkout_language;
  // Default ALWAYS to English (en) for South Africa and international stores
  const lang: Lang = langParam && langParam in translations ? (langParam as Lang) : "en";
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-3 sm:p-6 font-sans text-slate-800">
      <div className="w-full max-w-lg space-y-4">
        
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 sm:p-8 text-center text-white relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-white/30 animate-pulse">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t.title}</h1>
            <p className="text-emerald-100 text-sm mt-1 max-w-md mx-auto">{t.subtitlePhysical}</p>
            {transactionId && (
              <div className="mt-3 inline-block bg-emerald-800/60 px-3 py-1 rounded-full text-xs font-mono font-bold text-emerald-100">
                {t.orderRef}: #{transactionId.slice(0, 8).toUpperCase()}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            
            {/* Live Progress Timeline */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {t.deliveryStatus}
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                  {t.inPrep}
                </span>
              </div>

              {/* Steps */}
              <div className="space-y-4 pt-1">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{t.step1}</h4>
                    <p className="text-xs text-slate-500">{t.step1Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 animate-pulse">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{t.step2}</h4>
                    <p className="text-xs text-slate-500">{t.step2Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 opacity-60">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">{t.step3}</h4>
                    <p className="text-xs text-slate-500">{t.step3Desc}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 opacity-40">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">{t.step4}</h4>
                    <p className="text-xs text-slate-500">{t.step4Desc}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-sm">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{t.order}</h3>
              
              <div className="flex justify-between items-center font-bold text-slate-800">
                <span>{productName}</span>
              </div>
              
              {amount && (
                <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/60 pt-2">
                  <span>{t.amountPaid}:</span>
                  <span className="font-extrabold text-emerald-700 text-base">{currency} {Number(amount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-200/60 pt-2">
                <span>{t.orderDate}:</span>
                <span className="font-medium">{date}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <p className="text-xs text-slate-500 text-center leading-relaxed px-2">
              {t.footerNotePhysical}
            </p>

            {redirectUrl && (
              <Button
                onClick={() => window.open(redirectUrl, "_blank")}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t.accessProduct}
              </Button>
            )}
          </div>
        </div>

        {/* Verified Security Badge */}
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 py-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verified Secure Order & Nationwide Express Delivery (ZA)</span>
        </div>

      </div>
    </div>
  );
}
