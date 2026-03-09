import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  Trash2,
  Link as LinkIcon,
  Package,
  Plus,
  Zap,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FlowBuilderDialog } from "./FlowBuilderDialog";
import { EditProductDialog } from "./EditProductDialog";

interface Product {
  id: string;
  product_name: string;
  product_description: string | null;
  logo_url: string | null;
  amount: number;
  is_active: boolean;
  created_at: string;
  order_bump_id: string | null;
  order_bump_name: string | null;
  order_bump_price: number | null;
  currency: string;
  checkout_language: string;
  stripe_payment_methods: string[];
}

interface ProductGridProps {
  products: Product[];
  allProducts: Product[];
  onDelete: (id: string) => void;
  onCreateClick: () => void;
  onProductUpdated?: () => void;
}

export function ProductGrid({ products, allProducts, onDelete, onCreateClick, onProductUpdated }: ProductGridProps) {
  const { toast } = useToast();
  const [flowProductId, setFlowProductId] = useState<string | null>(null);
  const [flowCurrency, setFlowCurrency] = useState("MZN");
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  };

  const hasBump = (p: Product) => !!(p.order_bump_name && p.order_bump_price && p.order_bump_price > 0);

  if (products.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-12 text-center">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
        <h3 className="text-base font-semibold mb-2 text-foreground">
          Nenhum produto ainda
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          Crie o seu primeiro produto e comece a vender via M-Pesa
        </p>
        <Button
          onClick={onCreateClick}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Criar Primeiro Produto
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const showBump = hasBump(product);
        return (
          <div
            key={product.id}
            className="group bg-card rounded-xl border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all duration-200 p-5 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                {product.logo_url ? (
                  <img
                    src={product.logo_url}
                    alt={product.product_name}
                    className="w-11 h-11 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center">
                    <LinkIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  product.currency === "ZAR"
                    ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                    : "bg-primary/5 text-primary border-primary/10"
                }`}>
                  {product.currency === "ZAR" ? "Stripe" : "M-Pesa"}
                </span>
              </div>
              <span className="text-xl font-semibold text-foreground tracking-tight">
                {Number(product.amount).toLocaleString(product.currency === "ZAR" ? "en-ZA" : "pt-MZ")}{" "}
                <span className="text-xs font-normal text-muted-foreground">{product.currency || "MZN"}</span>
              </span>
            </div>

            <h3 className="font-semibold text-foreground text-sm mb-1 truncate">
              {product.product_name}
            </h3>
            {product.product_description && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {product.product_description}
              </p>
            )}

            {showBump && (
              <div className="mt-2 mb-3 px-3 py-2 bg-muted/40 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Order Bump</p>
                <p className="text-xs font-medium text-foreground truncate mt-0.5">
                  {product.order_bump_name} — {Number(product.order_bump_price).toLocaleString(product.currency === "ZAR" ? "en-ZA" : "pt-MZ")} {product.currency || "MZN"}
                </p>
              </div>
            )}

            <div className="flex gap-1.5 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-lg text-xs h-8 border-border"
                onClick={() => copyLink(product.id)}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copiar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 w-8 p-0 border-border"
                title="Editar Produto"
                onClick={() => setEditProduct(product)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 w-8 p-0 border-border"
                title="Fluxo Upsell/Downsell"
                onClick={() => {
                  setFlowProductId(product.id);
                  setFlowCurrency(product.currency || "MZN");
                }}
              >
                <Zap className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg h-8 w-8 p-0 border-border" asChild>
                <a
                  href={`/pay/${product.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(product.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Edit Product Dialog */}
      <EditProductDialog
        open={!!editProduct}
        onOpenChange={(open) => { if (!open) setEditProduct(null); }}
        product={editProduct}
        onSaved={() => onProductUpdated?.()}
      />

      {/* Flow Builder Dialog */}
      <FlowBuilderDialog
        open={!!flowProductId}
        onOpenChange={(open) => { if (!open) setFlowProductId(null); }}
        paymentLinkId={flowProductId || ""}
        currency={flowCurrency}
      />
    </div>
  );
}
