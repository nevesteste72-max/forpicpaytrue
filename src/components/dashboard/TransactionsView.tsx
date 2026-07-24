import { cn } from "@/lib/utils";
import { Clock, Search, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  customer_email: string;
  customer_name?: string;
  customer_phone?: string | null;
  amount: number;
  status: string;
  created_at: string;
  product_name?: string;
  order_bump_accepted: boolean;
  order_bump_amount: number | null;
  currency?: string;
  access_revoked?: boolean;
}

const PAID_STATUSES = ["successful", "success", "completed"];

interface TransactionsViewProps {
  transactions: Transaction[];
}

const statusConfig: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string; borderColor: string }> = {
  completed: { label: "Pago", dotColor: "bg-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-500/10", textColor: "text-emerald-700 dark:text-emerald-400", borderColor: "border-emerald-100/50 dark:border-emerald-500/20" },
  success: { label: "Pago", dotColor: "bg-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-500/10", textColor: "text-emerald-700 dark:text-emerald-400", borderColor: "border-emerald-100/50 dark:border-emerald-500/20" },
  successful: { label: "Pago", dotColor: "bg-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-500/10", textColor: "text-emerald-700 dark:text-emerald-400", borderColor: "border-emerald-100/50 dark:border-emerald-500/20" },
  pending: { label: "Pendente", dotColor: "bg-amber-500 animate-pulse", bgColor: "bg-amber-50 dark:bg-amber-500/10", textColor: "text-amber-700 dark:text-amber-400", borderColor: "border-amber-100/50 dark:border-amber-500/20" },
  processing: { label: "Processando", dotColor: "bg-blue-500 animate-pulse", bgColor: "bg-blue-50 dark:bg-blue-500/10", textColor: "text-blue-700 dark:text-blue-400", borderColor: "border-blue-100/50 dark:border-blue-500/20" },
  failed: { label: "Falhou", dotColor: "bg-red-500", bgColor: "bg-red-50 dark:bg-red-500/10", textColor: "text-red-700 dark:text-red-400", borderColor: "border-red-100/50 dark:border-red-500/20" },
};

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

export function TransactionsView({ transactions }: TransactionsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const [revokedOverride, setRevokedOverride] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const isRevoked = (tx: Transaction) => revokedOverride[tx.id] ?? tx.access_revoked ?? false;

  const toggleAccess = async (tx: Transaction) => {
    const next = !isRevoked(tx);
    setBusyId(tx.id);
    const { error } = await supabase
      .from("transactions")
      // Cast: access_revoked is newer than the generated Supabase types.
      .update({ access_revoked: next } as never)
      .eq("id", tx.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar o acesso.", variant: "destructive" });
      return;
    }
    setRevokedOverride((prev) => ({ ...prev, [tx.id]: next }));
    toast({
      title: next ? "Acesso revogado" : "Acesso restaurado",
      description: `${tx.customer_email} ${next ? "já não" : "volta a"} ter acesso à área de membros.`,
    });
  };

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      !search ||
      tx.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      tx.customer_phone?.toLowerCase().includes(search.toLowerCase()) ||
      tx.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter || 
      (statusFilter === "completed" && (tx.status === "successful" || tx.status === "success"));
    return matchesSearch && matchesStatus;
  });

  const statuses = ["all", "completed", "pending", "processing", "failed"];
  const statusLabels: Record<string, string> = {
    all: "Todas",
    completed: "Pagas",
    pending: "Pendentes",
    processing: "Processando",
    failed: "Falhadas",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">Transações</h2>
        <p className="text-sm text-muted-foreground">Histórico completo de pagamentos</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por email ou produto..."
            className="pl-10 h-9 rounded-lg bg-card border-border text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-card p-1 rounded-lg border border-border shadow-sm">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-12 text-center">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma transação encontrada</h3>
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Tente ajustar os filtros de pesquisa"
              : "As transações aparecerão aqui quando os clientes realizarem pagamentos"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/60">
                <tr>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Produto</th>
                  <th className="px-6 py-3 font-medium">Valor</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filtered.map((tx) => {
                  const config = statusConfig[tx.status] || statusConfig.pending;
                  const initials = getInitials(tx.customer_name || "", tx.customer_email);
                  const colorClass = getAvatarColor(tx.customer_email);

                  return (
                    <tr key={tx.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full bg-gradient-to-br border flex items-center justify-center text-xs font-bold shrink-0",
                            colorClass
                          )}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {tx.customer_name || tx.customer_email.split("@")[0]}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{tx.customer_email}</p>
                            {tx.customer_phone && (
                              <p className="text-xs text-muted-foreground truncate">{tx.customer_phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">
                        {tx.product_name || "—"}
                        {tx.order_bump_accepted && (
                          <span className="text-accent font-medium ml-1">+ bump</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-foreground">
                        {tx.currency === "ZAR"
                          ? `R ${Number(tx.amount).toLocaleString("en-ZA")}`
                          : `${Number(tx.amount).toLocaleString("pt-MZ")} MZN`}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                          config.bgColor,
                          config.textColor,
                          config.borderColor,
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground text-xs">
                        {new Date(tx.created_at).toLocaleDateString("pt-MZ", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-3.5">
                        {PAID_STATUSES.includes(tx.status) ? (
                          <button
                            onClick={() => toggleAccess(tx)}
                            disabled={busyId === tx.id}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60",
                              isRevoked(tx)
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                                : "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                            )}
                            title={isRevoked(tx) ? "Restaurar o acesso à área de membros" : "Revogar o acesso à área de membros"}
                          >
                            {busyId === tx.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isRevoked(tx) ? (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            ) : (
                              <ShieldOff className="w-3.5 h-3.5" />
                            )}
                            {isRevoked(tx) ? "Restaurar" : "Revogar"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
