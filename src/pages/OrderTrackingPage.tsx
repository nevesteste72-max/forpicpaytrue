import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink } from "lucide-react";
import cashpayLogoFull from "@/assets/picpay-logo.jpeg";

const translations = {
  pt: {
    title: "Pedido Confirmado",
    subtitle: "O seu pagamento foi recebido e o seu pedido está a ser processado.",
    steps: ["Pedido Criado", "Pagamento Confirmado", "Em Processamento"],
    orderDate: "Data do pedido",
    amountPaid: "Valor Pago",
    order: "Pedido",
    accessProduct: "Acessar Produto",
    footerNote: "Vamos entrar em contacto assim que o seu pedido for concluído. Guarde este link para consultar o estado do seu pedido quando quiser.",
  },
  en: {
    title: "Order Confirmed",
    subtitle: "Your payment was received and your order is being processed.",
    steps: ["Order Created", "Payment Confirmed", "Processing"],
    orderDate: "Order date",
    amountPaid: "Amount Paid",
    order: "Order",
    accessProduct: "Access Product",
    footerNote: "We'll reach out as soon as your order is complete. Keep this link to check your order status anytime.",
  },
  es: {
    title: "Pedido Confirmado",
    subtitle: "Su pago fue recibido y su pedido está siendo procesado.",
    steps: ["Pedido Creado", "Pago Confirmado", "En Procesamiento"],
    orderDate: "Fecha del pedido",
    amountPaid: "Monto Pagado",
    order: "Pedido",
    accessProduct: "Acceder al Producto",
    footerNote: "Nos pondremos en contacto en cuanto su pedido esté completo. Guarde este enlace para consultar el estado de su pedido cuando quiera.",
  },
} as const;

type Lang = keyof typeof translations;

export default function OrderTrackingPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [searchParams] = useSearchParams();

  const productName = searchParams.get("product");
  const amount = searchParams.get("amount");
  const currency = searchParams.get("currency") || "";
  const date = searchParams.get("date");
  const redirectUrl = searchParams.get("access");
  const langParam = searchParams.get("lang");
  const lang: Lang = langParam && langParam in translations ? (langParam as Lang) : "pt";
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card rounded-3xl shadow-xl shadow-muted-foreground/5 overflow-hidden border border-border">
          {/* Header */}
          <div className="p-8 text-center border-b bg-success/5 border-success/10">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-success/10">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t.title}</h1>
            <p className="text-muted-foreground text-sm">{t.subtitle}</p>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {/* Stepper — this page is only reachable via a link sent after a
                successful payment, so the first two steps are always done;
                fulfillment ("Processing") is the current step. */}
            <div className="flex items-start justify-between relative px-2">
              <div className="absolute top-4 left-8 right-8 h-0.5 bg-border" />
              <div className="absolute top-4 left-8 h-0.5 bg-success" style={{ width: "calc(100% - 4rem)" }} />
              {t.steps.map((label, i) => {
                const isLast = i === t.steps.length - 1;
                return (
                  <div key={label} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                    <div
                      className={
                        isLast
                          ? "w-8 h-8 rounded-full flex items-center justify-center border-2 bg-card border-primary text-primary animate-pulse"
                          : "w-8 h-8 rounded-full flex items-center justify-center border-2 bg-success border-success text-white"
                      }
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-center font-medium max-w-[5.5rem] text-foreground">{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{t.order}</h3>
              {productName && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{productName}</span>
                </div>
              )}
              {amount && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.amountPaid}</span>
                  <span className="font-bold text-foreground">{currency} {amount}</span>
                </div>
              )}
              {date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.orderDate}</span>
                  <span className="text-foreground">{date}</span>
                </div>
              )}
              {transactionId && (
                <div className="border-t border-border pt-3 text-xs text-muted-foreground font-mono break-all">
                  {transactionId}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">{t.footerNote}</p>

            {redirectUrl && (
              <Button
                onClick={() => window.open(redirectUrl, "_blank")}
                className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t.accessProduct}
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
