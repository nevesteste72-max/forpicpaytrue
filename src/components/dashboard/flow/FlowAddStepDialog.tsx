import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowAddStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  saving: boolean;
  existingStepCount: number;
  onAdd: (data: {
    stepType: "upsell" | "downsell";
    productName: string;
    description: string;
    amount: string;
    headline: string;
    subheadline: string;
    pageUrl: string;
    acceptRedirectUrl: string;
    declineRedirectUrl: string;
  }) => void;
}

export function FlowAddStepDialog({
  open,
  onOpenChange,
  currency,
  saving,
  existingStepCount,
  onAdd,
}: FlowAddStepDialogProps) {
  const [stepType, setStepType] = useState<"upsell" | "downsell">("upsell");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [acceptRedirectUrl, setAcceptRedirectUrl] = useState("");
  const [declineRedirectUrl, setDeclineRedirectUrl] = useState("");

  const handleSubmit = () => {
    onAdd({
      stepType,
      productName,
      description,
      amount,
      headline,
      subheadline,
      pageUrl,
      acceptRedirectUrl,
      declineRedirectUrl,
    });
    // Reset
    setProductName("");
    setDescription("");
    setAmount("");
    setHeadline("");
    setSubheadline("");
    setPageUrl("");
    setAcceptRedirectUrl("");
    setDeclineRedirectUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Nova Etapa #{existingStepCount + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStepType("upsell")}
              className={cn(
                "p-3 rounded-xl border-2 text-center text-xs font-semibold transition-all",
                stepType === "upsell"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              Upsell
            </button>
            <button
              type="button"
              onClick={() => setStepType("downsell")}
              className={cn(
                "p-3 rounded-xl border-2 text-center text-xs font-semibold transition-all",
                stepType === "downsell"
                  ? "border-blue-500 bg-blue-500/5 text-blue-600"
                  : "border-border text-muted-foreground"
              )}
            >
              Downsell
            </button>
          </div>

          {/* Product Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Oferta *</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Mentoria Premium"
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preço ({currency}) *</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição curta da oferta..."
              className="rounded-xl text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título da Página (opcional)</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Espere! Oferta especial..."
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subtítulo (opcional)</Label>
              <Input
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                placeholder="Aproveite agora"
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* External Page URL - MOST IMPORTANT */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              URL da Pagina Externa *
            </h4>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                URL onde você vai hospedar esta oferta
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://seusite.com/upsell-1"
                  className="h-10 rounded-xl text-sm pl-9"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Após a compra, o cliente é redirecionado para esta URL. Nela, cole o código embed gerado.
              </p>
            </div>
          </div>

          {/* Redirect URLs */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Destinos após Aceitar / Recusar
            </h4>

            <div className="space-y-1.5">
              <Label className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                Quando ACEITA, redirecionar para:
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={acceptRedirectUrl}
                  onChange={(e) => setAcceptRedirectUrl(e.target.value)}
                  placeholder="https://seusite.com/upsell-2 (vazio = página de obrigado)"
                  className="h-10 rounded-xl text-sm pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                Quando RECUSA, redirecionar para:
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={declineRedirectUrl}
                  onChange={(e) => setDeclineRedirectUrl(e.target.value)}
                  placeholder="https://seusite.com/downsell (vazio = página de obrigado)"
                  className="h-10 rounded-xl text-sm pl-9"
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Se deixar vazio, o cliente vai para a página de obrigado do CashPay.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={saving || !productName.trim() || !amount}
              className="flex-1 gradient-primary text-white rounded-xl h-11"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Criar Etapa"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
