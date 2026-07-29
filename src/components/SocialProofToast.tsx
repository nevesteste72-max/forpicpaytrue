import { useEffect, useState } from "react";

/**
 * Honest social-proof toast for the checkout.
 * Shows REAL recent purchases (anonymized: no name/email, only a plan label +
 * true relative time) pulled live from the `recent-purchases` edge function.
 * No fabricated names, times or locations — safe under EU consumer law & Meta.
 */

type Item = { label: string; created_at: string };

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export default function SocialProofToast() {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!base || !key) return;
    fetch(`${base}/functions/v1/recent-purchases`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.items) && d.items.length) setItems(d.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!items.length) return;
    let alive = true;
    let i = 0;
    const cycle = () => {
      if (!alive) return;
      setIdx(i % items.length);
      setShow(true);
      window.setTimeout(() => alive && setShow(false), 5000);
      i += 1;
    };
    const first = window.setTimeout(cycle, 3500);
    const interval = window.setInterval(cycle, 9000);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [items]);

  if (!items.length) return null;
  const item = items[idx];

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: 12,
        bottom: 16,
        zIndex: 60,
        width: 300,
        maxWidth: "86vw",
        transform: show ? "translateY(0)" : "translateY(160%)",
        opacity: show ? 1 : 0,
        transition: "transform .45s ease, opacity .45s ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#fff",
          border: "1px solid #e6e2da",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,.14)",
          padding: "10px 13px",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#eaf3ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ✅
        </div>
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 13, color: "#1c2a1e", fontWeight: 700 }}>
            Um produtor garantiu {item.label}
          </div>
          <div style={{ fontSize: 11, color: "#8a7a68" }}>
            🇵🇹 Portugal · {relTime(item.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
