import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Palette, Type, ExternalLink, ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowStep {
  id: string;
  payment_link_id: string;
  step_order: number;
  step_type: string;
  product_name: string;
  product_description: string | null;
  amount: number;
  image_url: string | null;
  accept_step_id: string | null;
  decline_step_id: string | null;
  accept_redirect_url: string | null;
  decline_redirect_url: string | null;
  button_accept_text: string;
  button_accept_color: string;
  button_decline_text: string;
  button_decline_color: string;
  show_accept_button: boolean;
  show_decline_button: boolean;
  page_headline: string | null;
  page_subheadline: string | null;
  page_url: string | null;
}

interface FlowStepEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: FlowStep | null;
  steps: FlowStep[];
  currency: string;
  onUpdate: (stepId: string, updates: Partial<FlowStep>) => void;
  onDelete: (stepId: string) => void;
  onPreview: (stepId: string) => void;
}

export function FlowStepEditDialog({
  open,
  onOpenChange,
  step,
  steps,
  currency,
  onUpdate,
  onDelete,
  onPreview,
}: FlowStepEditDialogProps) {
  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Editar — {step.step_type === "upsell" ? "Upsell" : "Downsell"} #{step.step_order}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Nome da Oferta</Label>
              <Input
                value={step.product_name}
                onChange={(e) => onUpdate(step.id, { product_name: e.target.value })}
                placeholder="Ex: Mentoria Premium"
                className="h-9 text-sm rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdate(step.id, { step_type: "upsell" })}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-semibold transition-all",
                    step.step_type === "upsell"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  Upsell
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(step.id, { step_type: "downsell" })}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-semibold transition-all",
                    step.step_type === "downsell"
                      ? "border-blue-500 bg-blue-500/10 text-blue-600"
                      : "border-border text-muted-foreground hover:border-blue-500/40"
                  )}
                >
                  Downsell
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={step.product_description || ""}
              onChange={(e) =>
                onUpdate(step.id, { product_description: e.target.value || null })
              }
              placeholder="Descrição da oferta..."
              className="rounded-xl text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Preço ({currency})</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={step.amount}
              onChange={(e) =>
                onUpdate(step.id, { amount: parseFloat(e.target.value) || 0 })
              }
              className="h-9 text-sm rounded-xl"
            />
          </div>

          {/* External Page URL */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> URL da Página Externa
            </h4>
            <div className="space-y-2">
              <Label className="text-xs">
                URL onde esta oferta está hospedada
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={step.page_url || ""}
                  onChange={(e) =>
                    onUpdate(step.id, { page_url: e.target.value || null })
                  }
                  placeholder="https://seusite.com/upsell-1"
                  className="h-9 text-xs rounded-lg pl-8"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Esta é a página do seu site onde você vai colar o código embed. O checkout redireciona para cá após a compra.
              </p>
            </div>
          </div>

          {/* Page Content */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" /> Conteúdo da Página
            </h4>
            <div className="space-y-2">
              <Label className="text-xs">Título principal</Label>
              <Input
                value={step.page_headline || ""}
                onChange={(e) =>
                  onUpdate(step.id, { page_headline: e.target.value || null })
                }
                placeholder="Ex: Espere! Temos uma oferta especial..."
                className="h-9 text-sm rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Subtítulo</Label>
              <Input
                value={step.page_subheadline || ""}
                onChange={(e) =>
                  onUpdate(step.id, { page_subheadline: e.target.value || null })
                }
                placeholder="Ex: Aproveite esta oferta exclusiva"
                className="h-9 text-sm rounded-xl"
              />
            </div>
          </div>

          {/* Redirect URLs */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> URLs de Redirecionamento
            </h4>

            {/* Accept URL */}
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 space-y-2">
              <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Quando ACEITA, redirecionar para:
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={step.accept_redirect_url || ""}
                  onChange={(e) =>
                    onUpdate(step.id, {
                      accept_redirect_url: e.target.value || null,
                      accept_step_id: null,
                    })
                  }
                  placeholder="https://seusite.com/obrigado (vazio = página de obrigado)"
                  className="h-9 text-xs rounded-lg pl-8"
                />
              </div>
            </div>

            {/* Decline URL */}
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 p-3 space-y-2">
              <Label className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                Quando RECUSA, redirecionar para:
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={step.decline_redirect_url || ""}
                  onChange={(e) =>
                    onUpdate(step.id, {
                      decline_redirect_url: e.target.value || null,
                      decline_step_id: null,
                    })
                  }
                  placeholder="https://seusite.com/downsell (vazio = página de obrigado)"
                  className="h-9 text-xs rounded-lg pl-8"
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Deixe vazio para enviar o cliente para a página de obrigado padrão do PicPay.
            </p>
          </div>

          {/* Button Customization */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Botões
            </h4>

            {/* Accept Button */}
            <div className="p-3 rounded-xl bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Botão "Aceitar"</Label>
                <Switch
                  checked={step.show_accept_button}
                  onCheckedChange={(v) => onUpdate(step.id, { show_accept_button: v })}
                />
              </div>
              {step.show_accept_button && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Texto</Label>
                      <Input
                        value={step.button_accept_text}
                        onChange={(e) =>
                          onUpdate(step.id, { button_accept_text: e.target.value })
                        }
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Cor</Label>
                      <div className="flex gap-1.5">
                        <input
                          type="color"
                          value={step.button_accept_color}
                          onChange={(e) =>
                            onUpdate(step.id, { button_accept_color: e.target.value })
                          }
                          className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                        />
                        <Input
                          value={step.button_accept_color}
                          onChange={(e) =>
                            onUpdate(step.id, { button_accept_color: e.target.value })
                          }
                          className="h-8 text-xs rounded-lg font-mono flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold"
                    style={{ backgroundColor: step.button_accept_color }}
                    disabled
                  >
                    {step.button_accept_text}
                  </button>
                </>
              )}
            </div>

            {/* Decline Button */}
            <div className="p-3 rounded-xl bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Botão "Recusar"</Label>
                <Switch
                  checked={step.show_decline_button}
                  onCheckedChange={(v) =>
                    onUpdate(step.id, { show_decline_button: v })
                  }
                />
              </div>
              {step.show_decline_button && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Texto</Label>
                      <Input
                        value={step.button_decline_text}
                        onChange={(e) =>
                          onUpdate(step.id, { button_decline_text: e.target.value })
                        }
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Cor</Label>
                      <div className="flex gap-1.5">
                        <input
                          type="color"
                          value={step.button_decline_color}
                          onChange={(e) =>
                            onUpdate(step.id, { button_decline_color: e.target.value })
                          }
                          className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                        />
                        <Input
                          value={step.button_decline_color}
                          onChange={(e) =>
                            onUpdate(step.id, { button_decline_color: e.target.value })
                          }
                          className="h-8 text-xs rounded-lg font-mono flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    className="w-full py-2 rounded-xl text-sm font-medium border-2"
                    style={{
                      color: step.button_decline_color,
                      borderColor: step.button_decline_color,
                    }}
                    disabled
                  >
                    {step.button_decline_text}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl text-xs"
              onClick={() => onPreview(step.id)}
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Preview
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                onDelete(step.id);
                onOpenChange(false);
              }}
            >
              Remover Etapa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
