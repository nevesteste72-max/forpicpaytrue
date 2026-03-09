import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProductGrid } from "./ProductGrid";

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

interface ProductsViewProps {
  products: Product[];
  onDelete: (id: string) => void;
  onCreateClick: () => void;
  onProductUpdated?: () => void;
}

export function ProductsView({ products, onDelete, onCreateClick, onProductUpdated }: ProductsViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Produtos</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} produto{products.length !== 1 ? "s" : ""} criado{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={onCreateClick}
          size="sm"
          className="bg-foreground text-background hover:bg-foreground/90 rounded-lg shadow-sm text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo Produto
        </Button>
      </div>

      <ProductGrid
        products={products}
        allProducts={products}
        onDelete={onDelete}
        onCreateClick={onCreateClick}
        onProductUpdated={onProductUpdated}
      />
    </div>
  );
}
