import { useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
  }
}

/**
 * Injects the Facebook Pixel script and fires PageView.
 * Call `trackPurchase` after a successful payment.
 */
export function useFacebookPixel(pixelId: string | null | undefined) {
  const injected = useRef(false);

  useEffect(() => {
    if (!pixelId || injected.current) return;
    injected.current = true;

    // Facebook Pixel base code
    const f = window;
    const b = document;
    const n = "script";

    if (f.fbq) return; // already loaded

    const fbq = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fbq as any).callMethod
        ? (fbq as any).callMethod.apply(fbq, args)
        : (fbq as any).queue.push(args);
    };
    (fbq as any).push = fbq;
    (fbq as any).loaded = true;
    (fbq as any).version = "2.0";
    (fbq as any).queue = [];
    f.fbq = fbq;
    f._fbq = fbq;

    const script = b.createElement(n);
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = b.getElementsByTagName(n)[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
  }, [pixelId]);

  const trackPurchase = (value: number, currency: string, eventId?: string) => {
    if (!pixelId || !window.fbq) return;
    window.fbq("track", "Purchase", {
      value,
      currency,
      content_type: "product",
    }, eventId ? { eventID: eventId } : undefined);
  };

  const trackInitiateCheckout = (value: number, currency: string) => {
    if (!pixelId || !window.fbq) return;
    window.fbq("track", "InitiateCheckout", {
      value,
      currency,
    });
  };

  return { trackPurchase, trackInitiateCheckout };
}
