import { useEffect, useRef } from "react";

/**
 * Captures UTM/tracking parameters from the URL and persists them in sessionStorage.
 * Only overwrites if at least one parameter is present (to avoid clearing on internal nav).
 */
export function captureTrackingParams() {
  const params = new URLSearchParams(window.location.search);
  const tracking = {
    src: params.get("src") || params.get("ref") || null,
    sck: params.get("sck") || null,
    utm_source: params.get("utm_source") || null,
    utm_campaign: params.get("utm_campaign") || null,
    utm_medium: params.get("utm_medium") || null,
    utm_content: params.get("utm_content") || null,
    utm_term: params.get("utm_term") || null,
  };

  const hasParams = Object.values(tracking).some((v) => v);
  if (hasParams) {
    sessionStorage.setItem("utmify_tracking", JSON.stringify(tracking));
  }
}

/**
 * Retrieves persisted tracking parameters from sessionStorage.
 */
export function getStoredTracking(): Record<string, string | null> {
  try {
    return JSON.parse(sessionStorage.getItem("utmify_tracking") || "{}");
  } catch {
    return {};
  }
}

/**
 * Injects the UTMify tracking script and captures tracking params.
 * Safe to call multiple times — only injects once.
 */
export function useUtmifyScript() {
  const injected = useRef(false);

  useEffect(() => {
    // Always capture tracking params on mount
    captureTrackingParams();

    if (injected.current) return;

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
      try {
        document.head.removeChild(script);
      } catch {
        // already removed
      }
      injected.current = false;
    };
  }, []);
}
