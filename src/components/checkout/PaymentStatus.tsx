import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "pending" | "success" | "failed" | "processing";

interface PaymentStatusProps {
  status: Status;
  reference?: string;
  message?: string;
  onRetry?: () => void;
  onNewPayment?: () => void;
}

const statusConfig = {
  pending: {
    Icon: Clock,
    title: "Aguardando Confirmação",
    description: "Verifique seu telefone para confirmar o pagamento",
    color: "text-pending",
    bgColor: "bg-pending/10",
  },
  processing: {
    Icon: Loader2,
    title: "Processando...",
    description: "Estamos a processar o seu pagamento",
    color: "text-primary",
    bgColor: "bg-primary/10",
    animate: true,
  },
  success: {
    Icon: CheckCircle2,
    title: "Pagamento Confirmado!",
    description: "O seu pagamento foi processado com sucesso",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  failed: {
    Icon: XCircle,
    title: "Pagamento Falhou",
    description: "Não foi possível processar o pagamento",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export function PaymentStatus({
  status,
  reference,
  message,
  onRetry,
  onNewPayment,
}: PaymentStatusProps) {
  const config = statusConfig[status];
  const { Icon } = config;

  return (
    <div className="flex flex-col items-center justify-center py-8 animate-scale-in">
      <div
        className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mb-6",
          config.bgColor
        )}
      >
        <Icon
          className={cn(
            "w-10 h-10",
            config.color,
            (config as { animate?: boolean }).animate && "animate-spin"
          )}
        />
      </div>

      <h3 className={cn("text-2xl font-bold mb-2", config.color)}>{config.title}</h3>
      <p className="text-muted-foreground text-center max-w-sm">
        {message || config.description}
      </p>

      {reference && (
        <div className="mt-6 px-4 py-3 bg-muted rounded-xl">
          <p className="text-xs text-muted-foreground mb-1">Referência</p>
          <p className="font-mono font-semibold text-foreground">{reference}</p>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        {status === "failed" && onRetry && (
          <Button onClick={onRetry} variant="outline" className="rounded-xl">
            Tentar Novamente
          </Button>
        )}
        {(status === "success" || status === "failed") && onNewPayment && (
          <Button onClick={onNewPayment} className="rounded-xl gradient-primary text-white">
            Novo Pagamento
          </Button>
        )}
      </div>
    </div>
  );
}
