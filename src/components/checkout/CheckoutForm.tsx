import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { PhoneInput } from "./PhoneInput";
import { CardPaymentForm } from "./CardPaymentForm";
import { AmountDisplay } from "./AmountDisplay";
import { PaymentStatus } from "./PaymentStatus";
import { useToast } from "@/hooks/use-toast";
import {
  initiatePayment,
  validateMoçambiquePhone,
  type PaymentMethod,
} from "@/lib/debito";
import { Loader2, ShieldCheck, Lock } from "lucide-react";

type PaymentState = "form" | "processing" | "pending" | "success" | "failed";

export function CheckoutForm() {
  const { toast } = useToast();
  const [paymentState, setPaymentState] = useState<PaymentState>("form");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [reference, setReference] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [cardData, setCardData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    if (!selectedMethod) {
      toast({
        title: "Selecione um método",
        description: "Escolha M-Pesa, eMola ou Cartão para continuar",
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 1) {
      toast({
        title: "Valor inválido",
        description: "O valor mínimo é 1 MZN",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Descrição obrigatória",
        description: "Adicione uma descrição para o pagamento",
        variant: "destructive",
      });
      return;
    }

    // Validate phone for mobile payments
    if (selectedMethod !== "card") {
      if (!phone) {
        setPhoneError("Número de telefone é obrigatório");
        return;
      }
      if (!validateMoçambiquePhone(phone)) {
        setPhoneError("Número inválido. Use formato: 84XXXXXXX");
        return;
      }
    }

    setPaymentState("processing");

    try {
      const response = await initiatePayment({
        method: selectedMethod,
        amount: numericAmount,
        reference_description: description,
        msisdn: selectedMethod !== "card" ? phone : undefined,
        ...cardData,
      });

      if (response.success) {
        setReference(response.debito_reference || "");
        
        if (response.redirect_url) {
          // For card payments, redirect to payment gateway
          window.location.href = response.redirect_url;
        } else {
          // For mobile payments, show pending status
          setPaymentState("pending");
        }
      } else {
        setErrorMessage(response.error || "Falha ao processar pagamento");
        setPaymentState("failed");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setErrorMessage("Erro de conexão. Tente novamente.");
      setPaymentState("failed");
    }
  };

  const resetForm = () => {
    setPaymentState("form");
    setSelectedMethod(null);
    setAmount("");
    setDescription("");
    setPhone("");
    setReference("");
    setErrorMessage("");
    setCardData({ first_name: "", last_name: "", email: "", phone: "" });
  };

  if (paymentState !== "form") {
    return (
      <div className="bg-card rounded-3xl p-8 shadow-lg border border-border">
        <PaymentStatus
          status={paymentState === "processing" ? "processing" : paymentState}
          reference={reference}
          message={errorMessage}
          onRetry={() => setPaymentState("form")}
          onNewPayment={resetForm}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Amount Section */}
      <div className="bg-card rounded-3xl p-8 shadow-lg border border-border">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium">
              Valor (MZN)
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-16 text-3xl font-bold text-center rounded-xl border-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição (máx. 20 caracteres)
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pagamento"
              maxLength={20}
              className="h-12 rounded-xl border-2"
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/20
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-card rounded-3xl p-8 shadow-lg border border-border">
        <h3 className="text-lg font-semibold mb-6 text-foreground">
          Método de Pagamento
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <PaymentMethodCard
            method="mpesa"
            selected={selectedMethod === "mpesa"}
            onSelect={() => setSelectedMethod("mpesa")}
          />
          <PaymentMethodCard
            method="card"
            selected={selectedMethod === "card"}
            onSelect={() => setSelectedMethod("card")}
          />
        </div>

        {/* Phone input for M-Pesa */}
        {selectedMethod === "mpesa" && (
          <div className="mt-6 animate-fade-in">
            <PhoneInput
              value={phone}
              onChange={(val) => {
                setPhone(val);
                setPhoneError("");
              }}
              error={phoneError}
            />
          </div>
        )}

        {/* Card payment form */}
        {selectedMethod === "card" && (
          <div className="mt-6">
            <CardPaymentForm
              data={cardData}
              onChange={setCardData}
            />
          </div>
        )}
      </div>

      {/* Summary & Submit */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-card rounded-3xl p-8 shadow-lg border border-border animate-fade-in">
          <AmountDisplay amount={parseFloat(amount)} className="mb-6" />

          <Button
            type="submit"
            disabled={!selectedMethod}
            className="w-full h-14 text-lg font-semibold rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {!selectedMethod ? (
              "Selecione um método"
            ) : (
              <>
                <Lock className="w-5 h-5 mr-2" />
                Pagar Agora
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <span>Pagamento seguro via Débito</span>
          </div>
        </div>
      )}
    </form>
  );
}
