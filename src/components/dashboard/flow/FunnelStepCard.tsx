import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit2,
  Trash2,
  Copy,
  Code,
  Zap,
  Gift,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowStep } from "./FlowStepEditDialog";

interface FunnelStepCardProps {
  step: FlowStep;
  stepIndex: number;
  allSteps: FlowStep[];
  currency: string;
  onEdit: (step: FlowStep) => void;
  onDelete: (stepId: string) => void;
  onCopyEmbed: (step: FlowStep) => void;
  onPreview: (stepId: string) => void;
}

export function FunnelStepCard({
  step,
  stepIndex,
  allSteps,
  currency,
  onEdit,
  onDelete,
  onCopyEmbed,
  onPreview,
}: FunnelStepCardProps) {
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);
  const locale = currency === "ZAR" ? "en-ZA" : "pt-MZ";
  const isUpsell = step.step_type === "upsell";

  const getDestinationLabel = (
    stepId: string | null,
    redirectUrl: string | null
  ) => {
    if (redirectUrl) return redirectUrl;
    if (stepId) {
      const target = allSteps.find((s) => s.id === stepId);
      return target
        ? `${target.step_type === "upsell" ? "Upsell" : "Downsell"} #${allSteps.indexOf(target) + 1}: ${target.product_name}`
        : "Etapa removida";
    }
    return "Página de Obrigado";
  };

  const getAcceptIsUrl = !!step.accept_redirect_url;
  const getDeclineIsUrl = !!step.decline_redirect_url;

  const handleCopyEmbed = () => {
    onCopyEmbed(step);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseUrl = window.location.origin;
  const embedCode = `<!-- PicPay ${isUpsell ? "Upsell" : "Downsell"}: ${step.product_name} -->
<div id="cashpay-upsell-${step.id}"></div>
<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var txId = params.get('cashpay_tx') || window.cashpayTxId || '';
  var linkId = params.get('cashpay_link') || window.cashpayLinkId || '';
  var c = document.getElementById('cashpay-upsell-${step.id}');
  var f = document.createElement('iframe');
  f.src = '${baseUrl}/upsell/${step.id}?embed=true&tx=' + txId + '&link=' + linkId;
  f.style.cssText = 'width:100%;border:none;max-width:480px;margin:0 auto;display:block;border-radius:12px;overflow:hidden';
  c.appendChild(f);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'cashpay-resize' && e.data.height) f.style.height = e.data.height + 'px';
    if (e.data && e.data.type === 'cashpay-redirect' && e.data.url) window.location.href = e.data.url;
  });
})();
</script>`;

  return (
    <div
      className={cn(
        "border-2 rounded-2xl bg-card overflow-hidden transition-all",
        isUpsell ? "border-primary/20" : "border-blue-500/20"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isUpsell ? "bg-primary/10" : "bg-blue-500/10"
            )}
          >
            {isUpsell ? (
              <Zap className="w-4 h-4 text-primary" />
            ) : (
              <Gift className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[9px] font-bold uppercase px-1.5 py-0",
                  isUpsell
                    ? "bg-primary/10 text-primary"
                    : "bg-blue-500/10 text-blue-600"
                )}
              >
                {step.step_type} #{stepIndex + 1}
              </Badge>
              <span className="text-sm font-bold text-foreground">
                {step.product_name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {currency}{" "}
              {Number(step.amount).toLocaleString(locale, {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onPreview(step.id)}
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(step)}
            title="Editar"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(step.id)}
            title="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Page URL */}
        {step.page_url && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
              Pagina Externa
            </p>
            <p className="text-xs text-foreground font-medium truncate flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
              {step.page_url}
            </p>
          </div>
        )}

        {/* Destinations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Accept */}
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1.5">
              Aceita - vai para
            </p>
            <p className="text-xs text-foreground font-medium truncate flex items-center gap-1.5">
              {getAcceptIsUrl && (
                <ExternalLink className="w-3 h-3 text-emerald-500 shrink-0" />
              )}
              {getDestinationLabel(
                step.accept_step_id,
                step.accept_redirect_url
              )}
            </p>
          </div>

          {/* Decline */}
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 p-3">
            <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase mb-1.5">
              Recusa - vai para
            </p>
            <p className="text-xs text-foreground font-medium truncate flex items-center gap-1.5">
              {getDeclineIsUrl && (
                <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0" />
              )}
              {getDestinationLabel(
                step.decline_step_id,
                step.decline_redirect_url
              )}
            </p>
          </div>
        </div>

        {/* Embed Code Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCopyEmbed}
              size="sm"
              className={cn(
                "flex-1 rounded-xl h-10 text-xs font-bold transition-all",
                copied
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "gradient-primary text-white"
              )}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Code className="w-4 h-4 mr-1.5" />
                  Copiar Código Embed
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl text-xs"
              onClick={() => setShowEmbed(!showEmbed)}
            >
              {showEmbed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>

          {showEmbed && (
            <pre className="text-[10px] bg-muted rounded-xl p-4 overflow-x-auto border border-border text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap break-all max-h-[200px]">
              {embedCode}
            </pre>
          )}

          <p className="text-[10px] text-muted-foreground">
            Cole este código na sua página externa. Defina{" "}
            <code className="bg-muted px-1 rounded font-mono">
              window.cashpayTxId
            </code>{" "}
            e{" "}
            <code className="bg-muted px-1 rounded font-mono">
              window.cashpayLinkId
            </code>{" "}
            com os valores da transação.
          </p>
        </div>
      </div>
    </div>
  );
}
