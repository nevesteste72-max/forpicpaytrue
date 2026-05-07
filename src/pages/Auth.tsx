import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CreditCard } from "lucide-react";
import cashpayIcon from "@/assets/cashpay-icon.png";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const ALLOWED_EMAILS = ["gerciositoe2708@gmail.com", "ivanilsonjsosousa@gmail.com"];
        if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
          toast({
            title: "Registo não permitido",
            description: "O registo está fechado. Apenas contas autorizadas podem aceder.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { business_name: businessName } },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique o seu email para confirmar a conta.",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card grid lg:grid-cols-2">
      {/* Left: Form */}
      <div className="flex items-center justify-center p-8 lg:p-16 relative">
        <Link
          to="/"
          className="absolute top-8 left-8 flex items-center text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Link>

        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <img src={cashpayIcon} alt="Cashpay" className="w-10 h-10 rounded-lg shadow-lg shadow-primary/30 mb-6" />
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {isLogin ? "Bem-vindo de volta" : "Criar nova conta"}
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              Gerencie suas vendas e pagamentos.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="businessName" className="text-xs font-semibold text-foreground">
                  Nome do Negócio
                </Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex: Loja da Maria"
                  required={!isLogin}
                  className="h-11 rounded-lg bg-muted border-border focus:bg-card text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="h-11 rounded-lg bg-muted border-border focus:bg-card text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-11 rounded-lg bg-muted border-border focus:bg-card text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg gradient-primary text-white font-semibold text-sm shadow-md shadow-primary/20 transition-all group"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Entrar na conta" : "Começar Grátis"}
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-medium hover:underline"
              >
                {isLogin ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex bg-sidebar relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(168_80%_28%/0.2),hsl(220_25%_10%)_70%)]" />
        <div className="relative z-10 max-w-md text-center p-8">
          <div className="mb-8 inline-block p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
            <CreditCard className="w-16 h-16 text-primary" />
          </div>
          <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">
            Venda mais rápido com M-Pesa
          </h3>
          <p className="text-sidebar-foreground/60 text-lg leading-relaxed">
            Junte-se a mais de 1.000 empreendedores moçambicanos que usam a Cashpay para escalar seus negócios digitais.
          </p>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
