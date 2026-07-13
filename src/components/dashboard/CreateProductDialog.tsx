import { useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ImagePlus, X, ExternalLink, RotateCcw, Package, Gift, Sparkles, BarChart3, Zap, Truck, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  product_name: string;
  amount: number;
}

const STRIPE_METHODS = [
  { value: "card", label: "Card (Visa/Mastercard)" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "google_pay", label: "Google Pay" },
  { value: "link", label: "Link (Stripe)" },
];

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProducts: Product[];
  onCreate: (data: {
    productName: string;
    productDescription: string;
    amount: string;
    imageFile: File | null;
    orderBumpName: string;
    orderBumpDescription: string;
    orderBumpPrice: string;
    orderBump2Name: string;
    orderBump2Description: string;
    orderBump2Price: string;
    orderBump3Name: string;
    orderBump3Description: string;
    orderBump3Price: string;
    redirectUrl: string;
    currency: string;
    checkoutLanguage: string;
    stripePaymentMethods: string[];
    facebookPixelId: string;
    facebookToken: string;
    checkoutBannerFile: File | null;
    checkoutTimerMinutes: string;
    recoveryEnabled: boolean;
    recoveryDiscountPercent: string;
    recoveryHeadline: string;
    recoveryMessage: string;
    recoveryCtaText: string;
    recoveryRedirectUrl: string;
    showTrustBadges: boolean;
    productType: string;
  }) => Promise<void>;
  creating: boolean;
}

export function CreateProductDialog({
  open,
  onOpenChange,
  existingProducts,
  onCreate,
  creating,
}: CreateProductDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [orderBumpName, setOrderBumpName] = useState("");
  const [orderBumpDescription, setOrderBumpDescription] = useState("");
  const [orderBumpPrice, setOrderBumpPrice] = useState("");
  const [orderBump2Name, setOrderBump2Name] = useState("");
  const [orderBump2Description, setOrderBump2Description] = useState("");
  const [orderBump2Price, setOrderBump2Price] = useState("");
  const [orderBump3Name, setOrderBump3Name] = useState("");
  const [orderBump3Description, setOrderBump3Description] = useState("");
  const [orderBump3Price, setOrderBump3Price] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [currency, setCurrency] = useState("MZN");
  const [checkoutLanguage, setCheckoutLanguage] = useState("pt");
  const [stripePaymentMethods, setStripePaymentMethods] = useState<string[]>(["card"]);
  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [facebookToken, setFacebookToken] = useState("");
  const [checkoutBannerFile, setCheckoutBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [checkoutTimerMinutes, setCheckoutTimerMinutes] = useState("");
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [recoveryDiscountPercent, setRecoveryDiscountPercent] = useState("");
  const [recoveryHeadline, setRecoveryHeadline] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryCtaText, setRecoveryCtaText] = useState("");
  const [recoveryRedirectUrl, setRecoveryRedirectUrl] = useState("");
  const [showTrustBadges, setShowTrustBadges] = useState(true);
  const [productType, setProductType] = useState("digital");

  const isStripe = currency === "ZAR" || currency === "USD" || currency === "NGN" || currency === "EUR";

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return;
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return;
      setCheckoutBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const clearBanner = () => {
    setCheckoutBannerFile(null);
    setBannerPreview(null);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setProductName("");
    setProductDescription("");
    setAmount("");
    setOrderBumpName("");
    setOrderBumpDescription("");
    setOrderBumpPrice("");
    setOrderBump2Name("");
    setOrderBump2Description("");
    setOrderBump2Price("");
    setOrderBump3Name("");
    setOrderBump3Description("");
    setOrderBump3Price("");
    setRedirectUrl("");
    setCurrency("MZN");
    setCheckoutLanguage("pt");
    setStripePaymentMethods(["card"]);
    setFacebookPixelId("");
    setFacebookToken("");
    setCheckoutTimerMinutes("");
    setRecoveryEnabled(false);
    setRecoveryDiscountPercent("");
    setRecoveryHeadline("");
    setRecoveryMessage("");
    setRecoveryCtaText("");
    setRecoveryRedirectUrl("");
    setShowTrustBadges(true);
    setProductType("digital");
    clearImage();
    clearBanner();
  };

  const toggleMethod = (method: string) => {
    setStripePaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate({
      productName,
      productDescription,
      amount,
      imageFile,
      orderBumpName: orderBumpName.trim(),
      orderBumpDescription: orderBumpDescription.trim(),
      orderBumpPrice: orderBumpPrice.trim(),
      orderBump2Name: orderBump2Name.trim(),
      orderBump2Description: orderBump2Description.trim(),
      orderBump2Price: orderBump2Price.trim(),
      orderBump3Name: orderBump3Name.trim(),
      orderBump3Description: orderBump3Description.trim(),
      orderBump3Price: orderBump3Price.trim(),
      redirectUrl,
      currency,
      checkoutLanguage,
      stripePaymentMethods: isStripe ? stripePaymentMethods : [],
      facebookPixelId: facebookPixelId.trim(),
      facebookToken: facebookToken.trim(),
      checkoutBannerFile,
      checkoutTimerMinutes: checkoutTimerMinutes.trim(),
      recoveryEnabled,
      recoveryDiscountPercent: recoveryDiscountPercent.trim(),
      recoveryHeadline: recoveryHeadline.trim(),
      recoveryMessage: recoveryMessage.trim(),
      recoveryCtaText: recoveryCtaText.trim(),
      recoveryRedirectUrl: recoveryRedirectUrl.trim(),
      showTrustBadges,
      productType,
    });
    resetForm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4">
          <Tabs defaultValue="produto" className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-auto p-1">
              <TabsTrigger value="produto" className="flex flex-col gap-1 py-2 text-[11px]">
                <Package className="w-4 h-4" />
                Produto
              </TabsTrigger>
              <TabsTrigger value="bumps" className="flex flex-col gap-1 py-2 text-[11px]">
                <Gift className="w-4 h-4" />
                Bumps
              </TabsTrigger>
              <TabsTrigger value="checkout" className="flex flex-col gap-1 py-2 text-[11px]">
                <Sparkles className="w-4 h-4" />
                Checkout
              </TabsTrigger>
              <TabsTrigger value="rastreio" className="flex flex-col gap-1 py-2 text-[11px]">
                <BarChart3 className="w-4 h-4" />
                Rastreio
              </TabsTrigger>
            </TabsList>

            {/* ABA: PRODUTO — identidade, preço, idioma, pagamento */}
            <TabsContent value="produto" className="space-y-4 mt-4">
              {/* Currency Selector */}
              <div className="space-y-2">
                <Label>Moeda</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency("MZN");
                      setCheckoutLanguage("pt");
                    }}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold",
                      currency === "MZN"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇲🇿 MZN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency("ZAR");
                      setCheckoutLanguage("en");
                    }}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold",
                      currency === "ZAR"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇿🇦 ZAR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency("USD");
                      setCheckoutLanguage("en");
                    }}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold",
                      currency === "USD"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇺🇸 USD
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency("NGN");
                      setCheckoutLanguage("en");
                    }}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold",
                      currency === "NGN"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇳🇬 NGN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency("EUR");
                      setCheckoutLanguage("pt");
                    }}
                    className={cn(
                      "p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold",
                      currency === "EUR"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇪🇺 EUR
                  </button>
                </div>
              </div>

              {/* Product Type */}
              <div className="space-y-2">
                <Label>Tipo de Produto</Label>
                <p className="text-xs text-muted-foreground">
                  Define o e-mail enviado ao cliente após o pagamento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProductType("digital")}
                    className={cn(
                      "p-3 rounded-xl border-2 flex flex-col items-center gap-1 text-center transition-all text-sm font-semibold",
                      productType === "digital"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    Digital
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductType("physical")}
                    className={cn(
                      "p-3 rounded-xl border-2 flex flex-col items-center gap-1 text-center transition-all text-sm font-semibold",
                      productType === "physical"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Truck className="w-4 h-4" />
                    Físico
                  </button>
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Imagem (opcional)</Label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-xl object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <ImagePlus className="w-6 h-6 mb-1" />
                      <span className="text-xs">Adicionar</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou WebP
                    <br />
                    Máximo 2MB
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productName">Nome do Produto</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Curso de Marketing"
                  required
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Descrição breve do produto..."
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Preço ({currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="h-12 rounded-xl"
                />
              </div>

              {/* Checkout Language */}
              <div className="space-y-2">
                <Label>Idioma do Checkout</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutLanguage("pt")}
                    className={cn(
                      "p-2.5 rounded-xl border-2 text-center transition-all text-sm font-medium",
                      checkoutLanguage === "pt"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇵🇹 Português
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutLanguage("en")}
                    className={cn(
                      "p-2.5 rounded-xl border-2 text-center transition-all text-sm font-medium",
                      checkoutLanguage === "en"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutLanguage("es")}
                    className={cn(
                      "p-2.5 rounded-xl border-2 text-center transition-all text-sm font-medium",
                      checkoutLanguage === "es"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🇪🇸 Español
                  </button>
                </div>
              </div>

              {/* Stripe Payment Methods (only for ZAR) */}
              {isStripe && (
                <div className="space-y-2">
                  <Label>Métodos de Pagamento (Stripe)</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione os métodos que aparecerão no checkout
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {STRIPE_METHODS.map((m) => (
                      <button
                        type="button"
                        key={m.value}
                        onClick={() => toggleMethod(m.value)}
                        className={cn(
                          "p-2.5 rounded-xl border-2 text-left transition-all text-xs font-medium",
                          stripePaymentMethods.includes(m.value)
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {stripePaymentMethods.length === 0 && (
                    <p className="text-xs text-destructive">Selecione pelo menos um método</p>
                  )}
                </div>
              )}

              {/* Redirect URL */}
              <div className="space-y-2">
                <Label htmlFor="redirectUrl" className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Link de Redirecionamento (opcional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  O cliente será redirecionado para este link após o pagamento ser aprovado
                </p>
                <Input
                  id="redirectUrl"
                  type="url"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://exemplo.com/obrigado"
                  className="h-12 rounded-xl"
                />
              </div>
            </TabsContent>

            {/* ABA: BUMPS — ofertas extras no checkout */}
            <TabsContent value="bumps" className="mt-4">
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Label className="text-sm font-semibold">Order Bumps (opcional, até 3)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adicione produtos extras sugeridos no checkout para aumentar o ticket médio
                </p>
                {[
                  { label: "Order Bump 1", name: orderBumpName, setName: setOrderBumpName, desc: orderBumpDescription, setDesc: setOrderBumpDescription, price: orderBumpPrice, setPrice: setOrderBumpPrice },
                  { label: "Order Bump 2", name: orderBump2Name, setName: setOrderBump2Name, desc: orderBump2Description, setDesc: setOrderBump2Description, price: orderBump2Price, setPrice: setOrderBump2Price },
                  { label: "Order Bump 3", name: orderBump3Name, setName: setOrderBump3Name, desc: orderBump3Description, setDesc: setOrderBump3Description, price: orderBump3Price, setPrice: setOrderBump3Price },
                ].map((bump, idx) => (
                  <div key={idx} className="space-y-2 pt-3 border-t border-border first:border-t-0 first:pt-0">
                    <Label className="text-xs font-semibold text-muted-foreground">{bump.label}</Label>
                    <Input value={bump.name} onChange={(e) => bump.setName(e.target.value)} placeholder="Nome" className="h-10 rounded-lg text-sm" />
                    <Input value={bump.desc} onChange={(e) => bump.setDesc(e.target.value)} placeholder="Descrição" className="h-10 rounded-lg text-sm" />
                    <Input type="number" min="0" step="0.01" value={bump.price} onChange={(e) => bump.setPrice(e.target.value)} placeholder={`Preço (${currency})`} className="h-10 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ABA: CHECKOUT — aparência e recuperação de vendas */}
            <TabsContent value="checkout" className="space-y-4 mt-4">
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <ImagePlus className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Aparencia do Checkout (opcional)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Personalize a pagina de pagamento com banner e contagem regressiva
                </p>

                {/* Banner Upload */}
                <div className="space-y-2">
                  <Label className="text-xs">Banner</Label>
                  <div className="flex items-center gap-4">
                    {bannerPreview ? (
                      <div className="relative w-full">
                        <img
                          src={bannerPreview}
                          alt="Banner preview"
                          className="w-full h-24 rounded-lg object-cover border-2 border-border"
                        />
                        <button
                          type="button"
                          onClick={clearBanner}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="w-full h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <ImagePlus className="w-5 h-5 mb-1" />
                        <span className="text-xs">Adicionar Banner</span>
                      </button>
                    )}
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBannerSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Timer */}
                <div className="space-y-2">
                  <Label htmlFor="timerMinutes" className="text-xs">Contagem Regressiva (minutos)</Label>
                  <Input
                    id="timerMinutes"
                    type="number"
                    min="0"
                    max="1440"
                    value={checkoutTimerMinutes}
                    onChange={(e) => setCheckoutTimerMinutes(e.target.value)}
                    placeholder="Ex: 15"
                    className="h-10 rounded-lg text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio para desativar</p>
                </div>

                {/* Trust Badges Toggle */}
                <div className="space-y-2 pt-3 border-t border-border">
                  <Label className="text-xs">Selos de Confiança</Label>
                  <p className="text-xs text-muted-foreground">Mostrar selos de privacidade, segurança e entrega no checkout</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTrustBadges(!showTrustBadges)}
                      className={cn(
                        "w-10 h-6 rounded-full transition-colors relative",
                        showTrustBadges ? "bg-[hsl(145,60%,40%)]" : "bg-border"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                        showTrustBadges ? "translate-x-4" : "translate-x-0.5"
                      )} />
                    </button>
                    <span className="text-sm text-foreground">{showTrustBadges ? "Ativado" : "Desativado"}</span>
                  </div>
                </div>
              </div>

              {/* Recovery / Sales Recovery */}
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw className="w-4 h-4 text-[hsl(145,60%,40%)]" />
                  <Label className="text-sm font-semibold">Recuperação de Vendas</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Popup inteligente ativado ao tentar sair da página ou quando o pagamento falha
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRecoveryEnabled(!recoveryEnabled)}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      recoveryEnabled ? "bg-[hsl(145,60%,40%)]" : "bg-border"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                      recoveryEnabled ? "translate-x-4" : "translate-x-0.5"
                    )} />
                  </button>
                  <span className="text-sm text-foreground">{recoveryEnabled ? "Ativado" : "Desativado"}</span>
                </div>
                {recoveryEnabled && (
                  <div className="space-y-3 mt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Desconto (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="90"
                        value={recoveryDiscountPercent}
                        onChange={(e) => setRecoveryDiscountPercent(e.target.value)}
                        placeholder="Ex: 20"
                        className="h-10 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Título (opcional)</Label>
                      <Input
                        value={recoveryHeadline}
                        onChange={(e) => setRecoveryHeadline(e.target.value)}
                        placeholder="Ex: Espere um momento!"
                        className="h-10 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Mensagem (opcional)</Label>
                      <Textarea
                        value={recoveryMessage}
                        onChange={(e) => setRecoveryMessage(e.target.value)}
                        placeholder="Mensagem personalizada para recuperar a venda..."
                        className="rounded-lg text-sm resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Texto do Botão (opcional)</Label>
                      <Input
                        value={recoveryCtaText}
                        onChange={(e) => setRecoveryCtaText(e.target.value)}
                        placeholder="Ex: Aproveitar oferta agora"
                        className="h-10 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Link do Desconto (URL)</Label>
                      <Input
                        type="url"
                        value={recoveryRedirectUrl}
                        onChange={(e) => setRecoveryRedirectUrl(e.target.value)}
                        placeholder="https://cashpaysa.lovable.app/checkout/..."
                        className="h-10 rounded-lg text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Link de pagamento com o preço reduzido (crie outro produto com o valor descontado)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ABA: RASTREIO — Facebook Pixel/API + UTMify */}
            <TabsContent value="rastreio" className="space-y-4 mt-4">
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[hsl(220,80%,50%)]" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <Label className="text-sm font-semibold">Facebook Pixel & API</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adicione o Pixel ID e Token de Conversão para rastrear vendas deste produto no Facebook/Meta Ads
                </p>
                <div className="space-y-2">
                  <Label htmlFor="fbPixelId" className="text-xs">Pixel ID</Label>
                  <Input
                    id="fbPixelId"
                    value={facebookPixelId}
                    onChange={(e) => setFacebookPixelId(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex: 123456789012345"
                    className="h-10 rounded-lg font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fbToken" className="text-xs">Token de Conversão (Conversions API)</Label>
                  <Input
                    id="fbToken"
                    type="password"
                    value={facebookToken}
                    onChange={(e) => setFacebookToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                    className="h-10 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-[hsl(45,90%,45%)]" />
                  <Label className="text-sm font-semibold">UTMify</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  O rastreamento de UTMs (origem, campanha, mídia) já é feito automaticamente para
                  todos os produtos da conta — não precisa configurar nada aqui. Cada venda deste
                  produto é enviada ao UTMify com o nome e o valor corretos assim que é aprovada.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            type="submit"
            disabled={creating || (isStripe && stripePaymentMethods.length === 0)}
            className="w-full h-12 rounded-xl gradient-primary text-white mt-4"
          >
            {creating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Criar Produto"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
