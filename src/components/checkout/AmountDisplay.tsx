import { cn } from "@/lib/utils";

interface AmountDisplayProps {
  amount: number;
  className?: string;
}

export function AmountDisplay({ amount, className }: AmountDisplayProps) {
  const formattedAmount = new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <div className={cn("text-center", className)}>
      <p className="text-sm text-muted-foreground mb-1">Total a pagar</p>
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-2xl font-medium text-muted-foreground">MZN</span>
        <span className="text-5xl font-bold text-foreground tracking-tight">
          {formattedAmount}
        </span>
      </div>
    </div>
  );
}
