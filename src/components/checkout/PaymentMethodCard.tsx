import { cn } from "@/lib/utils";
import { CreditCard, Phone, Wallet } from "lucide-react";
import type { PaymentMethod } from "@/lib/debito";

interface PaymentMethodCardProps {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}

const methodConfig = {
  mpesa: {
    name: "M-Pesa",
    description: "Pagamento via Vodacom",
    Icon: Phone,
    gradient: "gradient-mpesa",
    borderColor: "border-mpesa/50",
    hoverBorder: "hover:border-mpesa",
  },
  emola: {
    name: "eMola",
    description: "Pagamento via Movitel",
    Icon: Wallet,
    gradient: "gradient-emola",
    borderColor: "border-emola/50",
    hoverBorder: "hover:border-emola",
  },
  card: {
    name: "Cartão",
    description: "Visa / Mastercard",
    Icon: CreditCard,
    gradient: "gradient-card-payment",
    borderColor: "border-card-payment/50",
    hoverBorder: "hover:border-card-payment",
  },
};

export function PaymentMethodCard({ method, selected, onSelect }: PaymentMethodCardProps) {
  const config = methodConfig[method];
  const { Icon } = config;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300 w-full",
        "bg-card hover:shadow-lg",
        selected
          ? `${config.borderColor} shadow-md ring-2 ring-offset-2 ring-offset-background`
          : `border-border ${config.hoverBorder}`
      )}
      style={{
        ["--tw-ring-color" as string]: selected
          ? method === "mpesa"
            ? "hsl(var(--mpesa))"
            : method === "emola"
            ? "hsl(var(--emola))"
            : "hsl(var(--card-payment))"
          : "transparent",
      }}
    >
      <div
        className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-300",
          config.gradient,
          selected && "scale-110"
        )}
      >
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">{config.name}</p>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      {selected && (
        <div
          className={cn(
            "absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center",
            config.gradient
          )}
        >
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
