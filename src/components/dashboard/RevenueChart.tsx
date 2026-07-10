import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueDataPoint {
  date: string;
  revenueMZN: number;
  revenueZAR: number;
  revenueUSD: number;
  revenueEUR: number;
  revenueNGN: number;
  orders: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  currencyView?: "MZN" | "ZAR" | "USD" | "EUR" | "NGN";
}

const DATA_KEY: Record<string, string> = {
  ZAR: "revenueZAR",
  USD: "revenueUSD",
  EUR: "revenueEUR",
  NGN: "revenueNGN",
  MZN: "revenueMZN",
};
const PREFIX: Record<string, string> = { ZAR: "R ", USD: "$ ", EUR: "€ ", NGN: "₦ ", MZN: "" };
const SUFFIX: Record<string, string> = { MZN: " MZN" };
const LOCALE: Record<string, string> = { ZAR: "en-ZA", USD: "en-US", EUR: "de-DE", NGN: "en-NG", MZN: "pt-MZ" };

// Compact tick labels (1.2k, 3.4M) so the Y-axis stays readable on narrow screens
function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(value)}`;
}

export function RevenueChart({ data, currencyView = "EUR" }: RevenueChartProps) {
  const dataKey = DATA_KEY[currencyView] || "revenueMZN";
  const prefix = PREFIX[currencyView] ?? "";
  const suffix = SUFFIX[currencyView] ?? "";
  const locale = LOCALE[currencyView] || "pt-MZ";

  const totalRevenue = data.reduce((sum, d) => sum + (d[dataKey as keyof RevenueDataPoint] as number), 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

  // Skip X-axis labels on narrow charts / long ranges so dates don't overlap
  const maxLabels = 7;
  const xAxisInterval = data.length > maxLabels ? Math.ceil(data.length / maxLabels) - 1 : 0;

  return (
    <div className="bg-card p-5 md:p-6 rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between mb-1 gap-3">
        <h3 className="text-base font-semibold text-foreground">Relatório Financeiro</h3>
        <button className="shrink-0 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-1.5">
          Exportar
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
            <path d="M6 2v8M6 10l-3-3M6 10l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Totals summary so the numbers are clear without hovering the chart */}
      <div className="flex items-baseline gap-3 mb-5 flex-wrap">
        <span className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">
          {prefix}{totalRevenue.toLocaleString(locale)}{suffix}
        </span>
        <span className="text-xs text-muted-foreground">
          {totalOrders} venda{totalOrders !== 1 ? "s" : ""} no período
        </span>
      </div>

      <div className="h-52 md:h-64">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 0%, 80%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(0, 0%, 80%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="hsl(0, 0%, 92%)"
                vertical={false}
                horizontalCoordinatesGenerator={({ height }) => [height * 0.25, height * 0.5, height * 0.75]}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(0, 0%, 55%)" }}
                axisLine={false}
                tickLine={false}
                interval={xAxisInterval}
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(0, 0%, 55%)" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={formatCompact}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 10%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  fontSize: "13px",
                  padding: "8px 12px",
                  lineHeight: "1.4",
                }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "rgba(255,255,255,0.7)", fontWeight: 400, fontSize: "11px", marginBottom: 2 }}
                formatter={(value: number, _name, item) => [
                  `${prefix}${value.toLocaleString(locale)}${suffix} · ${item.payload.orders} venda${item.payload.orders !== 1 ? "s" : ""}`,
                  "",
                ]}
                separator=""
              />
              <Area
                type="natural"
                dataKey={dataKey}
                stroke="hsl(0, 0%, 15%)"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: "#fff", stroke: "hsl(0, 0%, 15%)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <p>Sem dados para o período selecionado</p>
          </div>
        )}
      </div>
    </div>
  );
}
