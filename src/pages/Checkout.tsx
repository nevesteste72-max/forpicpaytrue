import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { OrderBump } from "@/components/checkout/OrderBump";
import { RecoveryPopup, useExitIntent } from "@/components/checkout/RecoveryPopup";
import { StripeCheckoutForm } from "@/components/checkout/StripeCheckoutForm";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { useUtmifyScript, getStoredTracking } from "@/hooks/useUtmifyScript";
import {
  initiatePayment,
  formatPhoneNumber,
  checkTransactionStatus,
} from "@/lib/debito";
import {
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Wallet,
  Mail,
  Lock,
  Shield,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutTimer } from "@/components/checkout/CheckoutTimer";
import cashpayLogoFull from "@/assets/cashpay-logo-full.png";
import cashpayIcon from "@/assets/cashpay-icon.png";
import mpesaLogo from "@/assets/mpesa-logo.png";
import emolaLogo from "@/assets/emola-logo.png";

// Start loading stripe key immediately on module load (not waiting for component mount)
let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise;
  
  stripePromise = (async () => {
    try {
      const cachedKey = sessionStorage.getItem("stripe_pk");
      if (cachedKey) return loadStripe(cachedKey);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-key`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await res.json();
      if (data.publishable_key) {
        sessionStorage.setItem("stripe_pk", data.publishable_key);
        return loadStripe(data.publishable_key);
      }
      console.error("No Stripe publishable key returned");
      return null;
    } catch (err) {
      console.error("Failed to fetch Stripe key:", err);
      return null;
    }
  })();
  
  return stripePromise;
}

// Eagerly start loading Stripe on module init
getStripePromise();

interface PaymentLink {
  id: string;
  product_name: string;
  product_description: string | null;
  logo_url: string | null;
  amount: number;
  order_bump_name: string | null;
  order_bump_description: string | null;
  order_bump_price: number | null;
  order_bump_2_name: string | null;
  order_bump_2_description: string | null;
  order_bump_2_price: number | null;
  order_bump_3_name: string | null;
  order_bump_3_description: string | null;
  order_bump_3_price: number | null;
  redirect_url: string | null;
  currency: string;
  checkout_language: string;
  stripe_payment_methods: string[];
  facebook_pixel_id?: string | null;
  facebook_token?: string | null;
  checkout_banner_url?: string | null;
  checkout_timer_minutes?: number | null;
  recovery_enabled?: boolean;
  recovery_discount_percent?: number;
  recovery_headline?: string | null;
  recovery_message?: string | null;
  recovery_cta_text?: string | null;
  recovery_redirect_url?: string | null;
  show_trust_badges?: boolean;
}

type PaymentState = "form" | "processing" | "pending" | "success" | "failed";
type SelectedMethod = "mpesa" | "emola" | null;

// i18n labels
const labels = {
  pt: {
    name: "Nome",
    namePlaceholder: "Seu nome completo",
    email: "Email para recebimento",
    emailPlaceholder: "exemplo@email.com",
    phone: "Número de Telefone",
    phoneMpesa: "Número M-Pesa",
    phoneEmola: "Número eMola",
    paymentMethod: "Método de pagamento",
    total: "Total",
    payMpesa: "Pagar com M-Pesa",
    payEmola: "Pagar com eMola",
    securePayment: "Pagamento processado de forma segura via M-Pesa API",
    securePaymentEmola: "Pagamento processado de forma segura via eMola API",
    emolaSoon: "Em Breve",
    processing: "Enviando ao M-Pesa...",
    processingEmola: "Enviando ao eMola...",
    processingDesc: "Aguarde enquanto iniciamos o pagamento",
    confirmPhone: "Confirme no telemóvel",
    confirmPhoneDesc: "Introduza o PIN do M-Pesa no seu telefone para concluir o pagamento",
    confirmPhoneDescEmola: "Introduza o PIN do eMola no seu telefone para concluir o pagamento",
    totalValue: "Valor total",
    waiting: "Aguardando confirmação...",
    cancel: "Cancelar",
    paymentReceived: "Pagamento Recebido!",
    receiptSent: "Enviamos o recibo para o seu email.",
    accessContent: "Acessar Conteúdo",
    paymentFailed: "Pagamento falhou",
    tryAgain: "Tentar novamente",
    notFound: "Link não encontrado",
    notFoundDesc: "Este link de pagamento não existe ou foi desactivado.",
    invalidEmail: "Email inválido",
    invalidEmailDesc: "Introduza um email válido",
    phoneRequired: "Número de telefone é obrigatório",
    phoneInvalid: "Número inválido. Use formato: 84XXXXXXX ou 85XXXXXXX",
    phoneInvalidEmola: "Número inválido. Use formato: 86XXXXXXX ou 87XXXXXXX",
    paymentDeclined: "O pagamento foi recusado ou cancelado.",
    connectionError: "Erro de conexão. Tente novamente.",
    stripeProcessing: "Processando pagamento...",
    selectMethod: "Selecione um método de pagamento",
  },
  en: {
    name: "Name",
    namePlaceholder: "Your full name",
    email: "Email for receipt",
    emailPlaceholder: "example@email.com",
    phone: "Phone Number",
    phoneMpesa: "M-Pesa Number",
    phoneEmola: "eMola Number",
    paymentMethod: "Payment method",
    total: "Total",
    payMpesa: "Pay with M-Pesa",
    payEmola: "Pay with eMola",
    securePayment: "Secure payment processed via M-Pesa API",
    securePaymentEmola: "Secure payment processed via eMola API",
    emolaSoon: "Coming Soon",
    processing: "Sending to M-Pesa...",
    processingEmola: "Sending to eMola...",
    processingDesc: "Please wait while we initiate the payment",
    confirmPhone: "Confirm on your phone",
    confirmPhoneDesc: "Enter your M-Pesa PIN on your phone to complete the payment",
    confirmPhoneDescEmola: "Enter your eMola PIN on your phone to complete the payment",
    totalValue: "Total amount",
    waiting: "Waiting for confirmation...",
    cancel: "Cancel",
    paymentReceived: "Payment Received!",
    receiptSent: "We sent the receipt to your email.",
    accessContent: "Access Content",
    paymentFailed: "Payment Failed",
    tryAgain: "Try Again",
    notFound: "Link not found",
    notFoundDesc: "This payment link does not exist or has been deactivated.",
    invalidEmail: "Invalid email",
    invalidEmailDesc: "Please enter a valid email",
    phoneRequired: "Phone number is required",
    phoneInvalid: "Invalid number. Use format: 84XXXXXXX or 85XXXXXXX",
    phoneInvalidEmola: "Invalid number. Use format: 86XXXXXXX or 87XXXXXXX",
    paymentDeclined: "The payment was declined or cancelled.",
    connectionError: "Connection error. Please try again.",
    stripeProcessing: "Processing payment...",
    selectMethod: "Select a payment method",
  },
  es: {
    name: "Nombre",
    namePlaceholder: "Tu nombre completo",
    email: "Email para recibo",
    emailPlaceholder: "ejemplo@email.com",
    phone: "Número de Teléfono",
    phoneMpesa: "Número M-Pesa",
    phoneEmola: "Número eMola",
    paymentMethod: "Método de pago",
    total: "Total",
    payMpesa: "Pagar con M-Pesa",
    payEmola: "Pagar con eMola",
    securePayment: "Pago procesado de forma segura vía M-Pesa API",
    securePaymentEmola: "Pago procesado de forma segura vía eMola API",
    emolaSoon: "Próximamente",
    processing: "Enviando a M-Pesa...",
    processingEmola: "Enviando a eMola...",
    processingDesc: "Espere mientras iniciamos el pago",
    confirmPhone: "Confirme en su teléfono",
    confirmPhoneDesc: "Ingrese su PIN de M-Pesa en su teléfono para completar el pago",
    confirmPhoneDescEmola: "Ingrese su PIN de eMola en su teléfono para completar el pago",
    totalValue: "Monto total",
    waiting: "Esperando confirmación...",
    cancel: "Cancelar",
    paymentReceived: "¡Pago Recibido!",
    receiptSent: "Enviamos el recibo a su email.",
    accessContent: "Acceder al Contenido",
    paymentFailed: "Pago Fallido",
    tryAgain: "Intentar de nuevo",
    notFound: "Enlace no encontrado",
    notFoundDesc: "Este enlace de pago no existe o fue desactivado.",
    invalidEmail: "Email inválido",
    invalidEmailDesc: "Ingrese un email válido",
    phoneRequired: "Número de teléfono es obligatorio",
    phoneInvalid: "Número inválido. Use formato: 84XXXXXXX o 85XXXXXXX",
    phoneInvalidEmola: "Número inválido. Use formato: 86XXXXXXX o 87XXXXXXX",
    paymentDeclined: "El pago fue rechazado o cancelado.",
    connectionError: "Error de conexión. Intente de nuevo.",
    stripeProcessing: "Procesando pago...",
    selectMethod: "Seleccione un método de pago",
  },
};

export default function Checkout() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [bumpsAccepted, setBumpsAccepted] = useState<boolean[]>([false, false, false]);
  const [selectedMethod, setSelectedMethod] = useState<SelectedMethod>("mpesa");
  const [phonePrefix, setPhonePrefix] = useState("+27");

  // Stripe state
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1); // kept for resetForm compat
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeTransactionId, setStripeTransactionId] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Polling refs (M-Pesa)
  const [debitoReference, setDebitoReference] = useState<string | null>(null);
  const [internalTxId, setInternalTxId] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Recovery popup state
  const [recoveryTrigger, setRecoveryTrigger] = useState<"exit_intent" | "payment_failed" | null>(null);
  const recoveryShownRef = useRef(false);

  // Exit intent detection
  useExitIntent(
    !!(link?.recovery_enabled && paymentState === "form" && !recoveryShownRef.current),
    () => {
      if (!recoveryShownRef.current) {
        recoveryShownRef.current = true;
        setRecoveryTrigger("exit_intent");
      }
    }
  );

  // Capture UTM/tracking params from URL + sessionStorage for UTMify attribution
  const trackingParams = useMemo(() => {
    const stored = getStoredTracking();
    const fromUrl = {
      src: searchParams.get("src") || searchParams.get("ref") || null,
      sck: searchParams.get("sck") || null,
      utm_source: searchParams.get("utm_source") || null,
      utm_campaign: searchParams.get("utm_campaign") || null,
      utm_medium: searchParams.get("utm_medium") || null,
      utm_content: searchParams.get("utm_content") || null,
      utm_term: searchParams.get("utm_term") || null,
    };
    return {
      src: fromUrl.src || stored.src || null,
      sck: fromUrl.sck || stored.sck || null,
      utm_source: fromUrl.utm_source || stored.utm_source || null,
      utm_campaign: fromUrl.utm_campaign || stored.utm_campaign || null,
      utm_medium: fromUrl.utm_medium || stored.utm_medium || null,
      utm_content: fromUrl.utm_content || stored.utm_content || null,
      utm_term: fromUrl.utm_term || stored.utm_term || null,
    };
  }, [searchParams]);

  const lang = (link?.checkout_language || "pt") as "pt" | "en" | "es";
  const t = labels[lang];
  const isStripe = link?.currency !== "MZN";
  const isEmola = selectedMethod === "emola";
  const currencySymbol = link?.currency || "MZN";
  const locale = lang === "en" ? "en-US" : "pt-MZ";

  // Local currency conversion for USD products
  const [localCurrency, setLocalCurrency] = useState<{ code: string; amount: number; symbol: string } | null>(null);

  useEffect(() => {
    if (link?.currency !== "USD" || !link) return;
    const detectAndConvert = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const geo = await res.json();
        const userCurrency = geo.currency || null;
        if (!userCurrency || userCurrency === "USD") return;
        const rateRes = await fetch(`https://open.er-api.com/v6/latest/USD`);
        const rateData = await rateRes.json();
        const rate = rateData.rates?.[userCurrency];
        if (rate) {
          setLocalCurrency({ code: userCurrency, amount: rate, symbol: userCurrency });
        }
      } catch (err) {
        console.error("Currency conversion error:", err);
      }
    };
    detectAndConvert();
  }, [link?.currency, link?.id]);

  // Facebook Pixel
  const { trackPurchase, trackInitiateCheckout } = useFacebookPixel(link?.facebook_pixel_id);

  // UTMify tracking script — injected on every checkout
  useUtmifyScript();

  // Check if this product has upsell/downsell flow steps
  const checkAndRedirectToFlow = useCallback(async (transactionId: string) => {
    if (!link) return false;
    try {
      const { data: flowSteps } = await supabase
        .from("flow_steps")
        .select("id, page_url")
        .eq("payment_link_id", link.id)
        .order("step_order", { ascending: true })
        .limit(1);

      if (flowSteps && flowSteps.length > 0) {
        const firstStep = flowSteps[0];
        const pageUrl = (firstStep as any).page_url;

        if (pageUrl) {
          // Redirect to the merchant's external page with tx params
          const separator = pageUrl.includes("?") ? "&" : "?";
          const externalUrl = `${pageUrl}${separator}cashpay_tx=${transactionId}&cashpay_link=${link.id}`;
          window.location.href = externalUrl;
        } else {
          // Fallback: internal upsell page
          navigate(`/upsell/${firstStep.id}?tx=${transactionId}&link=${link.id}`);
        }
        return true;
      }
    } catch (err) {
      console.error("Failed to check flow steps:", err);
    }
    return false;
  }, [link, navigate]);

  useEffect(() => {
    if (linkId) fetchLink();
  }, [linkId]);

  // Fire InitiateCheckout as soon as checkout page loads and pixel is ready
  const icFired = useRef(false);
  useEffect(() => {
    if (link && !icFired.current && link.facebook_pixel_id) {
      icFired.current = true;
      trackInitiateCheckout(
        Number(link.amount),
        link.currency || "MZN"
      );
    }
  }, [link]);

  // Preload Stripe instance only (no PaymentIntent yet)
  useEffect(() => {
    if (!isStripe || !link) return;
    const init = async () => {
      setStripeLoading(true);
      try {
        const s = await getStripePromise();
        setStripeInstance(s);
      } catch (err) {
        console.error("Failed to init Stripe:", err);
      } finally {
        setStripeLoading(false);
      }
    };
    init();
  }, [isStripe, link?.id]);

  // Auto-create PaymentIntent on page load for Stripe
  useEffect(() => {
    if (isStripe && link && !clientSecret && !stripeLoading && stripeInstance) {
      createStripePaymentIntent();
    }
  }, [isStripe, link?.id, stripeInstance]);

  // Create PaymentIntent
  const createStripePaymentIntent = async () => {
    if (!link) return;
    setStripeLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_link_id: link.id,
            amount: totalAmount,
            currency: link.currency,
            customer_email: email || `temp_${Date.now()}@checkout.cashpay.co`,
            customer_name: customerName || "Customer",
            payment_methods: link.stripe_payment_methods,
            order_bump_accepted: bumpAccepted,
            bumps_accepted: bumpsAccepted,
            order_bump_amount: bumpAmount,
          }),
        }
      );
      const result = await response.json();
      if (result.success && result.client_secret) {
        setClientSecret(result.client_secret);
        setStripeTransactionId(result.transaction_id);
        const piId = result.client_secret.split("_secret_")[0];
        setStripePaymentIntentId(piId);
      } else {
        console.error("Failed to create PaymentIntent:", result.error);
      }
    } catch (err) {
      console.error("Failed to create Stripe payment:", err);
    } finally {
      setStripeLoading(false);
    }
  };

  // Update Stripe PaymentIntent when order bump is toggled
  useEffect(() => {
    if (!isStripe || !stripePaymentIntentId || !stripeTransactionId || !link) return;

    const updateIntent = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              update_intent: true,
              payment_intent_id: stripePaymentIntentId,
              transaction_id: stripeTransactionId,
              payment_link_id: link.id,
              order_bump_accepted: bumpAccepted,
              bumps_accepted: bumpsAccepted,
            }),
          }
        );
        const result = await response.json();
        if (!result.success) {
          console.error("Failed to update PaymentIntent:", result.error);
        }
      } catch (err) {
        console.error("Failed to update PaymentIntent:", err);
      }
    };

    updateIntent();
  }, [bumpsAccepted, stripePaymentIntentId]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus === "success") setPaymentState("success");
  }, [searchParams]);

  // Polling for M-Pesa payment status
  useEffect(() => {
    if (paymentState === "pending" && debitoReference && !isStripe) {
      let attempts = 0;
      const maxAttempts = 60;

      pollingRef.current = window.setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          return;
        }

        try {
          const result = await checkTransactionStatus(debitoReference, internalTxId, trackingParams);
          if (result.status === "completed" || result.status === "success" || result.status === "successful") {
            trackPurchase(totalAmount, currencySymbol, internalTxId || undefined);
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Check for upsell flow before showing success
            const hasFlow = await checkAndRedirectToFlow(internalTxId || "");
            if (!hasFlow) setPaymentState("success");
          } else if (result.status === "failed") {
            setErrorMessage(t.paymentDeclined);
            setPaymentState("failed");
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch (err) {
          console.error("Status check error:", err);
        }
      }, 5000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentState, debitoReference, internalTxId, isStripe]);

  const fetchLink = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_links")
        .select("id, product_name, product_description, logo_url, amount, order_bump_name, order_bump_description, order_bump_price, order_bump_2_name, order_bump_2_description, order_bump_2_price, order_bump_3_name, order_bump_3_description, order_bump_3_price, redirect_url, currency, checkout_language, stripe_payment_methods, facebook_pixel_id, facebook_token, checkout_banner_url, checkout_timer_minutes, recovery_enabled, recovery_discount_percent, recovery_headline, recovery_message, recovery_cta_text, recovery_redirect_url, show_trust_badges")
        .eq("id", linkId)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setLink(data);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const bumps = link ? [
    { name: link.order_bump_name, desc: link.order_bump_description, price: link.order_bump_price },
    { name: link.order_bump_2_name, desc: link.order_bump_2_description, price: link.order_bump_2_price },
    { name: link.order_bump_3_name, desc: link.order_bump_3_description, price: link.order_bump_3_price },
  ].filter(b => b.name && b.price && Number(b.price) > 0) : [];
  const hasBump = bumps.length > 0;
  const bumpAmount = bumps.reduce((sum, b, i) => sum + (bumpsAccepted[i] ? Number(b.price) : 0), 0);
  const bumpAccepted = bumpsAccepted.some(Boolean);
  const totalAmount = link ? Number(link.amount) + bumpAmount : 0;

  // --- M-Pesa / eMola submit ---
  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;

    setPhoneError("");

    if (!email || !email.includes("@")) {
      toast({ title: t.invalidEmail, description: t.invalidEmailDesc, variant: "destructive" });
      return;
    }

    if (!phone) {
      setPhoneError(t.phoneRequired);
      return;
    }

    if (selectedMethod === "mpesa") {
      // M-Pesa: prefixes 84, 85
      const digits = formatPhoneNumber(phone);
      if (!/^8[45]\d{7}$/.test(digits)) {
        setPhoneError(t.phoneInvalid);
        return;
      }
    } else if (selectedMethod === "emola") {
      // eMola: prefixes 86, 87
      const digits = formatPhoneNumber(phone);
      if (!/^8[67]\d{7}$/.test(digits)) {
        setPhoneError(t.phoneInvalidEmola);
        return;
      }
    }

    setPaymentState("processing");

    try {
      const shortDescription = link.product_name.slice(0, 20);
      const response = await initiatePayment({
        method: selectedMethod!,
        amount: totalAmount,
        msisdn: formatPhoneNumber(phone),
        reference_description: shortDescription,
        payment_link_id: link.id,
        customer_email: email,
        customer_name: customerName,
        customer_phone: formatPhoneNumber(phone),
        order_bump_accepted: bumpAccepted,
        order_bump_amount: bumpAmount,
      });

      if (response.success) {
        setDebitoReference(response.debito_reference || null);
        setInternalTxId(response.internal_transaction_id || null);

        if (response.redirect_url) {
          window.location.href = response.redirect_url;
        } else {
          setPaymentState("pending");
        }
      } else {
        throw new Error(response.error || "Falha ao processar pagamento");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setErrorMessage(error instanceof Error ? error.message : t.connectionError);
      setPaymentState("failed");
    }
  };

  const resetForm = async () => {
    setPhoneError("");
    setErrorMessage("");
    setBumpsAccepted([false, false, false]);
    setDebitoReference(null);
    setInternalTxId(null);
    setCheckoutStep(1);
    // Reset Stripe state and recreate PaymentIntent
    setClientSecret(null);
    setStripeTransactionId(null);
    setStripePaymentIntentId(null);
    setStripeLoading(false);
    // Set form state AFTER resetting stripe state
    setPaymentState("form");
  };

  const stripeOptions = useMemo(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: {
        theme: "stripe" as const,
        variables: {
          colorPrimary: "hsl(168, 80%, 28%)",
          borderRadius: "12px",
        },
      },
      locale: (lang === "pt" ? "pt-BR" : "en") as "pt-BR" | "en",
    };
  }, [clientSecret, lang]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !link) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-foreground">{t.notFound}</h1>
          <p className="text-muted-foreground">{t.notFoundDesc}</p>
        </div>
      </div>
    );
  }

  // Payment status screens (non-form)
  if (paymentState !== "form") {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl shadow-muted-foreground/5 border border-border text-center animate-scale-in">
          {paymentState === "processing" && (
            <>
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold mb-2 text-foreground">
                {isStripe ? t.stripeProcessing : isEmola ? t.processingEmola : t.processing}
              </h2>
              <p className="text-muted-foreground">{t.processingDesc}</p>
            </>
          )}

          {paymentState === "pending" && (
            <>
              <div className="w-16 h-16 rounded-full bg-pending/10 mx-auto mb-4 flex items-center justify-center">
                <Phone className="w-8 h-8 text-pending animate-pulse" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">{t.confirmPhone}</h2>
              <p className="text-muted-foreground mb-6">
                {isEmola ? t.confirmPhoneDescEmola : t.confirmPhoneDesc}
              </p>
              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">{t.totalValue}</p>
                <p className="text-2xl font-bold text-primary">
                  {totalAmount.toLocaleString(locale)} {currencySymbol}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.waiting}</span>
              </div>
              <Button variant="outline" onClick={resetForm} className="rounded-lg">
                {t.cancel}
              </Button>
            </>
          )}

          {paymentState === "success" && (
            <>
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center text-success mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-foreground">{t.paymentReceived}</h2>
              <p className="text-muted-foreground mb-6">{t.receiptSent}</p>
              {link?.redirect_url && (
                <Button
                  onClick={() => window.open(link.redirect_url!, "_blank")}
                  className="gradient-primary text-white rounded-lg"
                >
                  {t.accessContent}
                </Button>
              )}
            </>
          )}

          {paymentState === "failed" && (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2 text-foreground">{t.paymentFailed}</h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              {link?.recovery_enabled && link.recovery_discount_percent && link.recovery_discount_percent > 0 ? (
                <div className="space-y-3">
                  <div className="bg-[hsl(145,60%,40%)]/10 rounded-xl p-4 text-center">
                    <p className="text-sm font-medium text-[hsl(145,60%,35%)]">
                      🎁 {lang === "en" ? "Special discount unlocked!" : lang === "es" ? "¡Descuento especial desbloqueado!" : "Desconto especial desbloqueado!"}
                    </p>
                    <p className="text-2xl font-bold text-[hsl(145,60%,35%)] mt-1">
                      -{link.recovery_discount_percent}% OFF
                    </p>
                  </div>
                  {link.recovery_redirect_url ? (
                    <Button
                      onClick={() => {
                        const url = new URL(link.recovery_redirect_url!, window.location.origin);
                        Object.entries(trackingParams).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
                        window.location.href = url.toString();
                      }}
                      className="w-full h-12 rounded-xl bg-[hsl(145,60%,40%)] hover:bg-[hsl(145,60%,35%)] text-white font-bold"
                    >
                      {link.recovery_cta_text || (lang === "en" ? "Grab this offer now" : lang === "es" ? "Aprovechar oferta ahora" : "Aproveitar oferta agora")}
                    </Button>
                  ) : (
                    <Button onClick={resetForm} className="w-full h-12 rounded-xl bg-[hsl(145,60%,40%)] hover:bg-[hsl(145,60%,35%)] text-white font-bold">
                      {link.recovery_cta_text || (lang === "en" ? "Try again with discount" : lang === "es" ? "Intentar con descuento" : "Tentar com desconto")}
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={resetForm} className="gradient-primary text-white rounded-lg">
                  {t.tryAgain}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Recovery Popup for payment failure */}
        {link?.recovery_enabled && (
          <RecoveryPopup
            config={{
              recovery_enabled: link.recovery_enabled,
              recovery_discount_percent: link.recovery_discount_percent || 0,
              recovery_headline: link.recovery_headline || null,
              recovery_message: link.recovery_message || null,
              recovery_cta_text: link.recovery_cta_text || null,
              recovery_redirect_url: link.recovery_redirect_url || null,
            }}
            originalAmount={Number(link.amount)}
            currency={link.currency}
            productName={link.product_name}
            lang={lang}
            trigger={recoveryTrigger}
            onDismiss={() => setRecoveryTrigger(null)}
            trackingParams={trackingParams}
          />
        )}
      </div>
    );
  }

  // --- STRIPE CHECKOUT: single-page with Elements ---
  if (isStripe) {

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

    const currentPrefix = PHONE_PREFIXES.find(p => p.code === phonePrefix) || PHONE_PREFIXES[0];
    const phonePlaceholder = currentPrefix.code === "+27" ? "82 123 4567" : currentPrefix.code === "+258" ? "84 123 4567" : "123 456 7890";
    const phoneMaxLen = currentPrefix.maxLen;
    const showPhone = true;

    const handleStep1Continue = (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !email.includes("@")) {
        toast({ title: t.invalidEmail, description: t.invalidEmailDesc, variant: "destructive" });
        return;
      }
      if (!customerName.trim()) {
        toast({ title: t.name, description: lang === "en" ? "Please enter your name" : "Introduza o seu nome", variant: "destructive" });
        return;
      }
      setCheckoutStep(2);
    };

    return (
      <div className="min-h-screen bg-muted flex flex-col md:items-center md:justify-center">
        <div className="w-full md:max-w-lg md:p-4">
          <div className="bg-card md:rounded-3xl shadow-xl shadow-muted-foreground/5 overflow-hidden md:border border-border min-h-screen md:min-h-0">
            {/* Countdown Timer */}
            {link.checkout_timer_minutes && link.checkout_timer_minutes > 0 && (
              <CheckoutTimer minutes={link.checkout_timer_minutes} lang={lang} />
            )}

            {/* Banner */}
            {link.checkout_banner_url && (
             <img
                src={link.checkout_banner_url}
                alt="Banner"
                className="w-full"
              />
            )}

            {/* Step indicator */}
            <div className="flex items-center gap-2 px-6 md:px-8 pt-6">
              <div className={cn("flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold", checkoutStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>1</div>
              <div className={cn("flex-1 h-0.5 rounded-full", checkoutStep >= 2 ? "bg-primary" : "bg-border")} />
              <div className={cn("flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold", checkoutStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>2</div>
            </div>

            {checkoutStep === 1 ? (
              <>
                {/* Product Header */}
                <div className="p-6 md:p-8 pb-0">
                  <div className="bg-muted/40 rounded-2xl p-6 border border-border text-center">
                    {link.logo_url && (
                      <img src={link.logo_url} alt={link.product_name} className="h-16 w-auto object-contain mx-auto mb-4 rounded-xl" />
                    )}
                    <h2 className="text-lg font-bold text-foreground">{link.product_name}</h2>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {currencySymbol === "ZAR" ? "R" : currencySymbol} {Number(link.amount).toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> SSL Encrypted</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Secure Payment</span>
                  </div>
                </div>

                {/* Customer Info Form */}
                <form onSubmit={handleStep1Continue} className="p-6 md:p-8 space-y-5">
                  <h3 className="text-base font-bold text-foreground">
                    {lang === "en" ? "Your Information" : lang === "es" ? "Tu Información" : "Suas Informações"}
                  </h3>

                  <div>
                    <Label className="block text-sm font-semibold text-foreground mb-1.5">
                      {lang === "en" ? "Full Name" : lang === "es" ? "Nombre Completo" : "Nome Completo"}
                    </Label>
                    <Input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="h-12 rounded-xl border-border text-sm"
                    />
                  </div>

                  <div>
                    <Label className="block text-sm font-semibold text-foreground mb-1.5">
                      {lang === "en" ? "Email Address" : lang === "es" ? "Correo Electrónico" : "Email"}
                    </Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                      className="h-12 rounded-xl border-border text-sm"
                    />
                  </div>

                  {showPhone && (
                    <div>
                      <Label className="block text-sm font-semibold text-foreground mb-1.5">
                        {lang === "en" ? "Phone Number" : lang === "es" ? "Número de Teléfono" : "Número de Telefone"}
                      </Label>
                      <div className="relative flex">
                        <select
                          value={phonePrefix}
                          onChange={(e) => setPhonePrefix(e.target.value)}
                          className="flex items-center justify-center px-2 bg-muted border border-r-0 border-border rounded-l-xl text-muted-foreground text-sm font-medium appearance-none cursor-pointer focus:outline-none"
                          style={{ minWidth: "80px" }}
                        >
                          {PHONE_PREFIXES.map((p) => (
                            <option key={p.code} value={p.code}>{p.country} {p.code}</option>
                          ))}
                        </select>
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, phoneMaxLen))}
                          placeholder={phonePlaceholder}
                          className="flex-1 rounded-l-none h-12 rounded-r-xl border-border text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Order Bumps */}
                  {bumps.map((bump, idx) => (
                    <OrderBump
                      key={idx}
                      productName={bump.name!}
                      productDescription={bump.desc || null}
                      amount={Number(bump.price)}
                      logoUrl={null}
                      accepted={bumpsAccepted[idx]}
                      onToggle={(v) => {
                        setBumpsAccepted(prev => {
                          const n = [...prev];
                          n[idx] = v;
                          return n;
                        });
                      }}
                      currency={link.currency}
                      locale={locale}
                    />
                  ))}

                  {/* Pay Button - Green */}
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-xl bg-[hsl(145,60%,40%)] hover:bg-[hsl(145,60%,35%)] text-white font-bold text-base shadow-lg shadow-[hsl(145,60%,40%)]/25 active:scale-[0.98] transition-all"
                  >
                    {lang === "en" ? `Pay Now - ${currencySymbol === "ZAR" ? "R" : currencySymbol} ${totalAmount.toLocaleString(locale, { minimumFractionDigits: 2 })}` 
                      : lang === "es" ? `Pagar Ahora - ${currencySymbol === "ZAR" ? "R" : currencySymbol} ${totalAmount.toLocaleString(locale, { minimumFractionDigits: 2 })}`
                      : `Pagar Agora - ${currencySymbol === "ZAR" ? "R" : currencySymbol} ${totalAmount.toLocaleString(locale, { minimumFractionDigits: 2 })}`}
                  </Button>

                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">
                      {lang === "en" ? "Your payment is secure and encrypted." : lang === "es" ? "Su pago es seguro y encriptado." : "Pagamento seguro e encriptado."}
                    </p>
                  </div>
                </form>

                {/* Trust Badges */}
                {(link as any).show_trust_badges !== false && (
                <div className="px-6 md:px-8 pb-6 md:pb-8">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <Shield className="w-6 h-6 text-primary mb-2" />
                      <p className="text-sm font-bold text-foreground">{lang === "en" ? "Privacy" : lang === "es" ? "Privacidad" : "Privacidade"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "Your information is 100% secure" : lang === "es" ? "Su información es 100% segura" : "Seus dados estão 100% seguros"}</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <Lock className="w-6 h-6 text-primary mb-2" />
                      <p className="text-sm font-bold text-foreground">{lang === "en" ? "Secure Purchase" : lang === "es" ? "Compra Segura" : "Compra Segura"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "Encrypted and authenticated" : lang === "es" ? "Encriptado y autenticado" : "Encriptado e autenticado"}</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <Mail className="w-6 h-6 text-primary mb-2" />
                      <p className="text-sm font-bold text-foreground">{lang === "en" ? "Delivered via Email" : lang === "es" ? "Entrega por Email" : "Entrega por Email"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "Product access delivered by email" : lang === "es" ? "Acceso entregado por email" : "Acesso entregue por email"}</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <Award className="w-6 h-6 text-primary mb-2" />
                      <p className="text-sm font-bold text-foreground">{lang === "en" ? "Approved Content" : lang === "es" ? "Contenido Aprobado" : "Conteudo Aprovado"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "100% reviewed and approved" : lang === "es" ? "100% revisado y aprobado" : "100% revisado e aprovado"}</p>
                    </div>
                  </div>
                </div>
                )}
              </>
            ) : (
              <>
                {/* Step 2: Payment */}
                <div className="p-6 md:p-8 pb-0">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(1)}
                    className="text-sm text-primary font-medium mb-4 flex items-center gap-1 hover:underline"
                  >
                    ← {lang === "en" ? "Back" : lang === "es" ? "Volver" : "Voltar"}
                  </button>
                  <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-4 border border-border">
                    {link.logo_url ? (
                      <img src={link.logo_url} alt={link.product_name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                        <Wallet className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{link.product_name}</p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>
                    <p className="text-lg font-bold text-foreground shrink-0">
                      {currencySymbol === "ZAR" ? "R" : currencySymbol} {totalAmount.toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  {clientSecret && stripeOptions && stripeInstance ? (
                    <Elements stripe={stripeInstance} options={stripeOptions}>
                      <StripeCheckoutForm
                        totalAmount={totalAmount}
                        currency={currencySymbol}
                        lang={lang}
                        transactionId={stripeTransactionId || ""}
                        redirectUrl={link.redirect_url}
                        customerName={customerName}
                        customerEmail={email}
                        customerPhone={phone}
                        hideCustomerFields
                        trackingParams={trackingParams}
                        onSuccess={async () => {
                          trackPurchase(totalAmount, currencySymbol, stripeTransactionId || undefined);
                          const hasFlow = await checkAndRedirectToFlow(stripeTransactionId || "");
                          if (!hasFlow) setPaymentState("success");
                        }}
                        onError={(msg) => {
                          setErrorMessage(msg);
                          // Trigger recovery popup on payment failure
                          if (link?.recovery_enabled && !recoveryShownRef.current) {
                            recoveryShownRef.current = true;
                            setRecoveryTrigger("payment_failed");
                          }
                          setPaymentState("failed");
                        }}
                        orderBumpSlot={null}
                      />
                    </Elements>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="text-center py-4 md:mt-6">
            <img src={cashpayLogoFull} alt="Cashpay" className="h-7 mx-auto opacity-60" />
          </div>
        </div>

        {/* Recovery Popup for Stripe */}
        {link?.recovery_enabled && (
          <RecoveryPopup
            config={{
              recovery_enabled: link.recovery_enabled,
              recovery_discount_percent: link.recovery_discount_percent || 0,
              recovery_headline: link.recovery_headline || null,
              recovery_message: link.recovery_message || null,
              recovery_cta_text: link.recovery_cta_text || null,
              recovery_redirect_url: link.recovery_redirect_url || null,
            }}
            originalAmount={Number(link.amount)}
            currency={link.currency}
            productName={link.product_name}
            lang={lang}
            trigger={recoveryTrigger}
            onDismiss={() => setRecoveryTrigger(null)}
            trackingParams={trackingParams}
          />
        )}
      </div>
    );
  }

  // --- MAIN FORM (M-Pesa only) ---
  return (
    <div className="min-h-screen bg-muted flex flex-col md:items-center md:justify-center">
      <div className="w-full md:max-w-lg md:p-4">
        <div className="bg-card md:rounded-3xl shadow-xl shadow-muted-foreground/5 overflow-hidden md:border border-border min-h-screen md:min-h-0">
          {/* Countdown Timer */}
          {link.checkout_timer_minutes && link.checkout_timer_minutes > 0 && (
            <CheckoutTimer minutes={link.checkout_timer_minutes} lang={lang} />
          )}

          {/* Banner */}
          {link.checkout_banner_url && (
             <img
                src={link.checkout_banner_url}
                alt="Banner"
                className="w-full"
              />
            )}

            {/* Product Header */}
            <div className="p-6 md:p-8 border-b border-border bg-muted/30">
              <div className="flex gap-4">
                {link.logo_url ? (
                  <img src={link.logo_url} alt={link.product_name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                    <Wallet className="w-10 h-10 text-white" />
                  </div>
                )}
                <div className="min-w-0 flex flex-col justify-center">
                  <h2 className="text-lg font-bold text-foreground leading-tight">{link.product_name}</h2>
                  {link.product_description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{link.product_description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
            <form onSubmit={handleMobileSubmit} className="space-y-4">
              {/* Nome */}
              <div>
                <Label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  {t.name}
                </Label>
                <Input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  required
                  className="h-11 rounded-lg border-border focus:border-primary text-sm"
                />
              </div>

              {/* Email */}
              <div>
                <Label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  {t.email}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 text-muted-foreground w-4 h-4" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    className="pl-10 h-11 rounded-lg border-border focus:border-primary text-sm"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                  {isEmola ? t.phoneEmola : t.phoneMpesa}
                </Label>
                <div className="relative flex">
                  <div className="flex items-center justify-center px-3 bg-muted border border-r-0 border-border rounded-l-lg text-muted-foreground text-sm font-medium">
                    <Phone className="w-4 h-4 mr-2" />
                    +258
                  </div>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 9));
                      setPhoneError("");
                    }}
                    placeholder={isEmola ? "86 123 4567" : "84 123 4567"}
                    className={cn(
                      "flex-1 rounded-l-none h-11 rounded-r-lg border-border text-sm font-mono",
                      phoneError ? "border-destructive" : ""
                    )}
                  />
                </div>
                {phoneError && (
                  <p className="text-sm text-destructive mt-1">{phoneError}</p>
                )}
              </div>

              {/* Payment Method Selection */}
              <div>
                <Label className="block text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">
                  {t.paymentMethod}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedMethod("mpesa"); setPhoneError(""); }}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedMethod === "mpesa"
                        ? "border-mpesa bg-mpesa/5 ring-2 ring-mpesa/20"
                        : "border-border hover:border-mpesa/40 bg-card"
                    )}
                  >
                    <img src={mpesaLogo} alt="M-Pesa" className="h-10 object-contain" />
                    <span className="text-xs font-semibold text-foreground">M-Pesa</span>
                    {selectedMethod === "mpesa" && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-mpesa flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedMethod("emola"); setPhoneError(""); }}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selectedMethod === "emola"
                        ? "border-emola bg-emola/5 ring-2 ring-emola/20"
                        : "border-border hover:border-emola/40 bg-card"
                    )}
                  >
                    <img src={emolaLogo} alt="eMola" className="h-10 object-contain" />
                    <span className="text-xs font-semibold text-foreground">eMola</span>
                    {selectedMethod === "emola" && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emola flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Order Bumps */}
              {bumps.map((bump, idx) => (
                <OrderBump
                  key={idx}
                  productName={bump.name!}
                  productDescription={bump.desc || null}
                  amount={Number(bump.price)}
                  logoUrl={null}
                  accepted={bumpsAccepted[idx]}
                  onToggle={(v) => {
                    setBumpsAccepted(prev => {
                      const n = [...prev];
                      n[idx] = v;
                      return n;
                    });
                  }}
                  currency={link.currency}
                  locale={locale}
                />
              ))}

              {/* Summary */}
              <div className="pt-6 border-t border-border space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{link.product_name}</span>
                  <span>{Number(link.amount).toLocaleString(locale)} {currencySymbol}</span>
                </div>
                {bumps.map((bump, idx) => bumpsAccepted[idx] && (
                  <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                    <span>{bump.name}</span>
                    <span>{Number(bump.price).toLocaleString(locale)} {currencySymbol}</span>
                  </div>
                ))}
                <div className="flex justify-between text-lg font-bold text-foreground pt-2">
                  <span>{t.total}</span>
                  <span>{totalAmount.toLocaleString(locale)} {currencySymbol}</span>
                </div>
                {localCurrency && link?.currency === "USD" && (
                  <p className="text-xs text-muted-foreground text-right mt-1">
                    ≈ {(totalAmount * localCurrency.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency.code}
                  </p>
                )}
              </div>

              {/* Pay Button */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all group relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10">{isEmola ? t.payEmola : t.payMpesa}</span>
              </Button>

              <div className="text-center">
                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {isEmola ? t.securePaymentEmola : t.securePayment}
                </p>
              </div>
            </form>
          </div>
        </div>

        <div className="text-center py-4 md:mt-6">
          <img src={cashpayLogoFull} alt="Cashpay" className="h-7 mx-auto opacity-60" />
        </div>

        {/* Recovery Popup for M-Pesa */}
        {link?.recovery_enabled && (
          <RecoveryPopup
            config={{
              recovery_enabled: link.recovery_enabled,
              recovery_discount_percent: link.recovery_discount_percent || 0,
              recovery_headline: link.recovery_headline || null,
              recovery_message: link.recovery_message || null,
              recovery_cta_text: link.recovery_cta_text || null,
              recovery_redirect_url: link.recovery_redirect_url || null,
            }}
            originalAmount={Number(link.amount)}
            currency={link.currency}
            productName={link.product_name}
            lang={lang}
            trigger={recoveryTrigger}
            onDismiss={() => setRecoveryTrigger(null)}
            trackingParams={trackingParams}
          />
        )}
      </div>
    </div>
  );
}
