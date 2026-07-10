import { DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type CurrencyView = "MZN" | "ZAR" | "USD" | "EUR" | "NGN";

interface StatsCardsProps {
  revenueMZN: number;
  revenueZAR: number;
  revenueUSD: number;
  revenueEUR: number;
  revenueNGN: number;
  totalOrders: number;
  pendingOrders: number;
  conversionRate: number;
  currencyView: CurrencyView;
  onCurrencyViewChange: (c: CurrencyView) => void;
}

export function StatsCards({
  revenueMZN,
  revenueZAR,
  revenueUSD,
  revenueEUR,
  revenueNGN,
  totalOrders,
  pendingOrders,
  conversionRate,
  currencyView,
  onCurrencyViewChange,
}: StatsCardsProps) {
  const displayRevenue =
    currencyView === "MZN"
      ? `${revenueMZN.toLocaleString("pt-MZ")} MZN`
      : currencyView === "ZAR"
        ? `R ${revenueZAR.toLocaleString("en-ZA")}`
        : currencyView === "USD"
          ? `$ ${revenueUSD.toLocaleString("en-US")}`
          : currencyView === "NGN"
            ? `₦ ${revenueNGN.toLocaleString("en-NG")}`
            : `€ ${revenueEUR.toLocaleString("de-DE")}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {/* Revenue Card */}
      <div className="group bg-card rounded-xl p-5 md:p-6 border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Receita Total</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tighter">
                {displayRevenue}
              </h2>
            </div>
          </div>
          {/* Currency Switcher */}
          <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border">
            {(["EUR", "MZN", "ZAR", "USD", "NGN"] as CurrencyView[]).map((c) => (
              <button
                key={c}
                onClick={() => onCurrencyViewChange(c)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                  currencyView === c
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {/* Mini bar chart */}
        <div className="mt-5 md:mt-6 h-8 flex items-end gap-1">
          <div className="w-full bg-muted/50 h-full rounded-sm flex items-end gap-0.5 px-1 pb-0.5">
            <div className="flex-1 bg-border rounded-[1px] h-[40%]" />
            <div className="flex-1 bg-border rounded-[1px] h-[70%]" />
            <div className="flex-1 bg-border rounded-[1px] h-[50%]" />
            <div className="flex-1 bg-border rounded-[1px] h-[80%]" />
            <div className="flex-1 bg-border rounded-[1px] h-[60%]" />
            <div className="flex-1 bg-border rounded-[1px] h-[90%]" />
            <div className="flex-1 bg-foreground rounded-[1px] h-[75%]" />
          </div>
        </div>
      </div>

      {/* Orders Card */}
      <div className="group bg-card rounded-xl p-5 md:p-6 border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Vendas</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tighter">{totalOrders.toLocaleString()}</h2>
              {pendingOrders > 0 && (
                <span className="inline-flex items-center text-[10px] md:text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border border-border">
                  {pendingOrders} pendente{pendingOrders !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-6 md:mt-8">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${Math.min(conversionRate * 10, 100)}%` }} />
          </div>
          <p className="text-[10px] md:text-[11px] text-muted-foreground mt-2 flex justify-between">
            <span>Meta mensal</span>
            <span className="text-foreground font-medium">{Math.min(Math.round(conversionRate * 10), 100)}%</span>
          </p>
        </div>
      </div>

      {/* Conversion Card */}
      <div className="group bg-card rounded-xl p-5 md:p-6 border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Taxa de Conversão</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tighter">{conversionRate.toFixed(1)}%</h2>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        {/* SVG wave */}
        <div className="mt-5 md:mt-6 h-8 w-full relative opacity-40">
          <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-full text-foreground">
            <path d="M0,25 C40,40 60,10 100,25 C140,40 160,10 200,20" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
