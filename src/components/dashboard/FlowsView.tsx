import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  ArrowDown,
  PartyPopper,
  ExternalLink,
  Save,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { FlowStepEditDialog, type FlowStep } from "./flow/FlowStepEditDialog";
import { FlowAddStepDialog } from "./flow/FlowAddStepDialog";
import { FunnelStepCard } from "./flow/FunnelStepCard";

interface Product {
  id: string;
  product_name: string;
  amount: number;
  currency: string;
  logo_url: string | null;
  redirect_url: string | null;
  thank_you_title: string | null;
  thank_you_message: string | null;
  thank_you_video_url: string | null;
}

interface FlowsViewProps {
  products: Product[];
}

export function FlowsView({ products }: FlowsViewProps) {
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Thank you page config
  const [thankYouUrl, setThankYouUrl] = useState("");
  const [thankYouTitle, setThankYouTitle] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [savingThankYou, setSavingThankYou] = useState(false);

  // Dialogs
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (selectedProductId) {
      fetchSteps(selectedProductId);
      const product = products.find((p) => p.id === selectedProductId);
      if (product) {
        setThankYouUrl(product.redirect_url || "");
        setThankYouTitle(product.thank_you_title || "");
        setThankYouMessage(product.thank_you_message || "");
      }
    }
  }, [selectedProductId]);

  const fetchSteps = async (productId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("flow_steps")
        .select("*")
        .eq("payment_link_id", productId)
        .order("step_order", { ascending: true });
      if (error) throw error;
      setSteps((data as FlowStep[]) || []);
    } catch (err) {
      console.error("Failed to fetch flow steps:", err);
    } finally {
      setLoading(false);
    }
  };

  const addStep = async (data: {
    stepType: "upsell" | "downsell";
    productName: string;
    description: string;
    amount: string;
    headline: string;
    subheadline: string;
    pageUrl: string;
    acceptRedirectUrl: string;
    declineRedirectUrl: string;
  }) => {
    if (!selectedProductId) return;
    setSaving(true);
    try {
      const stepOrder = steps.length + 1;
      const { error } = await supabase.from("flow_steps").insert({
        payment_link_id: selectedProductId,
        step_order: stepOrder,
        step_type: data.stepType,
        product_name: data.productName.trim(),
        product_description: data.description.trim() || null,
        amount: parseFloat(data.amount),
        page_headline: data.headline.trim() || null,
        page_subheadline: data.subheadline.trim() || null,
        page_url: data.pageUrl.trim() || null,
        accept_redirect_url: data.acceptRedirectUrl.trim() || null,
        decline_redirect_url: data.declineRedirectUrl.trim() || null,
      } as any);
      if (error) throw error;

      setShowAddDialog(false);
      await fetchSteps(selectedProductId);
      toast({ title: "Etapa adicionada!" });
    } catch (err) {
      console.error("Failed to add step:", err);
      toast({
        title: "Erro",
        description: "Falha ao adicionar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteStep = async (stepId: string) => {
    if (!selectedProductId) return;
    try {
      await supabase
        .from("flow_steps")
        .update({ accept_step_id: null })
        .eq("accept_step_id", stepId);
      await supabase
        .from("flow_steps")
        .update({ decline_step_id: null })
        .eq("decline_step_id", stepId);
      await supabase.from("flow_steps").delete().eq("id", stepId);
      await fetchSteps(selectedProductId);
      toast({ title: "Etapa removida" });
    } catch (err) {
      console.error("Failed to delete step:", err);
    }
  };

  const updateStep = async (stepId: string, updates: Partial<FlowStep>) => {
    try {
      await supabase
        .from("flow_steps")
        .update(updates as any)
        .eq("id", stepId);
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
      );
      setEditingStep((prev) =>
        prev && prev.id === stepId ? { ...prev, ...updates } : prev
      );
    } catch (err) {
      console.error("Failed to update step:", err);
    }
  };

  const saveThankYouConfig = async () => {
    if (!selectedProductId) return;
    setSavingThankYou(true);
    try {
      const { error } = await supabase
        .from("payment_links")
        .update({
          redirect_url: thankYouUrl.trim() || null,
          thank_you_title: thankYouTitle.trim() || null,
          thank_you_message: thankYouMessage.trim() || null,
        })
        .eq("id", selectedProductId);
      if (error) throw error;
      toast({ title: "Página de obrigado salva!" });
    } catch (err) {
      console.error("Failed to save thank you config:", err);
      toast({
        title: "Erro",
        description: "Falha ao salvar",
        variant: "destructive",
      });
    } finally {
      setSavingThankYou(false);
    }
  };

  const copyEmbed = (step: FlowStep) => {
    const baseUrl = window.location.origin;
    const code = `<!-- CashPay ${step.step_type === "upsell" ? "Upsell" : "Downsell"}: ${step.product_name} -->
<div id="cashpay-upsell-${step.id}"></div>
<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var txId = params.get('cashpay_tx') || window.cashpayTxId || '';
  var linkId = params.get('cashpay_link') || window.cashpayLinkId || '';
  var c = document.getElementById('cashpay-upsell-${step.id}');
  var f = document.createElement('iframe');
  f.src = '${baseUrl}/upsell/${step.id}?embed=true&tx=' + txId + '&link=' + linkId;
  f.style.cssText = 'width:100%;border:none;min-height:600px;border-radius:16px;overflow:hidden';
  c.appendChild(f);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'cashpay-resize') f.style.height = e.data.height + 'px';
    if (e.data && e.data.type === 'cashpay-redirect') window.location.href = e.data.url;
  });
})();
</script>`;
    navigator.clipboard.writeText(code);
    toast({
      title: "Código copiado!",
      description: "Cole na sua página de vendas.",
    });
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currency = selectedProduct?.currency || "MZN";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Funil de Vendas
        </h2>
        <p className="text-sm text-muted-foreground">
          Crie etapas de upsell/downsell, copie o código embed e cole nas suas
          páginas externas.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Como funciona
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            {
              step: "1",
              title: "Compra",
              desc: "Cliente compra no checkout do CashPay",
            },
            {
              step: "2",
              title: "Redirecionamento",
              desc: "É redirecionado para a sua página externa",
            },
            {
              step: "3",
              title: "Widget Embed",
              desc: "Na sua página, o widget mostra a oferta",
            },
            {
              step: "4",
              title: "Aceita/Recusa",
              desc: "É redirecionado para o próximo destino",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-2.5"
            >
              <div className="w-6 h-6 rounded-full bg-muted border border-border text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Selector */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Selecione o Produto
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              className={cn(
                "p-4 rounded-xl border text-left transition-all",
                selectedProductId === p.id
                  ? "border-foreground bg-muted/50 shadow-sm"
                  : "border-border hover:border-foreground/30 bg-card"
              )}
            >
              <div className="flex items-center gap-3">
                {p.logo_url ? (
                  <img
                    src={p.logo_url}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {p.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.currency}{" "}
                    {Number(p.amount).toLocaleString(
                      p.currency === "ZAR" ? "en-ZA" : "pt-MZ",
                      { minimumFractionDigits: 2 }
                    )}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Crie um produto primeiro para configurar o funil.
          </p>
        )}
      </div>

      {/* Funnel Builder */}
      {selectedProductId && selectedProduct && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Funil: {selectedProduct.product_name}
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-3">
              {/* Start: Product */}
            <div className="border border-foreground/20 rounded-xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {selectedProduct.logo_url ? (
                    <img
                      src={selectedProduct.logo_url}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                  ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Checkout — Produto Principal
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {selectedProduct.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currency}{" "}
                      {Number(selectedProduct.amount).toLocaleString(
                        currency === "ZAR" ? "en-ZA" : "pt-MZ",
                        { minimumFractionDigits: 2 }
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-muted-foreground/40" />
              </div>

              {/* Steps */}
              {steps.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">Nenhuma etapa de funil criada.</p>
                  <p className="text-xs mt-1">
                    Adicione um upsell ou downsell abaixo.
                  </p>
                </div>
              )}

              {steps.map((step, idx) => (
                <div key={step.id}>
                  {idx > 0 && (
                    <div className="flex justify-center mb-3">
                      <ArrowDown className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <FunnelStepCard
                    step={step}
                    stepIndex={idx}
                    allSteps={steps}
                    currency={currency}
                    onEdit={setEditingStep}
                    onDelete={deleteStep}
                    onCopyEmbed={copyEmbed}
                    onPreview={(stepId) =>
                      window.open(
                        `/upsell/${stepId}?tx=preview&link=${selectedProductId}`,
                        "_blank"
                      )
                    }
                  />
                </div>
              ))}

              {/* Add Step */}
              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-muted-foreground/40" />
              </div>

              <button
                onClick={() => setShowAddDialog(true)}
                className="w-full border border-dashed border-border rounded-xl py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/30 transition-all"
              >
                <Plus className="w-6 h-6" />
                <span className="text-sm font-medium">
                  Adicionar Upsell ou Downsell
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Cada etapa gera um código embed para colar na sua página
                </span>
              </button>

              {/* Arrow to Thank You */}
              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-muted-foreground/40" />
              </div>

              {/* Thank You Page Config */}
              <div className="border border-emerald-200 dark:border-emerald-800 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 flex items-center justify-center">
                    <PartyPopper className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Destino Final
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      Página de Obrigado
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL de Redirecionamento</Label>
                    <div className="relative">
                      <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={thankYouUrl}
                        onChange={(e) => setThankYouUrl(e.target.value)}
                        placeholder="https://seusite.com/acesso"
                        className="h-9 text-sm rounded-lg pl-8"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      O cliente verá um botão "Acessar Conteúdo" que abre esta
                      URL.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Título (opcional)</Label>
                      <Input
                        value={thankYouTitle}
                        onChange={(e) => setThankYouTitle(e.target.value)}
                        placeholder="Obrigado pela compra!"
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mensagem (opcional)</Label>
                      <Input
                        value={thankYouMessage}
                        onChange={(e) => setThankYouMessage(e.target.value)}
                        placeholder="Acesse seu conteúdo abaixo."
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={saveThankYouConfig}
                    disabled={savingThankYou}
                    size="sm"
                    className="rounded-lg text-xs w-full h-9 bg-foreground text-background hover:bg-foreground/90"
                  >
                    {savingThankYou ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1" />
                    )}
                    Salvar Página de Obrigado
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Step Dialog */}
      <FlowStepEditDialog
        open={!!editingStep}
        onOpenChange={(open) => {
          if (!open) setEditingStep(null);
        }}
        step={editingStep}
        steps={steps}
        currency={currency}
        onUpdate={updateStep}
        onDelete={deleteStep}
        onPreview={(stepId) =>
          window.open(
            `/upsell/${stepId}?tx=preview&link=${selectedProductId}`,
            "_blank"
          )
        }
      />

      {/* Add Step Dialog */}
      <FlowAddStepDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        currency={currency}
        saving={saving}
        existingStepCount={steps.length}
        onAdd={addStep}
      />
    </div>
  );
}
