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

const PHONE_PREFIXES = [
  { code: "+27", country: "🇿🇦 ZA", maxLen: 9 },
  { code: "+258", country: "🇲🇿 MZ", maxLen: 9 },
  { code: "+1", country: "🇺🇸 US", maxLen: 10 },
  { code: "+44", country: "🇬🇧 UK", maxLen: 10 },
  { code: "+351", country: "🇵🇹 PT", maxLen: 9 },
  { code: "+55", country: "🇧🇷 BR", maxLen: 11 },
  { code: "+244", country: "🇦🇴 AO", maxLen: 9 },
  { code: "+91", country: "🇮🇳 IN", maxLen: 10 },
  { code: "+234", country: "🇳🇬 NG", maxLen: 10 },
  { code: "+254", country: "🇰🇪 KE", maxLen: 9 },
];

interface StripeCheckoutFormProps {
  totalAmount: number;
  currency: string;
  lang: string;
  transactionId: string;
  redirectUrl: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  phonePrefix?: string;
  onPhonePrefixChange?: (prefix: string) => void;
  onCustomerNameChange?: (name: string) => void;
  onCustomerEmailChange?: (email: string) => void;
  onCustomerPhoneChange?: (phone: string) => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
  orderBumpSlot?: React.ReactNode;
  trackingParams?: TrackingParams;
  hideCustomerFields?: boolean;
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
  phonePrefix: externalPrefix,
  onPhonePrefixChange,
  onCustomerNameChange,
  onCustomerEmailChange,
  onCustomerPhoneChange,
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
  const [phonePrefix, setPhonePrefix] = useState(externalPrefix || "+27");

  const currentPrefix = PHONE_PREFIXES.find(p => p.code === phonePrefix) || PHONE_PREFIXES[0];
  const phonePlaceholder = currentPrefix.code === "+27" ? "82 123 4567" : currentPrefix.code === "+258" ? "84 123 4567" : "123 456 7890";
  const phoneMaxLen = currentPrefix.maxLen;

  const isEn = lang === "en";
  const isEs = lang === "es";

  const t = (pt: string, en: string, es: string) => isEs ? es : isEn ? en : pt;

  const handleNameChange = (val: string) => {
    setCustomerName(val);
    onCustomerNameChange?.(val);
  };
  const handleEmailChange = (val: string) => {
    setCustomerEmail(val);
    onCustomerEmailChange?.(val);
  };
  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    onCustomerPhoneChange?.(val);
  };
  const handlePrefixChange = (val: string) => {
    setPhonePrefix(val);
    onPhonePrefixChange?.(val);
  };

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
              customer_phone: `${phonePrefix}${customerPhone}`,
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
              phone: `${phonePrefix}${customerPhone}`,
            },
          },
        },
        redirect: "if_required",
      });

      if (error) {
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
            <Label className="block text-sm font-semibold text-foreground mb-1.5">
              {t("Nome Completo", "Full Name", "Nombre Completo")}
            </Label>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="John Doe"
              required
              className="h-12 rounded-xl border-border text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <Label className="block text-sm font-semibold text-foreground mb-1.5">
              {t("Email", "Email Address", "Correo Electrónico")}
            </Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="john@example.com"
              required
              className="h-12 rounded-xl border-border text-sm"
            />
          </div>

          {/* Phone with prefix selector */}
          <div>
            <Label className="block text-sm font-semibold text-foreground mb-1.5">
              {t("Número de Telefone", "Phone Number", "Número de Teléfono")}
            </Label>
            <div className="relative flex">
              <select
                value={phonePrefix}
                onChange={(e) => handlePrefixChange(e.target.value)}
                className="flex items-center justify-center px-3 bg-muted border border-r-0 border-border rounded-l-xl text-muted-foreground text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ minWidth: "90px" }}
              >
                {PHONE_PREFIXES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.country} {p.code}
                  </option>
                ))}
              </select>
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value.replace(/\D/g, "").slice(0, phoneMaxLen))}
                placeholder={phonePlaceholder}
                className="flex-1 rounded-l-none h-12 rounded-r-xl border-border text-sm font-mono"
              />
            </div>
          </div>
        </>
      )}

      {/* Order Bump */}
      {orderBumpSlot && (
        <div className="pt-2">
          {orderBumpSlot}
        </div>
      )}

      {/* Stripe PaymentElement */}
      <div className="pt-2">
        <Label className="block text-sm font-semibold text-foreground mb-3">
          {t("Dados do Cartão", "Card Details", "Datos de la Tarjeta")}
        </Label>
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
      </div>

      {/* Total */}
      <div className="pt-4 border-t border-border space-y-2">
        <div className="flex justify-between text-lg font-bold text-foreground">
          <span>Total</span>
          <span>
            {currency === "ZAR" ? "R" : currency} {totalAmount.toLocaleString(isEn ? "en-ZA" : "pt-MZ", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-14 rounded-xl bg-[hsl(145,60%,40%)] hover:bg-[hsl(145,60%,35%)] text-white font-bold text-base shadow-lg shadow-[hsl(145,60%,40%)]/25 active:scale-[0.98] transition-all"
      >
        {processing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {isEn ? `Pay Now - ${currency === "ZAR" ? "R" : currency} ${totalAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` 
              : isEs ? `Pagar Ahora - ${currency === "ZAR" ? "R" : currency} ${totalAmount.toLocaleString("pt-MZ", { minimumFractionDigits: 2 })}`
              : `Pagar Agora - ${currency === "ZAR" ? "R" : currency} ${totalAmount.toLocaleString("pt-MZ", { minimumFractionDigits: 2 })}`}
          </>
        )}
      </Button>

      <div className="text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          {t("Pagamento seguro e encriptado.", "Your payment is secure and encrypted.", "Su pago es seguro y encriptado.")}
        </p>
      </div>
    </form>
  );
}
