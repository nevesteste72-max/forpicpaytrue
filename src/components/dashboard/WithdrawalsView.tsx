import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Loader2,
  Banknote,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface Withdrawal {
  id: string;
  amount: number;
  phone_number: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface WithdrawalsViewProps {
  availableBalance: number;
  pendingBalance: number;
  withdrawals: Withdrawal[];
  onWithdrawalCreated: () => void;
}

const statusConfig: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string; borderColor: string; Icon: typeof Clock }> = {
  pending: { label: "Pendente", dotColor: "bg-amber-500 animate-pulse", bgColor: "bg-amber-50 dark:bg-amber-500/10", textColor: "text-amber-700 dark:text-amber-400", borderColor: "border-amber-100/50 dark:border-amber-500/20", Icon: Clock },
  approved: { label: "Aprovado", dotColor: "bg-blue-500", bgColor: "bg-blue-50 dark:bg-blue-500/10", textColor: "text-blue-700 dark:text-blue-400", borderColor: "border-blue-100/50 dark:border-blue-500/20", Icon: CheckCircle2 },
  completed: { label: "Concluído", dotColor: "bg-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-500/10", textColor: "text-emerald-700 dark:text-emerald-400", borderColor: "border-emerald-100/50 dark:border-emerald-500/20", Icon: CheckCircle2 },
  rejected: { label: "Rejeitado", dotColor: "bg-red-500", bgColor: "bg-red-50 dark:bg-red-500/10", textColor: "text-red-700 dark:text-red-400", borderColor: "border-red-100/50 dark:border-red-500/20", Icon: XCircle },
};

export function WithdrawalsView({
  availableBalance,
  pendingBalance,
  withdrawals,
  onWithdrawalCreated,
}: WithdrawalsViewProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + Number(w.amount), 0);

  const effectiveBalance = availableBalance - pendingWithdrawals;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      toast({
        title: "Valor inválido",
        description: "O valor mínimo de saque é 100 MZN",
        variant: "destructive",
      });
      return;
    }

    if (numericAmount > effectiveBalance) {
      toast({
        title: "Saldo insuficiente",
        description: "O valor solicitado excede o seu saldo disponível",
        variant: "destructive",
      });
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (!/^8[4-7]\d{7}$/.test(digits)) {
      toast({
        title: "Número inválido",
        description: "Introduza um número M-Pesa válido (84/85/86/87)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("withdrawals").insert({
        user_id: user.id,
        amount: numericAmount,
        phone_number: digits,
      });

      if (error) throw error;

      toast({
        title: "Saque solicitado!",
        description: `Solicitação de ${numericAmount.toLocaleString("pt-MZ")} MZN enviada com sucesso`,
      });
      setAmount("");
      setPhone("");
      setShowForm(false);
      onWithdrawalCreated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao solicitar saque";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    setPhone(digits);
  };

  const displayPhone = phone
    ? `${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 9)}`.trim()
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">Saques</h2>
        <p className="text-sm text-muted-foreground">Solicite a transferência do seu saldo</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="group bg-card p-5 rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent opacity-60" />
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Saldo Disponível
          </p>
          <h3 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
            {effectiveBalance.toLocaleString("pt-MZ")} <span className="text-sm font-normal text-muted-foreground">MZN</span>
          </h3>
        </div>

        <div className="group bg-card p-5 rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Pendente
          </p>
          <h3 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
            {(pendingBalance + pendingWithdrawals).toLocaleString("pt-MZ")} <span className="text-sm font-normal text-muted-foreground">MZN</span>
          </h3>
        </div>

        <div className="group bg-card p-5 rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Total Sacado
          </p>
          <h3 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
            {withdrawals
              .filter((w) => w.status === "completed" || w.status === "successful")
              .reduce((s, w) => s + Number(w.amount), 0)
              .toLocaleString("pt-MZ")}{" "}
            <span className="text-sm font-normal text-muted-foreground">MZN</span>
          </h3>
        </div>
      </div>

      {/* Request Withdrawal Button / Form */}
      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          disabled={effectiveBalance < 100}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-lg h-10 px-5 shadow-sm text-sm font-medium"
        >
          <ArrowDownToLine className="w-4 h-4 mr-2" />
          Solicitar Saque
        </Button>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 max-w-md animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            Novo Saque
          </h3>

          {effectiveBalance < 100 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100/50 dark:border-red-500/20 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">
                Saldo insuficiente. O mínimo para saque é 100 MZN.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Valor (MZN)</Label>
              <Input
                type="number"
                min="100"
                step="0.01"
                max={effectiveBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-11 text-lg font-semibold rounded-lg border-border"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Mínimo: 100 MZN · Disponível: {effectiveBalance.toLocaleString("pt-MZ")} MZN
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Número M-Pesa</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">+258</span>
                </div>
                <Input
                  type="tel"
                  value={displayPhone}
                  onChange={(e) => formatPhone(e.target.value)}
                  placeholder="84 XXX XXXX"
                  className="pl-24 h-11 rounded-lg border-border"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setAmount("");
                  setPhone("");
                }}
                className="flex-1 rounded-lg h-10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || effectiveBalance < 100}
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 rounded-lg h-10"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirmar Saque"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Withdrawal History */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Histórico de Saques</h3>
        {withdrawals.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-12 text-center">
            <Banknote className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-semibold text-foreground mb-1">Nenhum saque realizado</h3>
            <p className="text-sm text-muted-foreground">
              As suas solicitações de saque aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/60">
                  <tr>
                    <th className="px-6 py-3 font-medium">Valor</th>
                    <th className="px-6 py-3 font-medium">Número</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {withdrawals.map((w) => {
                    const config = statusConfig[w.status] || statusConfig.pending;
                    return (
                      <tr key={w.id} className="group hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-foreground">
                          {Number(w.amount).toLocaleString("pt-MZ")} MZN
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground font-mono text-xs">
                          +258 {w.phone_number.slice(0, 2)} {w.phone_number.slice(2, 5)} {w.phone_number.slice(5)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                              config.bgColor,
                              config.textColor,
                              config.borderColor,
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground text-xs">
                          {new Date(w.created_at).toLocaleDateString("pt-MZ", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
    </div>
  );
}
