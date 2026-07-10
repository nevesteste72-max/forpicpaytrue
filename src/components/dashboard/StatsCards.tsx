import { ShoppingCart, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  /** Revenue for the last few periods (oldest first) in the active currency, for the mini trend */
  sparklineData: number[];
  /** % change in completed orders vs. the immediately preceding period; null when not applicable (e.g. "Máximo") */
  ordersChangePercent: number | null;
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
  sparklineData,
  ordersChangePercent,
}: StatsCardsProps) {
  const maxSpark = Math.max(1, ...sparklineData);
  const hasSparkData = sparklineData.some((v) => v > 0);
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
        {/* Mini trend — real revenue for the last periods, not decorative */}
        <div className="mt-5 md:mt-6 h-8 flex items-end gap-1">
          {hasSparkData ? (
            <div className="w-full bg-muted/50 h-full rounded-sm flex items-end gap-0.5 px-1 pb-0.5">
              {sparklineData.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-[1px] transition-all",
                    i === sparklineData.length - 1 ? "bg-foreground" : "bg-border"
                  )}
                  style={{ height: `${Math.max(8, Math.round((v / maxSpark) * 100))}%` }}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full rounded-sm bg-muted/30 flex items-center px-2">
              <span className="text-[10px] text-muted-foreground">Sem vendas neste período</span>
            </div>
          )}
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
        {/* Real comparison vs. the previous equivalent period */}
        <div className="mt-6 md:mt-8">
          {ordersChangePercent === null ? (
            <p className="text-[10px] md:text-[11px] text-muted-foreground">
              {totalOrders} venda{totalOrders !== 1 ? "s" : ""} no total
            </p>
          ) : (
            <p className={cn(
              "text-[10px] md:text-[11px] font-medium flex items-center gap-1",
              ordersChangePercent > 0 ? "text-[hsl(145,60%,35%)]" : ordersChangePercent < 0 ? "text-destructive" : "text-muted-foreground"
            )}>
              {ordersChangePercent > 0 ? <TrendingUp className="w-3 h-3" /> : ordersChangePercent < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {ordersChangePercent > 0 ? "+" : ""}{Math.round(ordersChangePercent)}%
              <span className="text-muted-foreground font-normal">vs. período anterior</span>
            </p>
          )}
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
