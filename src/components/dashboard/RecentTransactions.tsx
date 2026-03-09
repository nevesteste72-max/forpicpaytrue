import { cn } from "@/lib/utils";
import { CreditCard, Clock, XCircle, Wallet } from "lucide-react";

interface Transaction {
  id: string;
  customer_email: string;
  customer_name?: string;
  amount: number;
  status: string;
  created_at: string;
  product_name?: string;
  order_bump_accepted: boolean;
  order_bump_amount: number | null;
  currency?: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const statusStyles: Record<string, { label: string; icon: typeof CreditCard; iconBg: string; iconColor: string }> = {
  completed: { label: "Venda Aprovada", icon: CreditCard, iconBg: "bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20", iconColor: "text-blue-600 dark:text-blue-400" },
  success: { label: "Venda Aprovada", icon: CreditCard, iconBg: "bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20", iconColor: "text-blue-600 dark:text-blue-400" },
  successful: { label: "Venda Aprovada", icon: CreditCard, iconBg: "bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20", iconColor: "text-blue-600 dark:text-blue-400" },
  pending: { label: "Pagamento Pendente", icon: Clock, iconBg: "bg-orange-50 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20", iconColor: "text-orange-600 dark:text-orange-400" },
  processing: { label: "Processando", icon: Clock, iconBg: "bg-orange-50 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20", iconColor: "text-orange-600 dark:text-orange-400" },
  failed: { label: "Falha no Pagamento", icon: XCircle, iconBg: "bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20", iconColor: "text-red-600 dark:text-red-400" },
};

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8 text-center">
        <p className="text-muted-foreground text-sm">Nenhuma transação ainda</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-0 flex flex-col h-full">
      <div className="p-4 md:p-5 border-b border-border/60 flex justify-between items-center">
        <h3 className="text-sm md:text-base font-semibold text-foreground">Atividade</h3>
        <span className="text-[10px] md:text-xs font-medium text-primary">Ao vivo</span>
      </div>
      <div className="flex-1 p-1.5 md:p-2 space-y-0.5">
        {transactions.slice(0, 6).map((tx) => {
          const style = statusStyles[tx.status] || statusStyles.pending;
          const Icon = style.icon;
          const isCompleted = tx.status === "completed" || tx.status === "success" || tx.status === "successful";
          const isFailed = tx.status === "failed";
          const name = tx.customer_name || tx.customer_email.split("@")[0];
          const amount = tx.currency === "ZAR"
            ? `R ${Number(tx.amount).toLocaleString("en-ZA")}`
            : `${Number(tx.amount).toLocaleString("pt-MZ")} MZN`;

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-2.5 md:p-3 hover:bg-muted/40 rounded-lg transition-colors cursor-pointer"
            >
              <div className={cn(
                "w-7 h-7 md:w-8 md:h-8 rounded-full border flex items-center justify-center shrink-0",
                style.iconBg
              )}>
                <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4", style.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-foreground truncate">{style.label}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                  {tx.product_name ? `${tx.product_name} • ` : ""}{name}
                </p>
              </div>
              <span className={cn(
                "text-[10px] md:text-xs font-semibold whitespace-nowrap",
                isCompleted ? "text-foreground" : isFailed ? "text-muted-foreground line-through" : "text-muted-foreground"
              )}>
                {isCompleted ? "+" : ""}{amount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
