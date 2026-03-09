import { useState, useEffect, useRef, useCallback } from "react";
import { X, Gift, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecoveryConfig {
  recovery_enabled: boolean;
  recovery_discount_percent: number;
  recovery_headline: string | null;
  recovery_message: string | null;
  recovery_cta_text: string | null;
  recovery_redirect_url: string | null;
}

interface RecoveryPopupProps {
  config: RecoveryConfig;
  originalAmount: number;
  currency: string;
  productName: string;
  lang: "pt" | "en" | "es";
  trigger: "exit_intent" | "payment_failed" | null;
  onDismiss: () => void;
  trackingParams?: Record<string, string | null>;
}

const defaults = {
  pt: {
    exit_headline: "Espere um momento!",
    exit_message: "Percebemos que está a sair sem completar a compra. Para facilitar, liberámos um desconto exclusivo, válido apenas agora.",
    failed_headline: "Oferta especial desbloqueada!",
    failed_message: "O pagamento não foi concluído, mas para ajudá-lo, liberámos um desconto exclusivo por tempo limitado.",
    cta: "Aproveitar oferta agora",
  },
  en: {
    exit_headline: "Wait a moment!",
    exit_message: "We noticed you're about to leave without completing your purchase. To help, we've unlocked an exclusive discount, valid only now.",
    failed_headline: "Special offer unlocked!",
    failed_message: "Your payment wasn't completed, but to help you, we've unlocked an exclusive limited-time discount.",
    cta: "Grab this offer now",
  },
  es: {
    exit_headline: "¡Espere un momento!",
    exit_message: "Notamos que está por salir sin completar su compra. Para facilitar, liberamos un descuento exclusivo, válido solo ahora.",
    failed_headline: "¡Oferta especial desbloqueada!",
    failed_message: "El pago no fue completado, pero para ayudarle, liberamos un descuento exclusivo por tiempo limitado.",
    cta: "Aprovechar oferta ahora",
  },
};

export function RecoveryPopup({
  config,
  originalAmount,
  currency,
  productName,
  lang,
  trigger,
  onDismiss,
  trackingParams,
}: RecoveryPopupProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (trigger) {
      setVisible(true);
      setClosing(false);
    }
  }, [trigger]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 300);
  };

  const handleCta = () => {
    if (config.recovery_redirect_url) {
      // Append tracking params to recovery redirect URL
      const url = new URL(config.recovery_redirect_url, window.location.origin);
      if (trackingParams) {
        Object.entries(trackingParams).forEach(([key, value]) => {
          if (value) url.searchParams.set(key, value);
        });
      }
      window.location.href = url.toString();
    }
    handleClose();
  };

  if (!visible || !trigger || !config.recovery_enabled) return null;

  const d = defaults[lang];
  const isExit = trigger === "exit_intent";
  const discountPercent = config.recovery_discount_percent || 0;
  const discountedAmount = discountPercent > 0
    ? originalAmount * (1 - discountPercent / 100)
    : originalAmount;

  const headline = config.recovery_headline || (isExit ? d.exit_headline : d.failed_headline);
  const message = config.recovery_message || (isExit ? d.exit_message : d.failed_message);
  const ctaText = config.recovery_cta_text || d.cta;

  const formatAmount = (amt: number) => {
    const locale = lang === "en" ? "en-US" : "pt-MZ";
    const prefix = currency === "ZAR" ? "R " : `${currency} `;
    return `${prefix}${amt.toLocaleString(locale, { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300",
      closing ? "opacity-0" : "opacity-100"
    )}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className={cn(
        "relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border overflow-hidden transition-all duration-300",
        closing ? "scale-95 opacity-0" : "scale-100 opacity-100 animate-scale-in"
      )}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header accent */}
        <div className="bg-gradient-to-r from-[hsl(145,60%,40%)] to-[hsl(145,60%,30%)] p-6 pb-8 text-white text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            {isExit ? <Gift className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
          </div>
          <h2 className="text-xl font-bold">{headline}</h2>
        </div>

        {/* Content */}
        <div className="p-6 -mt-4">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {message}
            </p>

            {/* Price comparison */}
            {discountPercent > 0 && (
              <div className="bg-muted/50 rounded-xl p-4 mb-5 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {lang === "en" ? "Original price" : lang === "es" ? "Precio original" : "Preço original"}
                </p>
                <p className="text-lg text-muted-foreground line-through">
                  {formatAmount(originalAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2 mb-1">
                  {lang === "en" ? "Your exclusive price" : lang === "es" ? "Tu precio exclusivo" : "Seu preço exclusivo"}
                </p>
                <p className="text-3xl font-bold text-[hsl(145,60%,35%)]">
                  {formatAmount(discountedAmount)}
                </p>
                <div className="inline-block mt-2 px-3 py-1 bg-[hsl(145,60%,40%)]/10 rounded-full">
                  <span className="text-xs font-bold text-[hsl(145,60%,35%)]">
                    -{discountPercent}% OFF
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            <Button
              onClick={handleCta}
              className="w-full h-13 rounded-xl bg-[hsl(145,60%,40%)] hover:bg-[hsl(145,60%,35%)] text-white font-bold text-base shadow-lg shadow-[hsl(145,60%,40%)]/25 active:scale-[0.98] transition-all"
            >
              {ctaText}
            </Button>

            <button
              onClick={handleClose}
              className="w-full text-center mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {lang === "en" ? "No thanks, I'll pass" : lang === "es" ? "No gracias, paso" : "Não obrigado, passo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to detect exit intent (mouse leaving viewport on desktop, back button on mobile)
 */
export function useExitIntent(enabled: boolean, onExitIntent: () => void) {
  const firedRef = useRef(false);
  const callbackRef = useRef(onExitIntent);
  callbackRef.current = onExitIntent;

  useEffect(() => {
    if (!enabled) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !firedRef.current) {
        firedRef.current = true;
        callbackRef.current();
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [enabled]);

  // Reset on remount
  useEffect(() => {
    return () => { firedRef.current = false; };
  }, []);
}
