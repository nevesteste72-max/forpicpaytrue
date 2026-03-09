import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Loader2,
  Plus,
  Trash2,
  ArrowDown,
  ArrowRight,
  Zap,
  Gift,
  GripVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FlowStep {
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
}

interface FlowBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentLinkId: string;
  currency: string;
}

export function FlowBuilderDialog({
  open,
  onOpenChange,
  paymentLinkId,
  currency,
}: FlowBuilderDialogProps) {
  const { toast } = useToast();
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New step form
  const [newStepType, setNewStepType] = useState<"upsell" | "downsell">("upsell");
  const [newProductName, setNewProductName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (open && paymentLinkId) fetchSteps();
  }, [open, paymentLinkId]);

  const fetchSteps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("flow_steps")
        .select("*")
        .eq("payment_link_id", paymentLinkId)
        .order("step_order", { ascending: true });

      if (error) throw error;
      setSteps(data || []);
    } catch (err) {
      console.error("Failed to fetch flow steps:", err);
    } finally {
      setLoading(false);
    }
  };

  const addStep = async () => {
    if (!newProductName.trim() || !newAmount) return;
    setSaving(true);

    try {
      const stepOrder = steps.length + 1;

      const { data, error } = await supabase
        .from("flow_steps")
        .insert({
          payment_link_id: paymentLinkId,
          step_order: stepOrder,
          step_type: newStepType,
          product_name: newProductName.trim(),
          product_description: newDescription.trim() || null,
          amount: parseFloat(newAmount),
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-link: if there was a previous step, set its accept/decline to this new step
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        const updateField = newStepType === "downsell" ? "decline_step_id" : "accept_step_id";

        await supabase
          .from("flow_steps")
          .update({ [updateField]: data.id })
          .eq("id", lastStep.id);
      }

      // Reset form
      setNewProductName("");
      setNewDescription("");
      setNewAmount("");
      setShowAddForm(false);
      await fetchSteps();

      toast({ title: "Etapa adicionada!", description: `${newStepType === "upsell" ? "Upsell" : "Downsell"} criado com sucesso.` });
    } catch (err) {
      console.error("Failed to add step:", err);
      toast({ title: "Erro", description: "Falha ao adicionar etapa", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      // Clear references to this step
      await supabase
        .from("flow_steps")
        .update({ accept_step_id: null })
        .eq("accept_step_id", stepId);

      await supabase
        .from("flow_steps")
        .update({ decline_step_id: null })
        .eq("decline_step_id", stepId);

      await supabase
        .from("flow_steps")
        .delete()
        .eq("id", stepId);

      await fetchSteps();
      toast({ title: "Etapa removida" });
    } catch (err) {
      console.error("Failed to delete step:", err);
      toast({ title: "Erro", description: "Falha ao remover etapa", variant: "destructive" });
    }
  };

  const updateStepLink = async (stepId: string, field: "accept_step_id" | "decline_step_id", targetId: string | null) => {
    try {
      await supabase
        .from("flow_steps")
        .update({ [field]: targetId || null })
        .eq("id", stepId);

      await fetchSteps();
    } catch (err) {
      console.error("Failed to update step link:", err);
    }
  };

  const locale = currency === "ZAR" ? "en-ZA" : "pt-MZ";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Fluxo de Upsell / Downsell
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Flow Visualization */}
            <div className="space-y-2">
              {/* Main Product */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">
                  Produto Principal
                </p>
                <p className="text-sm text-foreground font-medium">
                  Compra concluída ✓
                </p>
              </div>

              {steps.length > 0 && (
                <div className="flex justify-center">
                  <ArrowDown className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              {/* Steps */}
              {steps.map((step, index) => (
                <div key={step.id}>
                  <div className={cn(
                    "relative rounded-xl p-4 border-2 transition-all",
                    step.step_type === "upsell"
                      ? "border-primary/30 bg-primary/5"
                      : "border-blue-500/30 bg-blue-500/5"
                  )}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        {step.step_type === "upsell" ? (
                          <Zap className="w-4 h-4 text-primary" />
                        ) : (
                          <Gift className="w-4 h-4 text-blue-500" />
                        )}
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          step.step_type === "upsell" ? "text-primary" : "text-blue-500"
                        )}>
                          {step.step_type === "upsell" ? "Upsell" : "Downsell"} #{step.step_order}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteStep(step.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <h4 className="font-semibold text-foreground">{step.product_name}</h4>
                    {step.product_description && (
                      <p className="text-xs text-muted-foreground mt-1">{step.product_description}</p>
                    )}
                    <p className="text-lg font-bold text-foreground mt-2">
                      {currency} {Number(step.amount).toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </p>

                    {/* Flow Links */}
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-success font-medium">✓ Aceita →</span>
                        <select
                          value={step.accept_step_id || "thankyou"}
                          onChange={(e) => updateStepLink(step.id, "accept_step_id", e.target.value === "thankyou" ? null : e.target.value)}
                          className="flex-1 h-7 text-xs rounded-md border border-border bg-background px-2"
                        >
                          <option value="thankyou">Página de Obrigado</option>
                          {steps.filter(s => s.id !== step.id).map(s => (
                            <option key={s.id} value={s.id}>
                              {s.step_type === "upsell" ? "Upsell" : "Downsell"} #{s.step_order}: {s.product_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-destructive font-medium">✗ Recusa →</span>
                        <select
                          value={step.decline_step_id || "thankyou"}
                          onChange={(e) => updateStepLink(step.id, "decline_step_id", e.target.value === "thankyou" ? null : e.target.value)}
                          className="flex-1 h-7 text-xs rounded-md border border-border bg-background px-2"
                        >
                          <option value="thankyou">Página de Obrigado</option>
                          {steps.filter(s => s.id !== step.id).map(s => (
                            <option key={s.id} value={s.id}>
                              {s.step_type === "upsell" ? "Upsell" : "Downsell"} #{s.step_order}: {s.product_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Thank You */}
              <div className="flex justify-center py-1">
                <ArrowDown className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
                <p className="text-xs text-success font-semibold uppercase tracking-wider mb-1">
                  Destino Final
                </p>
                <p className="text-sm text-foreground font-medium">
                  Página de Obrigado 🎉
                </p>
              </div>
            </div>

            {/* Add Step Form */}
            {showAddForm ? (
              <div className="border-2 border-dashed border-primary/30 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Nova Etapa</h4>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStepType("upsell")}
                    className={cn(
                      "p-2 rounded-lg border-2 text-center text-xs font-semibold transition-all",
                      newStepType === "upsell"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    🚀 Upsell
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStepType("downsell")}
                    className={cn(
                      "p-2 rounded-lg border-2 text-center text-xs font-semibold transition-all",
                      newStepType === "downsell"
                        ? "border-blue-500 bg-blue-500/5 text-blue-500"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    🎁 Downsell
                  </button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Nome do Produto</Label>
                  <Input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Ex: Mentoria Premium"
                    className="h-10 rounded-lg text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descrição da oferta..."
                    className="rounded-lg text-sm resize-none"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Preço ({currency})</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-10 rounded-lg text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={addStep}
                    disabled={saving || !newProductName.trim() || !newAmount}
                    size="sm"
                    className="flex-1 gradient-primary text-white rounded-lg"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                    className="rounded-lg"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="w-full rounded-xl border-dashed border-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Etapa
              </Button>
            )}

            {steps.length === 0 && !showAddForm && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhuma etapa configurada. Adicione um upsell ou downsell para começar.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
