import { useState, useEffect } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Mail, User, Phone, Lock } from "lucide-react";
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
  // África do Sul / Moçambique (ZAR)
  { code: "+27", country: "🇿🇦 ZA", maxLen: 9 },
  { code: "+258", country: "🇲🇿 MZ", maxLen: 9 },
  // França / Bélgica / Suíça (EUR — funil francês)
  { code: "+33", country: "🇫🇷 FR", maxLen: 9 },
  { code: "+32", country: "🇧🇪 BE", maxLen: 9 },
  { code: "+41", country: "🇨🇭 CH", maxLen: 9 },
  // Lusófonos (EUR — aves / saúde bovina)
  { code: "+351", country: "🇵🇹 PT", maxLen: 9 },
  { code: "+55", country: "🇧🇷 BR", maxLen: 11 },
  { code: "+244", country: "🇦🇴 AO", maxLen: 9 },
  { code: "+238", country: "🇨🇻 CV", maxLen: 8 },
  { code: "+245", country: "🇬🇼 GW", maxLen: 8 },
  { code: "+239", country: "🇸🇹 ST", maxLen: 8 },
  // Hispanohablantes (USD — Reconquista Inversa)
  { code: "+52", country: "🇲🇽 MX", maxLen: 10 },
  { code: "+57", country: "🇨🇴 CO", maxLen: 10 },
  { code: "+54", country: "🇦🇷 AR", maxLen: 11 },
  { code: "+56", country: "🇨🇱 CL", maxLen: 9 },
  { code: "+51", country: "🇵🇪 PE", maxLen: 9 },
  { code: "+593", country: "🇪🇨 EC", maxLen: 9 },
  { code: "+58", country: "🇻🇪 VE", maxLen: 10 },
  { code: "+502", country: "🇬🇹 GT", maxLen: 8 },
  { code: "+591", country: "🇧🇴 BO", maxLen: 8 },
  { code: "+504", country: "🇭🇳 HN", maxLen: 8 },
  { code: "+595", country: "🇵🇾 PY", maxLen: 9 },
  { code: "+503", country: "🇸🇻 SV", maxLen: 8 },
  { code: "+505", country: "🇳🇮 NI", maxLen: 8 },
  { code: "+506", country: "🇨🇷 CR", maxLen: 8 },
  { code: "+507", country: "🇵🇦 PA", maxLen: 8 },
  { code: "+598", country: "🇺🇾 UY", maxLen: 9 },
  { code: "+34", country: "🇪🇸 ES", maxLen: 9 },
  // Outros / genéricos
  { code: "+1", country: "🇺🇸 US", maxLen: 10 },
  { code: "+44", country: "🇬🇧 UK", maxLen: 10 },
  { code: "+91", country: "🇮🇳 IN", maxLen: 10 },
  { code: "+234", country: "🇳🇬 NG", maxLen: 10 },
  { code: "+254", country: "🇰🇪 KE", maxLen: 9 },
];

// Mapeia moeda → prefixo telefônico padrão do país
const CURRENCY_TO_PREFIX: Record<string, string> = {
  ZAR: "+27",
  MZN: "+258",
  USD: "+52",
  MXN: "+52",
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
  localCurrency?: { code: string; amount: number; symbol: string } | null;
  showTrustBadges?: boolean;
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
  localCurrency,
  showTrustBadges = true,
}: StripeCheckoutFormProps) {
  const enabledMethods = stripePaymentMethods?.length ? stripePaymentMethods : ["card"];
  // Display methods in optimal conversion order. Wallets (Apple Pay / Google Pay)
  // are handled separately via `wallets: { applePay: 'auto', googlePay: 'auto' }`.
  const toStripeId = (m: string) => (m === "mbway" ? "mb_way" : m);
  const paymentMethodOrder = Array.from(
    new Set([
      "card",
      "bizum",
      "oxxo",
      "mb_way",
      "multibanco",
      "klarna",
      "paypal",
      ...enabledMethods.map(toStripeId),
    ])
  );
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [customerName, setCustomerName] = useState(initialName || "");
  const [customerEmail, setCustomerEmail] = useState(initialEmail || "");
  const [customerPhone, setCustomerPhone] = useState(initialPhone || "");
  const defaultPrefix = externalPrefix || (lang === "fr" ? "+33" : CURRENCY_TO_PREFIX[currency?.toUpperCase()]) || "+27";
  const [phonePrefix, setPhonePrefix] = useState(defaultPrefix);

  useEffect(() => {
    if (externalPrefix) {
      setPhonePrefix(externalPrefix);
    } else if (currency && CURRENCY_TO_PREFIX[currency.toUpperCase()]) {
      setPhonePrefix(CURRENCY_TO_PREFIX[currency.toUpperCase()]);
    }
  }, [externalPrefix, currency]);

  const currentPrefix = PHONE_PREFIXES.find(p => p.code === phonePrefix) || PHONE_PREFIXES[0];
  const phonePlaceholder = currentPrefix.code === "+27" ? "82 123 4567" : currentPrefix.code === "+258" ? "84 123 4567" : "123 456 7890";
  const phoneMaxLen = currentPrefix.maxLen;

  const isEn = lang === "en";
  const isEs = lang === "es";
  const isFr = lang === "fr";

  const t = (pt: string, en: string, es: string, fr?: string) => isFr ? (fr ?? en) : isEs ? es : isEn ? en : pt;

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
      onError(t("Introduza o seu nome", "Please enter your name", "Ingrese su nombre", "Veuillez entrer votre nom"));
      return;
    }

    if (!customerEmail || !customerEmail.includes("@")) {
      onError(t("Introduza um email válido", "Please enter a valid email", "Ingrese un email válido", "Veuillez entrer un email valide"));
      return;
    }

    // Telefone obrigatório: métodos como MB Way exigem um número válido, senão o pagamento falha.
    if (!customerPhone || customerPhone.replace(/\D/g, "").length < 6) {
      onError(t("Introduza um número de telefone válido", "Please enter a valid phone number", "Ingrese un número de teléfono válido", "Veuillez entrer un numéro de téléphone valide"));
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
        onError(error.message || t("Pagamento falhou", "Payment failed", "Pago fallido", "Le paiement a échoué"));
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
          onError(t("Pagamento em processamento. Será notificado.", "Payment is processing. You will be notified.", "Pago en procesamiento. Será notificado.", "Paiement en cours de traitement. Vous serez notifié(e)."));
        } else {
          onError(t("Pagamento falhou", "Payment failed", "Pago fallido", "Le paiement a échoué"));
        }
      }
    } catch (err) {
      console.error("Stripe error:", err);
      onError(t("Ocorreu um erro", "An error occurred", "Ocurrió un error", "Une erreur est survenue"));
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
              {t("Nome Completo", "Full Name", "Nombre Completo", "Nom Complet")}
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
              {t("Email", "Email Address", "Correo Electrónico", "Adresse Email")}
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
                {t("Quis dizer ", "Did you mean ", "¿Quisiste decir ", "Vouliez-vous dire ")}
                <span className="font-semibold underline">{emailSuggestion}</span>
                {t("?", "?", "?", "?")}
              </button>
            )}
          </div>

          {/* Phone with prefix selector */}
          <div>
            <Label className="block text-sm font-semibold text-foreground mb-1.5">
              {t("Número de Telefone", "Phone Number", "Número de Teléfono", "Numéro de Téléphone")}
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
          {t("Forma de pagamento", "Payment method", "Método de pago", "Moyen de paiement")}
        </Label>
        <PaymentElement
          options={{
            layout: {
              type: "accordion",
              defaultCollapsed: false,
              radios: "always",
              spacedAccordionItems: false,
              visibleAccordionItemsCount: 3,
            },
            business: {
              name: "Reconquista Inversa",
            },
            wallets: { applePay: "never", googlePay: "never", link: "never" },
            paymentMethodOrder: [
              "card",
              "mb_way",
              "bizum",
              "oxxo",
              "amazon_pay",
              "klarna",
              "paypal",
              "multibanco",
            ],
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
            {formatMoney(totalAmount, currency, isFr ? "fr-FR" : isEs ? "es-ES" : isEn ? "en-US" : "pt-PT")}
          </span>
        </div>
        {localCurrency && localCurrency.code !== currency && (
          <div className="flex justify-between items-center text-xs text-muted-foreground bg-muted/60 px-3 py-2 rounded-xl border border-border/60">
            <span>{isFr ? "Approx. dans votre devise :" : isEs ? "Aproximado en tu moneda:" : isEn ? "Approx. in your local currency:" : "Aprox. na tua moeda:"}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ≈ {(totalAmount * localCurrency.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency.code}
            </span>
          </div>
        )}
      </div>

      {/* Garantia — reduz o medo mesmo antes de pagar */}
      {showTrustBadges && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {t("Garantia de 7 dias — risco zero", "7-day guarantee — zero risk", "Garantía de 7 días — riesgo cero", "Garantie 30 jours — risque zéro")}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              {t("Se não gostares, devolvemos 100% do teu dinheiro.", "Not happy? We refund 100%, no questions.", "Si no te gusta, te devolvemos el 100%.", "Pas satisfait(e) ? Nous vous remboursons à 100%, sans question.")}
            </p>
          </div>
        </div>
      )}

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
              const amt = formatMoney(totalAmount, currency, isFr ? "fr-FR" : isEn ? "en-US" : "pt-PT");
              return isFr ? `Payer Maintenant - ${amt}` : isEn ? `Pay Now - ${amt}` : isEs ? `Pagar Ahora - ${amt}` : `Pagar Agora - ${amt}`;
            })()}
          </>
        )}
      </Button>

      {/* Uma linha de confiança: o nome da Stripe é o que transfere credibilidade.
          Tudo o resto que aqui estava repetia a garantia acima do botão, o
          seletor de métodos no topo, ou a si próprio. */}
      {showTrustBadges && (
        <p className="pt-1 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          {t("Pagamento seguro processado pela Stripe", "Secure payment processed by Stripe", "Pago seguro procesado por Stripe", "Paiement sécurisé traité par Stripe")}
        </p>
      )}
    </form>
  );
}
