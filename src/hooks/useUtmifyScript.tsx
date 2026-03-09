import { useEffect, useRef } from "react";

/**
 * Injects the UTMify tracking script on the checkout page.
 * Safe to call multiple times — only injects once.
 */
export function useUtmifyScript() {
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;

    // Check if already present
    const existing = document.querySelector('script[src*="utmify.com.br/scripts/utms"]');
    if (existing) {
      injected.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.utmify.com.br/scripts/utms/latest.js";
    script.async = true;
    script.defer = true;
    script.setAttribute("data-utmify-prevent-xcod-sck", "");
    script.setAttribute("data-utmify-prevent-subids", "");
    document.head.appendChild(script);

    injected.current = true;

    return () => {
      // Cleanup on unmount
      try {
        document.head.removeChild(script);
      } catch {
        // already removed
      }
      injected.current = false;
    };
  }, []);
}
