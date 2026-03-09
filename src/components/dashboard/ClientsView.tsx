import { Search, Mail, Phone, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  customer_email: string;
  customer_name?: string;
  customer_phone: string | null;
  amount: number;
  status: string;
  created_at: string;
  payment_link_id: string;
  order_bump_accepted: boolean;
  order_bump_amount: number | null;
  currency?: string;
}

interface ClientsViewProps {
  transactions: Transaction[];
}

interface Client {
  email: string;
  name?: string;
  totalSpentMZN: number;
  totalSpentZAR: number;
  totalOrders: number;
  lastOrder: string;
  phone?: string;
}

const avatarColors = [
  "from-indigo-100 to-white border-indigo-100 text-indigo-600 dark:from-indigo-500/20 dark:to-indigo-500/5 dark:border-indigo-500/30 dark:text-indigo-400",
  "from-purple-100 to-white border-purple-100 text-purple-600 dark:from-purple-500/20 dark:to-purple-500/5 dark:border-purple-500/30 dark:text-purple-400",
  "from-pink-100 to-white border-pink-100 text-pink-600 dark:from-pink-500/20 dark:to-pink-500/5 dark:border-pink-500/30 dark:text-pink-400",
  "from-teal-100 to-white border-teal-100 text-teal-600 dark:from-teal-500/20 dark:to-teal-500/5 dark:border-teal-500/30 dark:text-teal-400",
  "from-orange-100 to-white border-orange-100 text-orange-600 dark:from-orange-500/20 dark:to-orange-500/5 dark:border-orange-500/30 dark:text-orange-400",
];

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function ClientsView({ transactions }: ClientsViewProps) {
  const [search, setSearch] = useState("");

  const clients = useMemo(() => {
    const map = new Map<string, Client>();

    for (const tx of transactions) {
      if (!tx.customer_email) continue;
      const isCompleted = tx.status === "completed" || tx.status === "success" || tx.status === "successful";
      const isZAR = tx.currency === "ZAR";

      const existing = map.get(tx.customer_email);
      const txAmount = Number(tx.amount);

      if (existing) {
        if (isCompleted) {
          if (isZAR) existing.totalSpentZAR += txAmount;
          else existing.totalSpentMZN += txAmount;
          existing.totalOrders += 1;
        }
        if (new Date(tx.created_at) > new Date(existing.lastOrder)) {
          existing.lastOrder = tx.created_at;
        }
      } else {
        map.set(tx.customer_email, {
          email: tx.customer_email,
          name: tx.customer_name || undefined,
          totalSpentMZN: isCompleted && !isZAR ? txAmount : 0,
          totalSpentZAR: isCompleted && isZAR ? txAmount : 0,
          totalOrders: isCompleted ? 1 : 0,
          lastOrder: tx.created_at,
          phone: tx.customer_phone,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
    );
  }, [transactions]);

  const filtered = clients.filter(
    (c) => !search || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">Clientes</h2>
        <p className="text-sm text-muted-foreground">
          {clients.length} cliente{clients.length !== 1 ? "s" : ""} registado{clients.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por email..."
          className="pl-10 h-9 rounded-lg bg-card border-border text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-12 text-center">
          <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-semibold text-foreground mb-1">Nenhum cliente encontrado</h3>
          <p className="text-sm text-muted-foreground">
            {search
              ? "Tente ajustar a pesquisa"
              : "Os clientes aparecerão aqui quando realizarem pagamentos"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const initials = getInitials(client.name || "", client.email);
            const colorClass = getAvatarColor(client.email);

            return (
              <div
                key={client.email}
                className="group bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all duration-200 p-5 relative overflow-hidden"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full bg-gradient-to-br border flex items-center justify-center text-xs font-bold shrink-0",
                    colorClass
                  )}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {client.name || client.email.split("@")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                    {client.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        +258 {client.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total MZN</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {client.totalSpentMZN.toLocaleString("pt-MZ")} MZN
                    </p>
                  </div>
                  {client.totalSpentZAR > 0 && (
                    <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total ZAR</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        R {client.totalSpentZAR.toLocaleString("en-ZA")}
                      </p>
                    </div>
                  )}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Compras</p>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1 mt-0.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      {client.totalOrders}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mt-3">
                  Última compra:{" "}
                  {new Date(client.lastOrder).toLocaleDateString("pt-MZ", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
