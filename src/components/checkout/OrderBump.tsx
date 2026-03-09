import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface OrderBumpProps {
  productName: string;
  productDescription: string | null;
  amount: number;
  logoUrl: string | null;
  accepted: boolean;
  onToggle: (accepted: boolean) => void;
  currency?: string;
  locale?: string;
}

export function OrderBump({
  productName,
  productDescription,
  amount,
  logoUrl,
  accepted,
  onToggle,
  currency = "MZN",
  locale = "pt-MZ",
}: OrderBumpProps) {
  return (
    <label className="cursor-pointer block group">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => onToggle(e.target.checked)}
        className="peer sr-only"
      />
      <div
        className={cn(
          "p-4 rounded-xl border-2 border-dashed transition-all flex gap-4 items-start select-none",
          accepted
            ? "border-primary bg-primary/5"
            : "border-pending/30 bg-pending/5 hover:bg-pending/10"
        )}
      >
        <div
          className={cn(
            "w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
            accepted
              ? "bg-primary border-primary"
              : "bg-card border-border"
          )}
        >
          {accepted && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-foreground text-sm">{productName}</span>
            <span className="text-sm font-bold text-foreground">
              +{currency === "ZAR" ? `R ${amount.toLocaleString(locale)}` : `${amount.toLocaleString(locale)} MZN`}
            </span>
          </div>
          {productDescription && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {productDescription}
            </p>
          )}
        </div>
      </div>
    </label>
  );
}
