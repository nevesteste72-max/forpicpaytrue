import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, Circle, XCircle, PackageSearch, ExternalLink } from "lucide-react";
import cashpayLogoFull from "@/assets/picpay-logo.jpeg";

interface OrderStatus {
  id: string;
  status: "pending" | "processing" | "successful" | "failed";
  amount: number;
  currency: string;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  product_name: string | null;
  redirect_url: string | null;
  checkout_language: string;
}

const translations = {
  pt: {
    title: "Rastreio do Pedido",
    steps: ["Pedido Criado", "Processando Pagamento", "Concluído"],
    liveUpdate: "Atualizando automaticamente...",
    notFoundTitle: "Pedido não encontrado",
    notFoundDesc: "Verifique se o link de rastreio está correto.",
    failedTitle: "Pagamento não concluído",
    failedDesc: "Este pedido não foi processado com sucesso. Se acredita que isto é um erro, entre em contacto com o suporte.",
    successDesc: "O seu pagamento foi confirmado e o pedido foi concluído com sucesso!",
    orderDate: "Data do pedido",
    amountPaid: "Valor Pago",
    order: "Pedido",
    accessProduct: "Acessar Produto",
    genericError: "Não foi possível carregar o rastreio. Tente novamente mais tarde.",
  },
  en: {
    title: "Order Tracking",
    steps: ["Order Created", "Processing Payment", "Completed"],
    liveUpdate: "Auto-refreshing...",
    notFoundTitle: "Order not found",
    notFoundDesc: "Please check if the tracking link is correct.",
    failedTitle: "Payment not completed",
    failedDesc: "This order was not processed successfully. If you believe this is a mistake, please contact support.",
    successDesc: "Your payment was confirmed and your order was completed successfully!",
    orderDate: "Order date",
    amountPaid: "Amount Paid",
    order: "Order",
    accessProduct: "Access Product",
    genericError: "Could not load tracking info. Please try again later.",
  },
  es: {
    title: "Rastreo del Pedido",
    steps: ["Pedido Creado", "Procesando Pago", "Completado"],
    liveUpdate: "Actualizando automáticamente...",
    notFoundTitle: "Pedido no encontrado",
    notFoundDesc: "Verifique si el enlace de rastreo es correcto.",
    failedTitle: "Pago no completado",
    failedDesc: "Este pedido no fue procesado con éxito. Si cree que esto es un error, contacte con soporte.",
    successDesc: "¡Su pago fue confirmado y el pedido fue completado con éxito!",
    orderDate: "Fecha del pedido",
    amountPaid: "Monto Pagado",
    order: "Pedido",
    accessProduct: "Acceder al Producto",
    genericError: "No se pudo cargar el rastreo. Intente nuevamente más tarde.",
  },
} as const;

type Lang = keyof typeof translations;

export default function OrderTrackingPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!transactionId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-order-status?id=${transactionId}`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (res.status === 404) {
          setNotFound(true);
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        if (!res.ok) throw new Error("Request failed");

        const data: OrderStatus = await res.json();
        setOrder(data);
        setLoadError(false);

        if (data.status === "successful" || data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (err) {
        console.error("Failed to fetch order status:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [transactionId]);

  const lang: Lang = (order?.checkout_language as Lang) in translations ? (order?.checkout_language as Lang) : "pt";
  const t = translations[lang];

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl shadow-xl border border-border p-8 text-center">
          <PackageSearch className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">{t.notFoundTitle}</h1>
          <p className="text-muted-foreground">{t.notFoundDesc}</p>
        </div>
      </div>
    );
  }

  if (loadError && !order) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl shadow-xl border border-border p-8 text-center">
          <XCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{t.genericError}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const isFailed = order.status === "failed";
  const isSuccessful = order.status === "successful";
  // "pending" and "processing" both sit on the middle step — the order
  // record exists the moment checkout is submitted, so step 1 is always done
  // by the time this page can be reached.
  const currentStep = isSuccessful ? 2 : 1;
  const locale = order.currency === "ZAR" ? "en-ZA" : "pt-MZ";
  const formattedAmount = `${order.currency} ${Number(order.amount).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
  const formattedDate = new Date(order.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card rounded-3xl shadow-xl shadow-muted-foreground/5 overflow-hidden border border-border">
          {/* Header */}
          <div
            className={cn(
              "p-8 text-center border-b",
              isFailed ? "bg-destructive/5 border-destructive/10" : "bg-success/5 border-success/10"
            )}
          >
            <div
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                isFailed ? "bg-destructive/10" : "bg-success/10"
              )}
            >
              {isFailed ? (
                <XCircle className="w-10 h-10 text-destructive" />
              ) : (
                <CheckCircle2 className="w-10 h-10 text-success" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t.title}</h1>
            <p className="text-muted-foreground text-sm">
              {isFailed ? t.failedDesc : isSuccessful ? t.successDesc : t.liveUpdate}
            </p>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {isFailed ? (
              <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4 text-center">
                <h3 className="font-semibold text-destructive mb-1">{t.failedTitle}</h3>
                <p className="text-sm text-muted-foreground">{t.failedDesc}</p>
              </div>
            ) : (
              /* Stepper */
              <div className="flex items-start justify-between relative px-2">
                <div className="absolute top-4 left-8 right-8 h-0.5 bg-border" />
                <div
                  className="absolute top-4 left-8 h-0.5 bg-success transition-all duration-700"
                  style={{ width: currentStep === 2 ? "calc(100% - 4rem)" : "calc(50% - 2rem)" }}
                />
                {t.steps.map((label, i) => {
                  const done = i < currentStep || (i === currentStep && isSuccessful);
                  const active = i === currentStep && !isSuccessful;
                  return (
                    <div key={label} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border-2 bg-card",
                          done && "bg-success border-success text-white",
                          active && "border-primary text-primary animate-pulse",
                          !done && !active && "border-border text-muted-foreground"
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : active ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-xs text-center font-medium max-w-[5.5rem]",
                          done || active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{t.order}</h3>
              {order.product_name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{order.product_name}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.amountPaid}</span>
                <span className="font-bold text-foreground">{formattedAmount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.orderDate}</span>
                <span className="text-foreground">{formattedDate}</span>
              </div>
              <div className="border-t border-border pt-3 text-xs text-muted-foreground font-mono break-all">
                {order.id}
              </div>
            </div>

            {isSuccessful && order.redirect_url && (
              <Button
                onClick={() => window.open(order.redirect_url!, "_blank")}
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
