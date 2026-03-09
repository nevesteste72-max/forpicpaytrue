import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackingParams {
  src?: string | null;
  sck?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

interface StripeCheckoutFormProps {
  totalAmount: number;
  currency: string;
  lang: string;
  transactionId: string;
  redirectUrl: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  orderBumpSlot?: React.ReactNode;
  trackingParams?: TrackingParams;
  hideCustomerFields?: boolean;
}

function getPhoneConfig(currency: string) {
  switch (currency) {
    case "ZAR": return { prefix: "+27", maxLen: 10, placeholder: "61 234 5678" };
    case "MZN": return { prefix: "+258", maxLen: 9, placeholder: "84 123 4567" };
    default: return { prefix: "+1", maxLen: 15, placeholder: "555 123 4567" }; // USD/international
  }
}

export function StripeCheckoutForm({
  totalAmount,
  currency,
  lang,
  transactionId,
  redirectUrl,
  customerName: initialName,
  customerEmail: initialEmail,
  customerPhone: initialPhone,
  onSuccess,
  onError,
  orderBumpSlot,
  trackingParams,
  hideCustomerFields,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [customerName, setCustomerName] = useState(initialName || "");
  const [customerEmail, setCustomerEmail] = useState(initialEmail || "");
  const [customerPhone, setCustomerPhone] = useState(initialPhone || "");
  const phoneConfig = getPhoneConfig(currency);

  const isEn = lang === "en";
  const isEs = lang === "es";

  const t = (pt: string, en: string, es: string) => isEs ? es : isEn ? en : pt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!customerName.trim()) {
      onError(t("Introduza o seu nome", "Please enter your name", "Ingrese su nombre"));
      return;
    }

    if (!customerEmail || !customerEmail.includes("@")) {
      onError(t("Introduza um email válido", "Please enter a valid email", "Ingrese un email válido"));
      return;
    }

    // No phone validation - allow any number through

    setProcessing(true);

    try {
      // Update transaction with real customer info
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook-confirm`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transaction_id: transactionId,
              update_customer: true,
              customer_email: customerEmail,
              customer_name: customerName,
              customer_phone: `${phoneConfig.prefix}${customerPhone}`,
            }),
          }
        );
      } catch (err) {
        console.error("Failed to update customer info:", err);
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href + "?payment=success",
          payment_method_data: {
            billing_details: {
              name: customerName,
              email: customerEmail,
              phone: `${phoneConfig.prefix}${customerPhone}`,
            },
          },
        },
        redirect: "if_required",
      });

      if (error) {
        // Notify backend of failed payment for auto WhatsApp
        try {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook-confirm`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                transaction_id: transactionId,
                payment_status: "failed",
              }),
            }
          );
        } catch (notifyErr) {
          console.error("Failed to notify failed payment:", notifyErr);
        }
        onError(error.message || t("Pagamento falhou", "Payment failed", "Pago fallido"));
        return;
      }

      if (paymentIntent) {
        const status = paymentIntent.status;
        // Map Stripe status to our status
        const mappedStatus = status === "succeeded" ? "successful"
          : status === "processing" || status === "requires_action" ? "pending"
          : "failed";

        try {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook-confirm`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                transaction_id: transactionId,
                payment_intent_id: paymentIntent.id,
                payment_status: mappedStatus,
                customer_email: customerEmail,
                customer_name: customerName,
                tracking_params: trackingParams,
              }),
            }
          );
        } catch (err) {
          console.error("Failed to confirm transaction:", err);
        }

        if (status === "succeeded") {
          onSuccess();
          if (redirectUrl) {
            setTimeout(() => window.open(redirectUrl, "_blank"), 1500);
          }
        } else if (status === "processing") {
          onError(t("Pagamento em processamento. Será notificado.", "Payment is processing. You will be notified.", "Pago en procesamiento. Será notificado."));
        } else {
          onError(t("Pagamento falhou", "Payment failed", "Pago fallido"));
        }
      }
    } catch (err) {
      console.error("Stripe error:", err);
      onError(t("Ocorreu um erro", "An error occurred", "Ocurrió un error"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hideCustomerFields && (
        <>
          {/* Name */}
          <div>
            <Label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
              {t("Nome", "Name", "Nombre")}
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t("Seu nome completo", "Your full name", "Tu nombre completo")}
                required
                className="pl-10 h-11 rounded-lg border-border focus:border-primary text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
              {t("Email", "Email", "Correo electrónico")}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-muted-foreground w-4 h-4" />
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder={t("exemplo@email.com", "example@email.com", "ejemplo@email.com")}
                required
                className="pl-10 h-11 rounded-lg border-border focus:border-primary text-sm"
              />
            </div>
          </div>

          {/* Phone - hide for USD/international */}
          {(currency === "MZN" || currency === "ZAR") && (
            <div>
              <Label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                {t("Número de Telefone", "Phone Number", "Número de Teléfono")}
              </Label>
              <div className="relative flex">
                <div className="flex items-center justify-center px-3 bg-muted border border-r-0 border-border rounded-l-lg text-muted-foreground text-sm font-medium">
                  <Phone className="w-4 h-4 mr-2" />
                  {phoneConfig.prefix}
                </div>
                <Input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, phoneConfig.maxLen))}
                  placeholder={phoneConfig.placeholder}
                  className="flex-1 rounded-l-none h-11 rounded-r-lg border-border text-sm font-mono"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Stripe PaymentElement */}
      <PaymentElement
        options={{
          layout: "accordion",
          wallets: { applePay: "never", googlePay: "never", link: "never" },
          paymentMethodOrder: ["card"],
          fields: {
            billingDetails: "auto",
          },
          terms: {
            card: "never",
          },
        }}
      />

      {/* Order Bump */}
      {orderBumpSlot && (
        <div className="pt-2">
          {orderBumpSlot}
        </div>
      )}

      {/* Total */}
      <div className="pt-4 border-t border-border space-y-2">
        <div className="flex justify-between text-lg font-bold text-foreground">
          <span>Total</span>
          <span>
            {currency} {totalAmount.toLocaleString(isEn ? "en-ZA" : "pt-MZ", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all group relative overflow-hidden"
      >
        <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <span className="relative z-10 flex items-center justify-center gap-2">
          {processing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            isEn ? "Pay Now" : isEs ? "Pagar Ahora" : "Pagar Agora"
          )}
        </span>
      </Button>

      <div className="text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          {t("Pagamento seguro processado pelo Stripe", "Secure payment processed by Stripe", "Pago seguro procesado por Stripe")}
        </p>
      </div>
    </form>
  );
}
