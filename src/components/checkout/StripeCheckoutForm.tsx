import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, User, Phone, Lock, Clock, RotateCcw } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { suggestEmail } from "@/lib/emailSuggest";

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

// Mapeia moeda → prefixo telefônico padrão do país
const CURRENCY_TO_PREFIX: Record<string, string> = {
  ZAR: "+27",
  MZN: "+258",
  USD: "+1",
  GBP: "+44",
  EUR: "+351",
  BRL: "+55",
  AOA: "+244",
  INR: "+91",
  NGN: "+234",
  KES: "+254",
};

interface StripeCheckoutFormProps {
  totalAmount: number;
  currency: string;
  lang: string;
  transactionId: string;
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
  onInitiateCheckout?: () => void;
  orderBumpSlot?: React.ReactNode;
  trackingParams?: TrackingParams;
  hideCustomerFields?: boolean;
  stripePaymentMethods?: string[];
}

export function StripeCheckoutForm({
  totalAmount,
  currency,
  lang,
  transactionId,
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
  onInitiateCheckout,
  orderBumpSlot,
  trackingParams,
  hideCustomerFields,
  stripePaymentMethods,
}: StripeCheckoutFormProps) {
  const enabledMethods = stripePaymentMethods?.length ? stripePaymentMethods : ["card"];
  const walletOrNever = (method: string) => (enabledMethods.includes(method) ? "auto" : "never") as "auto" | "never";
  // Display methods in the product's configured order, mapped to Stripe's canonical
  // ids ("mbway" -> "mb_way"). MB Way (instant) is forced ABOVE Multibanco (slow
  // reference) by listing multibanco last. Wallets (apple/google pay) are handled
  // separately via `wallets`. Extra ids not offered by the account are ignored by Stripe.
  const toStripeId = (m: string) => (m === "mbway" ? "mb_way" : m);
  const paymentMethodOrder = Array.from(
    new Set([
      ...enabledMethods
        .filter((m) => m !== "apple_pay" && m !== "google_pay")
        .map(toStripeId),
      "multibanco",
    ])
  );
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [customerName, setCustomerName] = useState(initialName || "");
  const [customerEmail, setCustomerEmail] = useState(initialEmail || "");
  const [customerPhone, setCustomerPhone] = useState(initialPhone || "");
  const defaultPrefix = externalPrefix || CURRENCY_TO_PREFIX[currency?.toUpperCase()] || "+27";
  const [phonePrefix, setPhonePrefix] = useState(defaultPrefix);

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
  // Shown, never applied silently: a wrong auto-correction mails a stranger.
  const emailSuggestion = suggestEmail(customerEmail);
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

    // Telefone obrigatório: métodos como MB Way exigem um número válido, senão o pagamento falha.
    if (!customerPhone || customerPhone.replace(/\D/g, "").length < 6) {
      onError(t("Introduza um número de telefone válido", "Please enter a valid phone number", "Ingrese un número de teléfono válido"));
      return;
    }

    onInitiateCheckout?.();
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
        // Stripe still returns the PaymentIntent (usually in "requires_payment_method")
        // even on a declined card — without its id, the backend has nothing to look up
        // and rejects the confirm call, so the transaction never gets marked as failed
        // and no reminder email/WhatsApp goes out.
        const failedPaymentIntentId = error.payment_intent?.id;
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
                payment_intent_id: failedPaymentIntentId || null,
                payment_status: "failed",
                customer_email: customerEmail,
                customer_name: customerName,
                tracking_params: trackingParams,
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
            {emailSuggestion && (
              <button
                type="button"
                onClick={() => handleEmailChange(emailSuggestion)}
                className="mt-1.5 text-xs text-left text-muted-foreground hover:text-foreground"
              >
                {t("Quis dizer ", "Did you mean ", "¿Quisiste decir ")}
                <span className="font-semibold underline">{emailSuggestion}</span>
                {t("?", "?", "?")}
              </button>
            )}
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
                required
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
          {t("Forma de pagamento", "Payment method", "Método de pago")}
        </Label>
        <PaymentElement
          options={{
            layout: "accordion",
            business: {
              name: "PicPay",
            },
            wallets: { applePay: walletOrNever("apple_pay"), googlePay: walletOrNever("google_pay"), link: walletOrNever("link") },
            paymentMethodOrder,
            // We already collect name/email/phone above and pass them in confirmParams,
            // so don't re-ask those. Address stays "auto" so methods that require it
            // (Klarna, PayPal, SEPA) can still collect it when selected.
            fields: {
              billingDetails: {
                name: "never",
                email: "never",
                phone: "never",
                address: "auto",
              },
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
            {formatMoney(totalAmount, currency, isEn ? "en-US" : "pt-PT")}
          </span>
        </div>
      </div>

      {/* Garantia — reduz o medo mesmo antes de pagar */}
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">
            {t("Garantia de 7 dias — risco zero", "7-day guarantee — zero risk", "Garantía de 7 días — riesgo cero")}
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            {t("Se não gostares, devolvemos 100% do teu dinheiro.", "Not happy? We refund 100%, no questions.", "Si no te gusta, te devolvemos el 100%.")}
          </p>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
      >
        {processing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {(() => {
              const amt = formatMoney(totalAmount, currency, isEn ? "en-US" : "pt-PT");
              return isEn ? `Pay Now - ${amt}` : isEs ? `Pagar Ahora - ${amt}` : `Pagar Agora - ${amt}`;
            })()}
          </>
        )}
      </Button>

      {/* Rodapé de confiança */}
      <div className="pt-1 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 text-center">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] leading-tight text-muted-foreground">{t("Pagamento encriptado", "Encrypted payment", "Pago encriptado")}</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] leading-tight text-muted-foreground">{t("Acesso imediato", "Instant access", "Acceso inmediato")}</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] leading-tight text-muted-foreground">{t("Reembolso 7 dias", "7-day refund", "Reembolso 7 días")}</span>
          </div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          {t("Compra 100% segura · processada pela Stripe", "100% secure checkout · processed by Stripe", "Compra 100% segura · procesada por Stripe")}
        </p>
        <div className="flex items-center justify-center gap-1.5 opacity-70 flex-wrap">
          {["Visa", "Mastercard", "MB WAY", "Multibanco"].map((m) => (
            <span key={m} className="text-[9px] font-semibold tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">{m}</span>
          ))}
        </div>
      </div>
    </form>
  );
}
