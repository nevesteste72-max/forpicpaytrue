import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, Pencil, Check, X, FlaskConical, AlertTriangle } from "lucide-react";

interface SettingsData {
  stripe_publishable_key_masked: string | null;
  stripe_publishable_key_set: boolean;
  stripe_secret_key_masked: string | null;
  stripe_secret_key_set: boolean;
  stripe_publishable_key_test_masked: string | null;
  stripe_publishable_key_test_set: boolean;
  stripe_secret_key_test_masked: string | null;
  stripe_secret_key_test_set: boolean;
  stripe_mode: "live" | "test";
  updated_at: string | null;
}

type CampoChave =
  | "stripe_publishable_key"
  | "stripe_secret_key"
  | "stripe_publishable_key_test"
  | "stripe_secret_key_test";

export function SettingsView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [editando, setEditando] = useState<CampoChave | null>(null);
  const [valor, setValor] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("app-settings", {
      body: { action: "get" },
    });
    if (error) {
      toast({ title: "Erro ao carregar definições", variant: "destructive" });
    } else {
      setSettings(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const guardar = async (campo: CampoChave, titulo: string) => {
    if (!valor.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("app-settings", {
      body: { action: "update", [campo]: valor.trim() },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Erro ao guardar", description: data?.error, variant: "destructive" });
      return;
    }
    setSettings(data);
    setEditando(null);
    setValor("");
    toast({ title: titulo + " atualizada!" });
  };

  const trocarModo = async (novo: "live" | "test") => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("app-settings", {
      body: { action: "update", stripe_mode: novo },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Não foi possível trocar de modo", description: data?.error, variant: "destructive" });
      return;
    }
    setSettings(data);
    toast({
      title: novo === "test" ? "Modo de teste ativo" : "Modo de produção ativo",
      description:
        novo === "test"
          ? "Os pagamentos deixam de cobrar dinheiro real."
          : "Os pagamentos voltam a ser reais.",
    });
  };

  const CampoDeChave = ({
    campo,
    rotulo,
    exemplo,
    definida,
    mascara,
    secreta,
  }: {
    campo: CampoChave;
    rotulo: string;
    exemplo: string;
    definida: boolean;
    mascara: string | null;
    secreta?: boolean;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm">{rotulo}</Label>
      {editando === campo ? (
        <div className="flex gap-2">
          <Input
            type={secreta ? "password" : "text"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={exemplo}
            className="h-10 rounded-lg font-mono text-sm"
            autoFocus
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => guardar(campo, rotulo)}
            disabled={saving || !valor.trim()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              setEditando(null);
              setValor("");
            }}
            disabled={saving}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between h-10 px-3 rounded-lg border border-border bg-muted/30">
          <span className="font-mono text-sm text-muted-foreground">
            {definida ? mascara : "Não configurada"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditando(campo);
              setValor("");
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Alterar
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const emTeste = settings?.stripe_mode === "test";
  const temChavesTeste =
    !!settings?.stripe_publishable_key_test_set && !!settings?.stripe_secret_key_test_set;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Definições</h2>
        <p className="text-sm text-muted-foreground">
          Configure as chaves da Stripe usadas nos pagamentos.
        </p>
      </div>

      {/* Modo ativo */}
      <Card className={emTeste ? "border-amber-500/50 bg-amber-500/[0.04]" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {emTeste ? (
              <FlaskConical className="w-4 h-4 text-amber-600" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            Modo de pagamento
          </CardTitle>
          <CardDescription>
            {emTeste
              ? "Estás em modo de teste: os pagamentos não cobram dinheiro real."
              : "Estás em produção: os pagamentos são reais."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emTeste && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                Enquanto isto estiver ligado, <strong>nenhuma venda é cobrada a sério</strong>. Não
                deixes o modo de teste ligado com tráfego a entrar.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant={!emTeste ? "default" : "outline"}
              className="flex-1"
              onClick={() => trocarModo("live")}
              disabled={saving || !emTeste}
            >
              Produção (live)
            </Button>
            <Button
              variant={emTeste ? "default" : "outline"}
              className="flex-1"
              onClick={() => trocarModo("test")}
              disabled={saving || emTeste || !temChavesTeste}
            >
              Teste (sandbox)
            </Button>
          </div>

          {!temChavesTeste && (
            <p className="text-xs text-muted-foreground">
              Para poderes ligar o modo de teste, configura primeiro as duas chaves de teste em
              baixo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Chaves de produção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4" />
            Chaves de produção
          </CardTitle>
          <CardDescription>
            As chaves ficam guardadas de forma segura e nunca são mostradas por completo aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CampoDeChave
            campo="stripe_publishable_key"
            rotulo="Chave Publicável (Publishable Key)"
            exemplo="pk_live_..."
            definida={!!settings?.stripe_publishable_key_set}
            mascara={settings?.stripe_publishable_key_masked ?? null}
          />
          <CampoDeChave
            campo="stripe_secret_key"
            rotulo="Chave Secreta (Secret Key)"
            exemplo="sk_live_..."
            definida={!!settings?.stripe_secret_key_set}
            mascara={settings?.stripe_secret_key_masked ?? null}
            secreta
          />
        </CardContent>
      </Card>

      {/* Chaves de teste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4" />
            Chaves de teste (sandbox)
          </CardTitle>
          <CardDescription>
            Para testares produtos sem cobrar dinheiro. Só aceita chaves que comecem por pk_test_ e
            sk_test_.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CampoDeChave
            campo="stripe_publishable_key_test"
            rotulo="Chave Publicável de Teste"
            exemplo="pk_test_..."
            definida={!!settings?.stripe_publishable_key_test_set}
            mascara={settings?.stripe_publishable_key_test_masked ?? null}
          />
          <CampoDeChave
            campo="stripe_secret_key_test"
            rotulo="Chave Secreta de Teste"
            exemplo="sk_test_..."
            definida={!!settings?.stripe_secret_key_test_set}
            mascara={settings?.stripe_secret_key_test_masked ?? null}
            secreta
          />

          {settings?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Última atualização: {new Date(settings.updated_at).toLocaleString("pt-PT")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
