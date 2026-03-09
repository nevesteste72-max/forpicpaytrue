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
  orders: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  currencyView?: "MZN" | "ZAR" | "USD";
}

export function RevenueChart({ data, currencyView = "MZN" }: RevenueChartProps) {
  const dataKey = currencyView === "ZAR" ? "revenueZAR" : currencyView === "USD" ? "revenueUSD" : "revenueMZN";
  const prefix = currencyView === "ZAR" ? "R " : currencyView === "USD" ? "$ " : "";
  const suffix = currencyView === "MZN" ? " MZN" : "";
  const locale = currencyView === "ZAR" ? "en-ZA" : currencyView === "USD" ? "en-US" : "pt-MZ";

  return (
    <div className="bg-card p-5 md:p-6 rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-foreground">Relatório Financeiro</h3>
        <button className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-1.5">
          Exportar
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
            <path d="M6 2v8M6 10l-3-3M6 10l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
              />
              <YAxis hide />
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
                formatter={(value: number) => [
                  `${prefix}${value.toLocaleString(locale)}${suffix}`,
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
