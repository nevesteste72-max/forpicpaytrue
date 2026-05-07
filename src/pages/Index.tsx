import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Link as LinkIcon,
  Phone,
  BarChart3,
  Gift,
  Zap,
  Play,
} from "lucide-react";
import cashpayLogoFull from "@/assets/cashpay-logo-full.png";
import cashpayIcon from "@/assets/cashpay-icon.png";

function useIsMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.innerWidth < 768;
}

const Index = () => {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const isMobile = useIsMobile();

  // On mobile / PWA, skip the landing page entirely
  useEffect(() => {
    if (!isMobile) {
      setChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    });
  }, [isMobile, navigate]);

  // Don't flash landing page on mobile while checking auth
  if (!checked && isMobile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed w-full z-50 top-0 glass border-b border-border/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center group">
            <img src={cashpayLogoFull} alt="PicPay" className="h-8 group-hover:scale-105 transition-transform" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-muted-foreground hover:text-primary font-medium text-sm transition-colors hidden sm:inline-block">
              Entrar
            </Link>
            <Button asChild size="sm" className="bg-foreground text-background hover:bg-foreground/90 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <Link to="/auth">Começar Grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-40 overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-20 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-medium mb-8 animate-pulse-slow">
            <span className="w-2 h-2 rounded-full bg-mpesa" />
            Plataforma de Vendas para Moçambique
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
            Venda online com
            <br />
            <span className="gradient-text">M-Pesa instantâneo</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            A plataforma completa para criadores e empresas em Moçambique. Crie links de pagamento, gerencie produtos e receba via M-Pesa em segundos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="h-12 px-8 rounded-full gradient-primary text-white font-semibold shadow-glow group">
              <Link to="/auth">
                Criar Conta Grátis
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8 rounded-full bg-card border-border text-foreground font-medium hover:bg-muted transition-all">
              <Play className="w-4 h-4 mr-2" />
              Ver Demo
            </Button>
          </div>
        </div>

        {/* Dashboard Mockup */}
        <div className="mt-20 max-w-6xl mx-auto px-4 relative">
          <div className="bg-foreground rounded-2xl p-2 shadow-2xl ring-1 ring-foreground/10">
            <div className="bg-foreground/95 rounded-xl overflow-hidden border border-border/10 aspect-[16/9] md:aspect-[21/9] flex relative">
              {/* Sidebar Mock */}
              <div className="w-16 md:w-56 border-r border-border/10 p-4 hidden md:block">
                <div className="flex gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-pending" />
                  <div className="w-3 h-3 rounded-full bg-success" />
                </div>
                <div className="space-y-3 opacity-50">
                  <div className="h-2 w-20 bg-muted-foreground/20 rounded" />
                  <div className="h-2 w-32 bg-muted-foreground/20 rounded" />
                  <div className="h-2 w-24 bg-muted-foreground/20 rounded" />
                </div>
              </div>
              {/* Content Mock */}
              <div className="flex-1 p-6 md:p-10">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <div className="h-3 w-32 bg-muted-foreground/20 rounded mb-2" />
                    <div className="h-8 w-48 bg-muted-foreground/15 rounded" />
                  </div>
                  <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                </div>
                {/* Bars */}
                <div className="flex items-end gap-3 h-40">
                  {[40, 70, 90, 60, 50].map((h, i) => (
                    <div
                      key={i}
                      className={`w-full rounded-t-sm transition-colors ${
                        h === 90
                          ? "bg-primary shadow-[0_0_15px_hsl(168_80%_28%/0.3)]"
                          : "bg-muted-foreground/10 hover:bg-primary/50"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Floating notification */}
          <div className="absolute -right-4 top-1/4 bg-card p-4 rounded-xl shadow-xl border border-border flex items-center gap-3 animate-float">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pagamento Recebido</p>
              <p className="text-sm font-bold text-foreground">+1,500 MZN</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: LinkIcon,
                title: "Links de Pagamento",
                desc: "Crie links únicos para seus produtos e compartilhe no WhatsApp ou Instagram.",
                hoverColor: "hover:border-primary/30",
                iconColor: "text-primary",
              },
              {
                icon: Phone,
                title: "M-Pesa Integrado",
                desc: "Receba pagamentos automaticamente via STK Push. Sem necessidade de comprovativos.",
                hoverColor: "hover:border-mpesa/30",
                iconColor: "text-mpesa",
              },
              {
                icon: Gift,
                title: "Order Bumps",
                desc: "Aumente o ticket médio oferecendo produtos complementares no checkout.",
                hoverColor: "hover:border-accent/50",
                iconColor: "text-accent",
              },
              {
                icon: BarChart3,
                title: "Dashboard Completo",
                desc: "Acompanhe vendas, conversões e receitas em tempo real.",
                hoverColor: "hover:border-blue-400/30",
                iconColor: "text-blue-500",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`p-6 rounded-2xl bg-muted/50 border border-border ${feature.hoverColor} transition-colors group`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center mb-4 ${feature.iconColor} shadow-subtle group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>© 2024 PicPay Lda. Todos os direitos reservados.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-primary transition-colors">Termos</a>
            <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
