import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ProductsView } from "@/components/dashboard/ProductsView";
import { CreateProductDialog } from "@/components/dashboard/CreateProductDialog";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { TransactionsView } from "@/components/dashboard/TransactionsView";
import { ClientsView } from "@/components/dashboard/ClientsView";
import { WithdrawalsView } from "@/components/dashboard/WithdrawalsView";
import { FlowsView } from "@/components/dashboard/FlowsView";
import { WhatsAppView } from "@/components/dashboard/WhatsAppView";
import { RefundsView } from "@/components/dashboard/RefundsView";
import { DashboardDateFilter, getDateRange, type DateFilterOption } from "@/components/dashboard/DashboardDateFilter";
import { useSaleNotifications } from "@/hooks/useSaleNotifications";
import {
  Home,
  ShoppingBag,
  CreditCard,
  Users,
  LogOut,
  Plus,
  Loader2,
  Menu,
  Wallet,
  X,
  Zap,
  Search,
  Bell,
  HelpCircle,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import cashpayIcon from "@/assets/picpay-logo.jpeg";

type DashboardTab = "overview" | "products" | "flows" | "transactions" | "clients" | "withdrawals" | "whatsapp" | "refunds";

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
  order_bump_description: string | null;
  order_bump_price: number | null;
  currency: string;
  checkout_language: string;
  stripe_payment_methods: string[];
  redirect_url: string | null;
  thank_you_title: string | null;
  thank_you_message: string | null;
  thank_you_video_url: string | null;
}

interface Transaction {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  status: string;
  created_at: string;
  payment_link_id: string;
  order_bump_accepted: boolean;
  order_bump_amount: number | null;
  currency: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  phone_number: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const platformLinks: { icon: typeof Home; label: string; tab: DashboardTab }[] = [
  { icon: Home, label: "Dashboard", tab: "overview" },
  { icon: ShoppingBag, label: "Produtos", tab: "products" },
  { icon: CreditCard, label: "Transações", tab: "transactions" },
  { icon: Users, label: "Clientes", tab: "clients" },
];

const financeLinks: { icon: typeof Wallet; label: string; tab: DashboardTab }[] = [
  { icon: Wallet, label: "Saldo & Saques", tab: "withdrawals" },
  { icon: Zap, label: "Funil de Vendas", tab: "flows" },
  { icon: MessageSquare, label: "WhatsApp", tab: "whatsapp" },
  { icon: RotateCcw, label: "Reembolsos", tab: "refunds" },
];

export default function Dashboard() {
  const { user, loading: authLoading, signOut, isAdmin } = useAuth();
  const { toast } = useToast();
  useSaleNotifications(user?.id);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");
  const [currencyView, setCurrencyView] = useState<"MZN" | "ZAR" | "USD">("MZN");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchAllTransactions = async () => {
    const all: Transaction[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const fetchData = async () => {
    try {
      const [productsRes, allTx, withdrawalsRes] = await Promise.all([
        supabase
          .from("payment_links")
          .select("*")
          .order("created_at", { ascending: false }),
        fetchAllTransactions(),
        supabase
          .from("withdrawals")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      setTransactions(allTx);
      if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    const range = getDateRange(dateFilter, customRange);
    return transactions.filter((t) => {
      const txDate = new Date(t.created_at);
      return txDate >= range.from && txDate <= range.to;
    });
  }, [transactions, dateFilter, customRange]);

  const completedTx = filteredTransactions.filter(
    (t) => t.status === "completed" || t.status === "success" || t.status === "successful"
  );

  const completedMZN = completedTx.filter((t) => (t.currency || "MZN") === "MZN");
  const completedZAR = completedTx.filter((t) => t.currency === "ZAR");
  const completedUSD = completedTx.filter((t) => t.currency === "USD");

  const calcRevenue = (txs: Transaction[]) =>
    txs.reduce((sum, t) => sum + Number(t.amount) + (t.order_bump_accepted ? Number(t.order_bump_amount || 0) : 0), 0);

  const revenueMZN = calcRevenue(completedMZN);
  const revenueZAR = calcRevenue(completedZAR);
  const revenueUSD = calcRevenue(completedUSD);
  const totalOrders = completedTx.length;
  const pendingOrders = filteredTransactions.filter((t) => t.status === "pending").length;
  const conversionRate =
    filteredTransactions.length > 0 ? (completedTx.length / filteredTransactions.length) * 100 : 0;

  const getChartData = () => {
    const range = getDateRange(dateFilter, customRange);
    const from = range.from;
    const to = range.to;
    const diffMs = to.getTime() - from.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // For "all" or large ranges, group by month
    if (days > 90) {
      const monthMap = new Map<string, { revenueMZN: number; revenueZAR: number; revenueUSD: number; orders: number }>();
      for (const t of completedTx) {
        const d = new Date(t.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthMap.get(key) || { revenueMZN: 0, revenueZAR: 0, revenueUSD: 0, orders: 0 };
        const amt = Number(t.amount) + (t.order_bump_accepted ? Number(t.order_bump_amount || 0) : 0);
        if (t.currency === "ZAR") entry.revenueZAR += amt;
        else if (t.currency === "USD") entry.revenueUSD += amt;
        else entry.revenueMZN += amt;
        entry.orders += 1;
        monthMap.set(key, entry);
      }
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
          const [y, m] = key.split("-");
          const d = new Date(Number(y), Number(m) - 1);
          return {
            date: d.toLocaleDateString("pt-MZ", { month: "short", year: "2-digit" }),
            ...val,
          };
        });
    }

    const data = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(from);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      const dayTx = completedTx.filter(
        (t) => t.created_at.split("T")[0] === dateStr
      );
      const revenueMZNDay = calcRevenue(dayTx.filter((t) => (t.currency || "MZN") === "MZN"));
      const revenueZARDay = calcRevenue(dayTx.filter((t) => t.currency === "ZAR"));
      const revenueUSDDay = calcRevenue(dayTx.filter((t) => t.currency === "USD"));

      data.push({
        date:
          days <= 7
            ? date.toLocaleDateString("pt-MZ", { weekday: "short" })
            : date.toLocaleDateString("pt-MZ", { day: "2-digit", month: "short" }),
        revenueMZN: revenueMZNDay,
        revenueZAR: revenueZARDay,
        revenueUSD: revenueUSDDay,
        orders: dayTx.length,
      });
    }

    return data;
  };

  const enrichedTransactions = transactions.map((tx) => {
    const product = products.find((p) => p.id === tx.payment_link_id);
    return { ...tx, product_name: product?.product_name };
  });

  const uploadImage = async (linkId: string, imageFile: File): Promise<string | null> => {
    if (!user) return null;
    const fileExt = imageFile.name.split(".").pop();
    const filePath = `${user.id}/${linkId}.${fileExt}`;

    const { error } = await supabase.storage
      .from("payment-images")
      .upload(filePath, imageFile, { upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from("payment-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleCreateProduct = async (data: {
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
    isDonation: boolean;
    donationAmounts: string;
    donationGoalEnabled: boolean;
    donationGoalAmount: string;
    donationStoryTitle: string;
    donationStoryText: string;
    donationStoryImageFile: File | null;
    donationStoryVideoUrl: string;
    donationCtaText: string;
    donationAllowAnonymous: boolean;
    donationSocialProofEnabled: boolean;
    donationTestimonials: Array<{ name: string; city: string; text: string; imageFile: File | null }>;
  }) => {
    if (!user) return;
    setCreating(true);

    try {
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        product_name: data.productName,
        product_description: data.productDescription || null,
        amount: parseFloat(data.amount),
        order_bump_name: data.orderBumpName || null,
        order_bump_description: data.orderBumpDescription || null,
        order_bump_price: data.orderBumpPrice ? parseFloat(data.orderBumpPrice) : null,
        order_bump_2_name: data.orderBump2Name || null,
        order_bump_2_description: data.orderBump2Description || null,
        order_bump_2_price: data.orderBump2Price ? parseFloat(data.orderBump2Price) : null,
        order_bump_3_name: data.orderBump3Name || null,
        order_bump_3_description: data.orderBump3Description || null,
        order_bump_3_price: data.orderBump3Price ? parseFloat(data.orderBump3Price) : null,
        redirect_url: data.redirectUrl || null,
        currency: data.currency,
        checkout_language: data.checkoutLanguage,
        stripe_payment_methods: data.stripePaymentMethods.length > 0 ? data.stripePaymentMethods : ["card"],
        facebook_pixel_id: data.facebookPixelId || null,
        facebook_token: data.facebookToken || null,
        checkout_timer_minutes: data.checkoutTimerMinutes ? parseInt(data.checkoutTimerMinutes) : 0,
        recovery_enabled: data.recoveryEnabled || false,
        recovery_discount_percent: data.recoveryDiscountPercent ? parseInt(data.recoveryDiscountPercent) : 0,
        recovery_headline: data.recoveryHeadline || null,
        recovery_message: data.recoveryMessage || null,
        recovery_cta_text: data.recoveryCtaText || null,
        recovery_redirect_url: data.recoveryRedirectUrl || null,
        show_trust_badges: data.showTrustBadges,
        is_donation: data.isDonation,
        donation_amounts: data.isDonation
          ? data.donationAmounts
              .split(",")
              .map((s) => parseFloat(s.trim()))
              .filter((n) => !isNaN(n) && n > 0)
          : [],
        donation_goal_enabled: data.donationGoalEnabled,
        donation_goal_amount: data.donationGoalAmount ? parseFloat(data.donationGoalAmount) : null,
        donation_story_title: data.donationStoryTitle || null,
        donation_story_text: data.donationStoryText || null,
        donation_story_video_url: data.donationStoryVideoUrl || null,
        donation_cta_text: data.donationCtaText || null,
        donation_allow_anonymous: data.donationAllowAnonymous,
        donation_social_proof_enabled: data.donationSocialProofEnabled,
      };

      const { data: newProduct, error } = await supabase
        .from("payment_links")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      if (newProduct) {
        // Upload product image
        if (data.imageFile) {
          const imageUrl = await uploadImage(newProduct.id, data.imageFile);
          if (imageUrl) {
            await supabase
              .from("payment_links")
              .update({ logo_url: imageUrl })
              .eq("id", newProduct.id);
          }
        }

        // Upload checkout banner
        if (data.checkoutBannerFile) {
          const bannerUrl = await uploadImage(`${newProduct.id}-banner`, data.checkoutBannerFile);
          if (bannerUrl) {
            await supabase
              .from("payment_links")
              .update({ checkout_banner_url: bannerUrl })
              .eq("id", newProduct.id);
          }
        }
      }

      toast({ title: "Produto criado!", description: "O link de pagamento está pronto." });
      setDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao criar produto";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase.from("payment_links").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Produto eliminado" });
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao eliminar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-foreground">Acesso Restrito</h1>
          <p className="text-muted-foreground">Não tem permissão para aceder ao painel.</p>
          <Button onClick={signOut} variant="outline">Sair</Button>
        </div>
      </div>
    );
  }

  const businessName = user?.user_metadata?.business_name || "Minha Loja";

  const handleTabClick = (tab: DashboardTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const tabTitles: Record<DashboardTab, string> = {
    overview: "Visão Geral",
    products: "Produtos",
    flows: "Funil de Vendas",
    transactions: "Transações",
    clients: "Clientes",
    withdrawals: "Saldo & Saques",
    whatsapp: "WhatsApp",
    refunds: "Reembolsos",
  };

  const tabDescriptions: Record<DashboardTab, string> = {
    overview: "Acompanhe métricas em tempo real.",
    products: "Gerencie os seus produtos e links de pagamento.",
    flows: "Crie etapas de upsell e downsell.",
    transactions: "Histórico completo de pagamentos.",
    clients: "Base de clientes registados.",
    withdrawals: "Solicite a transferência do seu saldo.",
    whatsapp: "Automatize entrega, recuperação e suporte via WhatsApp.",
    refunds: "Gerencie pedidos de reembolso dos clientes.",
  };

  const pendingTxRevenue = transactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const renderNavItem = (link: { icon: typeof Home; label: string; tab: DashboardTab }, transactionCount?: number) => {
    const Icon = link.icon;
    const isActive = activeTab === link.tab;
    return (
      <button
        key={link.tab}
        onClick={() => handleTabClick(link.tab)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all w-full text-left group relative overflow-hidden",
          isActive
            ? "text-white bg-sidebar-accent border border-sidebar-border shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
            : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent/50"
        )}
      >
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
        )}
        <Icon className={cn("w-[18px] h-[18px] relative z-10", isActive && "text-white")} />
        <span className="relative z-10">{link.label}</span>
        {transactionCount !== undefined && transactionCount > 0 && (
          <span className="ml-auto text-[10px] font-medium bg-sidebar-accent text-sidebar-foreground px-1.5 py-0.5 rounded-full border border-sidebar-border relative z-10">
            {transactionCount}
          </span>
        )}
      </button>
    );
  };

  const renderSidebarContent = () => (
    <>
      <nav className="px-4 space-y-0.5 mt-2">
        <p className="px-3 text-[10px] font-medium text-sidebar-foreground/40 mb-2 mt-4 uppercase tracking-wider">
          Plataforma
        </p>
        {platformLinks.map((link) => renderNavItem(
          link,
          link.tab === "transactions" ? filteredTransactions.length : undefined
        ))}

        <p className="px-3 text-[10px] font-medium text-sidebar-foreground/40 mb-2 mt-6 uppercase tracking-wider">
          Finanças
        </p>
        {financeLinks.map((link) => renderNavItem(link))}
      </nav>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return (
          <ProductsView
            products={products}
            onDelete={deleteProduct}
            onCreateClick={() => setDialogOpen(true)}
            onProductUpdated={fetchData}
          />
        );
      case "flows":
        return <FlowsView products={products} />;
      case "whatsapp":
        return <WhatsAppView />;
      case "refunds":
        return <RefundsView />;
      case "transactions":
        return <TransactionsView transactions={enrichedTransactions} />;
      case "clients":
        return <ClientsView transactions={transactions} />;
      case "withdrawals":
        return (
          <WithdrawalsView
            availableBalance={revenueMZN}
            pendingBalance={pendingTxRevenue}
            withdrawals={withdrawals}
            onWithdrawalCreated={fetchData}
          />
        );
      default:
        return (
          <div className="space-y-6 md:space-y-8">
            {/* Mobile date filter */}
            <div className="md:hidden">
              <DashboardDateFilter
                selected={dateFilter}
                onFilterChange={setDateFilter}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
            </div>
            <StatsCards
              revenueMZN={revenueMZN}
              revenueZAR={revenueZAR}
              revenueUSD={revenueUSD}
              totalOrders={totalOrders}
              pendingOrders={pendingOrders}
              conversionRate={conversionRate}
              currencyView={currencyView}
              onCurrencyViewChange={setCurrencyView}
            />
            {/* Chart + Activity Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="lg:col-span-2">
                <RevenueChart
                  data={getChartData()}
                  currencyView={currencyView}
                />
              </div>
              <div className="lg:col-span-1">
                <RecentTransactions transactions={enrichedTransactions.slice(0, 8)} />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen h-screen bg-background flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="w-72 bg-sidebar hidden md:flex flex-col shrink-0 border-r border-sidebar-border relative z-20">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 text-white">
            <img src={cashpayIcon} alt="PicPay" className="w-6 h-6 rounded" />
            <span className="font-semibold tracking-tight text-sm">PicPay</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sidebar-accent text-sidebar-foreground border border-sidebar-border ml-auto">
              PRO
            </span>
          </div>
        </div>

        {/* Team Switcher */}
        <div className="p-4">
          <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border text-left">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sidebar-foreground/30 to-sidebar-foreground/20 flex items-center justify-center text-white text-xs font-medium ring-2 ring-sidebar-background">
              {businessName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{businessName}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">Empresa</p>
            </div>
          </div>
        </div>

        {renderSidebarContent()}

        {/* Bottom */}
        <div className="mt-auto p-4 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground/50 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar flex flex-col animate-slide-in-right shadow-2xl">
            <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5 text-white">
                <img src={cashpayIcon} alt="PicPay" className="w-6 h-6 rounded" />
                <span className="font-semibold tracking-tight text-sm">PicPay</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50 border border-sidebar-border text-left">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sidebar-foreground/30 to-sidebar-foreground/20 flex items-center justify-center text-white text-xs font-medium ring-2 ring-sidebar-background">
                  {businessName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{businessName}</p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate">Empresa</p>
                </div>
              </div>
            </div>

            {renderSidebarContent()}

            <div className="mt-auto p-4 border-t border-sidebar-border">
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground/50 hover:text-white transition-colors w-full"
              >
                <LogOut className="w-[18px] h-[18px]" />
                Sair da conta
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative subtle-grid min-w-0 overflow-hidden">
        {/* Desktop Glass Header */}
        <header className="hidden md:flex h-16 glass-panel border-b border-border/60 sticky top-0 z-10 items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Buscar transações, clientes..."
                className="w-full bg-card/50 border-border rounded-lg pl-10 pr-4 py-1.5 text-sm h-9 focus:ring-2 focus:ring-ring/5 focus:border-border"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "overview" && (
              <DashboardDateFilter
                selected={dateFilter}
                onFilterChange={setDateFilter}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
            )}
            <Button
              onClick={() => setDialogOpen(true)}
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 rounded-lg shadow-sm text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Produto
            </Button>
          </div>
        </header>

        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-20 glass-panel border-b border-border/60 px-4 py-3 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src={cashpayIcon} alt="PicPay" className="w-8 h-8 rounded-lg" />
              <div>
                <h1 className="text-sm font-bold text-foreground leading-tight">
                  {tabTitles[activeTab]}
                </h1>
                <p className="text-[11px] text-muted-foreground leading-tight">{businessName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setDialogOpen(true)}
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-5 h-5" />
              </Button>
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            {/* Page Header (desktop only) */}
            <div className="hidden md:flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {tabTitles[activeTab]}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{tabDescriptions[activeTab]}</p>
              </div>
            </div>

            {renderContent()}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-1 h-14">
          {[...platformLinks, ...financeLinks].slice(0, 5).map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.tab;
            return (
              <button
                key={link.tab}
                onClick={() => handleTabClick(link.tab)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-lg transition-all min-w-0 flex-1",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-[18px] h-[18px]", isActive && "scale-110")} />
                <span className={cn(
                  "text-[9px] font-medium truncate max-w-[56px]",
                  isActive && "font-bold"
                )}>
                  {link.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Create Product Dialog */}
      <CreateProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingProducts={products}
        onCreate={handleCreateProduct}
        creating={creating}
      />
    </div>
  );
}
