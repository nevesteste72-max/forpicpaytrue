import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, PartyPopper, ExternalLink } from "lucide-react";
import cashpayLogoFull from "@/assets/cashpay-logo-full.png";
import { useUtmifyScript } from "@/hooks/useUtmifyScript";

interface PaymentLinkInfo {
  product_name: string;
  redirect_url: string | null;
  thank_you_title: string | null;
  thank_you_message: string | null;
  thank_you_video_url: string | null;
  currency: string;
  checkout_language: string;
}

export default function ThankYouPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const txId = searchParams.get("tx");

  // UTMify script on thank you page
  useUtmifyScript();

  const [linkInfo, setLinkInfo] = useState<PaymentLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<{ name: string; amount: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, [linkId, txId]);

  const fetchData = async () => {
    try {
      // Fetch payment link info
      if (linkId) {
        const { data: link } = await supabase
          .from("payment_links")
          .select("product_name, redirect_url, thank_you_title, thank_you_message, thank_you_video_url, currency, checkout_language")
          .eq("id", linkId)
          .maybeSingle();

        if (link) setLinkInfo(link);
      }

      // Fetch all transactions related to this purchase (main + upsells)
      if (txId) {
        const { data: mainTx } = await supabase
          .from("transactions")
          .select("amount, payment_links(product_name)")
          .eq("id", txId)
          .maybeSingle();

        const items: { name: string; amount: number }[] = [];

        if (mainTx) {
          items.push({
            name: (mainTx.payment_links as any)?.product_name || "Produto",
            amount: Number(mainTx.amount),
          });
        }

        // Fetch upsell transactions
        const { data: upsellTxs } = await supabase
          .from("transactions")
          .select("amount, flow_steps(product_name)")
          .eq("parent_transaction_id", txId)
          .eq("status", "successful");

        if (upsellTxs) {
          for (const utx of upsellTxs) {
            items.push({
              name: (utx.flow_steps as any)?.product_name || "Upsell",
              amount: Number(utx.amount),
            });
          }
        }

        setPurchases(items);
      }
    } catch (err) {
      console.error("Failed to fetch thank you data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const lang = linkInfo?.checkout_language || "pt";
  const currency = linkInfo?.currency || "ZAR";
  const locale = currency === "ZAR" ? "en-ZA" : "pt-MZ";
  const totalAmount = purchases.reduce((sum, p) => sum + p.amount, 0);

  const title = linkInfo?.thank_you_title || (lang === "en" ? "Thank you for your purchase!" : "Obrigado pela sua compra!");
  const message = linkInfo?.thank_you_message || (lang === "en"
    ? "Your purchase was successful. You will receive an email with all the details."
    : "A sua compra foi realizada com sucesso. Você receberá um email com todos os detalhes.");

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card rounded-3xl shadow-xl shadow-muted-foreground/5 overflow-hidden border border-border">
          {/* Success Header */}
          <div className="bg-success/5 border-b border-success/10 p-8 text-center">
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {/* Video */}
            {linkInfo?.thank_you_video_url && (
              <div className="rounded-xl overflow-hidden">
                <iframe
                  src={linkInfo.thank_you_video_url}
                  className="w-full aspect-video"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              </div>
            )}

            {/* Purchase Summary */}
            {purchases.length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  {lang === "en" ? "Order Summary" : "Resumo do Pedido"}
                </h3>
                {purchases.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <span className="text-foreground">{p.name}</span>
                    </div>
                    <span className="text-muted-foreground font-medium">
                      {currency} {p.amount.toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-3 flex justify-between font-bold text-foreground">
                  <span>Total</span>
                  <span>{currency} {totalAmount.toLocaleString(locale, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {/* Access Content Button */}
            {linkInfo?.redirect_url && (
              <Button
                onClick={() => window.open(linkInfo.redirect_url!, "_blank")}
                className="w-full h-12 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-primary/25"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {lang === "en" ? "Access Content" : "Acessar Conteúdo"}
              </Button>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <img src={cashpayLogoFull} alt="Cashpay" className="h-7 mx-auto opacity-60" />
        </div>
      </div>
    </div>
  );
}
