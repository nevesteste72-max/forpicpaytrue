import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Heart, ShieldCheck, Loader2, CheckCircle2, XCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { initiatePayment, formatPhoneNumber, checkTransactionStatus } from "@/lib/debito";

export interface DonationLink {
  id: string;
  product_name: string;
  logo_url: string | null;
  currency: string;
  checkout_language: string;
  stripe_payment_methods: string[];
  is_donation: boolean;
  donation_amounts: number[];
  donation_goal_amount: number | null;
  donation_goal_enabled: boolean;
  donation_story_title: string | null;
  donation_story_text: string | null;
  donation_story_image_url: string | null;
  donation_story_video_url: string | null;
  donation_cta_text: string | null;
  donation_allow_anonymous: boolean;
  donation_social_proof_enabled?: boolean;
  donation_testimonials?: Array<{ name?: string; city?: string; text?: string; image_url?: string | null }>;
  redirect_url: string | null;
  show_trust_badges: boolean;
}

const T = {
  pt: {
    chooseAmount: "Escolha um valor",
    customAmount: "Outro valor",
    yourName: "Seu nome",
    email: "Seu email",
    anonymous: "Quero doar anonimamente",
    donate: "Doar agora",
    donateAmount: (s: string) => `Doar ${s}`,
    raised: "arrecadados",
    of: "de",
    securePayment: "Pagamento 100% seguro",
    phoneLabel: "Número M-Pesa/eMola",
    payMethod: "Forma de pagamento",
    mpesa: "M-Pesa",
    emola: "eMola",
    processing: "Processando...",
    success: "Doação confirmada!",
    successMsg: "Obrigado pelo seu apoio. Cada contribuição faz a diferença.",
    failed: "Pagamento falhou",
    tryAgain: "Tentar de novo",
    selectFirst: "Selecione um valor",
    invalidEmail: "Email inválido",
    invalidPhone: "Número inválido",
  },
  en: {
    chooseAmount: "Choose an amount",
    customAmount: "Other amount",
    yourName: "Your name",
    email: "Your email",
    anonymous: "Donate anonymously",
    donate: "Donate now",
    donateAmount: (s: string) => `Donate ${s}`,
    raised: "raised",
    of: "of",
    securePayment: "100% secure payment",
    phoneLabel: "M-Pesa / eMola number",
    payMethod: "Payment method",
    mpesa: "M-Pesa",
    emola: "eMola",
    processing: "Processing...",
    success: "Donation confirmed!",
    successMsg: "Thank you for your support. Every contribution makes a difference.",
    failed: "Payment failed",
    tryAgain: "Try again",
    selectFirst: "Select an amount",
    invalidEmail: "Invalid email",
    invalidPhone: "Invalid number",
  },
  es: {
    chooseAmount: "Elige un monto",
    customAmount: "Otro monto",
    yourName: "Tu nombre",
    email: "Tu email",
    anonymous: "Donar de forma anónima",
    donate: "Donar ahora",
    donateAmount: (s: string) => `Donar ${s}`,
    raised: "recaudado",
    of: "de",
    securePayment: "Pago 100% seguro",
    phoneLabel: "Número M-Pesa/eMola",
    payMethod: "Método de pago",
    mpesa: "M-Pesa",
    emola: "eMola",
    processing: "Procesando...",
    success: "¡Donación confirmada!",
    successMsg: "Gracias por tu apoyo. Cada contribución hace la diferencia.",
    failed: "Pago fallido",
    tryAgain: "Reintentar",
    selectFirst: "Selecciona un monto",
    invalidEmail: "Email inválido",
    invalidPhone: "Número inválido",
  },
};

let stripePromise: Promise<Stripe | null> | null = null;
async function getStripe(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise;
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-stripe-key`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );
    const data = await res.json();
    if (data.publishable_key) {
      stripePromise = loadStripe(data.publishable_key);
      return stripePromise;
    }
  } catch (e) {
    console.error("Stripe key fetch failed", e);
  }
  return null;
}

function extractVideoEmbed(url: string): string | null {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

function StripeDonationForm({
  amount,
  currency,
  clientSecret,
  link,
  onSuccess,
  onError,
  ctaLabel,
}: {
  amount: number;
  currency: string;
  clientSecret: string;
  link: DonationLink;
  onSuccess: () => void;
  onError: (msg: string) => void;
  ctaLabel: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/${link.id}?payment=success`,
      },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      onError(error.message || "Payment failed");
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || submitting || amount <= 0}
        className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Heart className="w-5 h-5 mr-2 fill-current" />
            {ctaLabel}
          </>
        )}
      </Button>
    </form>
  );
}

export function DonationCheckout({ link }: { link: DonationLink }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const lang = (link.checkout_language || "pt") as "pt" | "en" | "es";
  const t = T[lang];

  const isStripe = link.currency !== "MZN";
  const currencySymbol = link.currency;

  const [selectedAmount, setSelectedAmount] = useState<number | null>(
    link.donation_amounts?.[0] ?? null
  );
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [method, setMethod] = useState<"mpesa" | "emola">("mpesa");

  const [paymentState, setPaymentState] = useState<"form" | "processing" | "pending" | "success" | "failed">("form");
  const [errorMsg, setErrorMsg] = useState("");

  // Goal progress
  const [raised, setRaised] = useState(0);
  useEffect(() => {
    if (!link.donation_goal_enabled || !link.donation_goal_amount) return;
    supabase
      .from("transactions")
      .select("amount")
      .eq("payment_link_id", link.id)
      .in("status", ["completed", "success", "successful", "approved"])
      .then(({ data }) => {
        if (data) {
          setRaised(data.reduce((s, r) => s + Number(r.amount || 0), 0));
        }
      });
  }, [link.id, link.donation_goal_enabled, link.donation_goal_amount]);

  // Stripe state
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeTxId, setStripeTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!isStripe) return;
    getStripe().then(setStripeInstance);
  }, [isStripe]);

  // M-Pesa polling
  const [debitoRef, setDebitoRef] = useState<string | null>(null);
  const [internalTxId, setInternalTxId] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (paymentState === "pending" && debitoRef && !isStripe) {
      let attempts = 0;
      pollingRef.current = window.setInterval(async () => {
        attempts++;
        if (attempts > 60) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          return;
        }
        try {
          const r = await checkTransactionStatus(debitoRef, internalTxId);
          if (r.status === "completed" || r.status === "success" || r.status === "successful") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentState("success");
          } else if (r.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setErrorMsg(t.failed);
            setPaymentState("failed");
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [paymentState, debitoRef, internalTxId, isStripe, t.failed]);

  const formattedAmount = (n: number) =>
    `${n.toLocaleString(lang === "pt" ? "pt-MZ" : "en-US")} ${currencySymbol}`;

  const goalPct = useMemo(() => {
    if (!link.donation_goal_enabled || !link.donation_goal_amount) return 0;
    return Math.min(100, (raised / Number(link.donation_goal_amount)) * 100);
  }, [raised, link.donation_goal_enabled, link.donation_goal_amount]);

  // Create Stripe PaymentIntent when amount/email become available
  const createIntent = async () => {
    if (!selectedAmount || selectedAmount <= 0) {
      toast({ title: t.selectFirst, variant: "destructive" });
      return;
    }
    const fallbackEmail = email && email.includes("@") ? email : `donor-${Date.now()}@anon.local`;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_link_id: link.id,
            amount: selectedAmount,
            currency: link.currency,
            customer_email: email,
            customer_name: isAnonymous ? "Anonymous" : customerName || "Donor",
            payment_methods: link.stripe_payment_methods,
            order_bump_accepted: false,
            order_bump_amount: 0,
            is_donation: true,
            is_anonymous: isAnonymous,
          }),
        }
      );
      const result = await res.json();
      if (result.success && result.client_secret) {
        setClientSecret(result.client_secret);
        setStripeTxId(result.transaction_id);
      } else {
        toast({ title: "Erro", description: result.error || "Falha", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Conexão falhou", variant: "destructive" });
    }
  };

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmount || selectedAmount <= 0) {
      toast({ title: t.selectFirst, variant: "destructive" });
      return;
    }
    if (!email || !email.includes("@")) {
      toast({ title: t.invalidEmail, variant: "destructive" });
      return;
    }
    const digits = formatPhoneNumber(phone);
    const validMpesa = /^8[45]\d{7}$/.test(digits);
    const validEmola = /^8[67]\d{7}$/.test(digits);
    if ((method === "mpesa" && !validMpesa) || (method === "emola" && !validEmola)) {
      toast({ title: t.invalidPhone, variant: "destructive" });
      return;
    }
    setPaymentState("processing");
    try {
      const resp = await initiatePayment({
        method,
        amount: selectedAmount,
        msisdn: digits,
        reference_description: link.product_name.slice(0, 20),
        payment_link_id: link.id,
        customer_email: email,
        customer_name: isAnonymous ? "Anonymous" : customerName,
        customer_phone: digits,
      });
      if (resp.success) {
        setDebitoRef(resp.debito_reference || null);
        setInternalTxId(resp.internal_transaction_id || null);
        if (resp.redirect_url) {
          window.location.href = resp.redirect_url;
        } else {
          setPaymentState("pending");
        }
      } else {
        throw new Error(resp.error || "Falha");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro");
      setPaymentState("failed");
    }
  };

  const stripeOptions = useMemo(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: {
        theme: "stripe" as const,
        variables: { colorPrimary: "hsl(168, 80%, 28%)", borderRadius: "12px" },
      },
      locale: (lang === "pt" ? "pt-BR" : "en") as "pt-BR" | "en",
    };
  }, [clientSecret, lang]);

  // Success screen
  if (paymentState === "success") {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">{t.success}</h2>
          <p className="text-muted-foreground mb-6">{t.successMsg}</p>
          {link.redirect_url && (
            <Button
              className="w-full rounded-xl"
              onClick={() => (window.location.href = link.redirect_url!)}
            >
              Continuar
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (paymentState === "failed") {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-foreground">{t.failed}</h2>
          <p className="text-muted-foreground mb-6">{errorMsg}</p>
          <Button onClick={() => setPaymentState("form")} className="rounded-xl">
            {t.tryAgain}
          </Button>
        </div>
      </div>
    );
  }

  if (paymentState === "processing" || paymentState === "pending") {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border text-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-foreground">{t.processing}</h2>
        </div>
      </div>
    );
  }

  const videoEmbed = link.donation_story_video_url ? extractVideoEmbed(link.donation_story_video_url) : null;
  const ctaText = link.donation_cta_text || t.donate;
  const ctaLabel = selectedAmount ? t.donateAmount(formattedAmount(selectedAmount)) : ctaText;

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8">
          {/* LEFT: Story */}
          <div className="bg-card rounded-3xl p-6 lg:p-8 shadow-sm border border-border space-y-6">
            {link.logo_url && (
              <img
                src={link.logo_url}
                alt={link.product_name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            )}
            {link.donation_story_image_url && (
              <img
                src={link.donation_story_image_url}
                alt="Campanha"
                className="w-full h-64 lg:h-80 object-cover rounded-2xl"
              />
            )}
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
                {link.donation_story_title || link.product_name}
              </h1>
            </div>
            {link.donation_story_text && (
              <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {link.donation_story_text}
              </div>
            )}
            {videoEmbed && (
              <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                <iframe
                  src={videoEmbed}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            )}
            {link.donation_social_proof_enabled && link.donation_testimonials && link.donation_testimonials.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground">⭐ Quem já apoiou</h3>
                {link.donation_testimonials.map((tst, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    {tst.image_url && (
                      <img src={tst.image_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {(tst.name || tst.city) && (
                        <p className="text-xs font-semibold text-foreground">
                          {tst.name}
                          {tst.name && tst.city && <span className="text-muted-foreground font-normal"> · {tst.city}</span>}
                          {!tst.name && tst.city}
                        </p>
                      )}
                      {tst.text && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">"{tst.text}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {link.show_trust_badges && (
              <div className="flex items-center gap-3 pt-4 border-t border-border text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>{t.securePayment}</span>
                <Lock className="w-4 h-4 ml-auto" />
              </div>
            )}
          </div>

          {/* RIGHT: Donation form */}
          <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
            {/* Goal bar */}
            {link.donation_goal_enabled && link.donation_goal_amount && (
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xl font-bold text-foreground">
                    {formattedAmount(raised)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.of} {formattedAmount(Number(link.donation_goal_amount))}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {goalPct.toFixed(0)}% {t.raised}
                </p>
              </div>
            )}

            {/* Form */}
            <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-5">
              {/* Fixed amounts */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t.chooseAmount}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(link.donation_amounts || []).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(Number(amt));
                        setClientSecret(null); // reset stripe intent
                      }}
                      className={cn(
                        "h-14 rounded-xl border-2 font-semibold transition-all",
                        Number(selectedAmount) === Number(amt)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-foreground hover:border-primary/40"
                      )}
                    >
                      {formattedAmount(Number(amt))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anonymous */}
              {link.donation_allow_anonymous && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="anon"
                    checked={isAnonymous}
                    onCheckedChange={(v) => setIsAnonymous(!!v)}
                  />
                  <Label htmlFor="anon" className="text-sm cursor-pointer">
                    {t.anonymous}
                  </Label>
                </div>
              )}

              {/* Personal info */}
              {!isAnonymous && (
                <div className="space-y-2">
                  <Label htmlFor="don-name" className="text-xs">{t.yourName}</Label>
                  <Input
                    id="don-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              )}


              {/* M-Pesa flow */}
              {!isStripe && (
                <form onSubmit={handleMobileSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{t.payMethod}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMethod("mpesa")}
                        className={cn(
                          "h-12 rounded-xl border-2 font-medium text-sm",
                          method === "mpesa"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-foreground"
                        )}
                      >
                        {t.mpesa}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("emola")}
                        className={cn(
                          "h-12 rounded-xl border-2 font-medium text-sm",
                          method === "emola"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-foreground"
                        )}
                      >
                        {t.emola}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="don-phone" className="text-xs">{t.phoneLabel}</Label>
                    <Input
                      id="don-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="84XXXXXXX"
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!selectedAmount}
                    className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                    <Heart className="w-5 h-5 mr-2 fill-current" />
                    {ctaLabel}
                  </Button>
                </form>
              )}

              {/* Stripe flow */}
              {isStripe && (
                <>
                  {!clientSecret && (
                    <Button
                      type="button"
                      onClick={createIntent}
                      disabled={!selectedAmount || !email}
                      className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      <Heart className="w-5 h-5 mr-2 fill-current" />
                      {ctaLabel}
                    </Button>
                  )}
                  {clientSecret && stripeInstance && stripeOptions && (
                    <Elements stripe={stripeInstance} options={stripeOptions}>
                      <StripeDonationForm
                        amount={selectedAmount || 0}
                        currency={link.currency}
                        clientSecret={clientSecret}
                        link={link}
                        onSuccess={() => setPaymentState("success")}
                        onError={(m) => {
                          setErrorMsg(m);
                          setPaymentState("failed");
                        }}
                        ctaLabel={ctaLabel}
                      />
                    </Elements>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
