import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, Pencil, Check, X } from "lucide-react";

interface SettingsData {
  stripe_publishable_key_masked: string | null;
  stripe_publishable_key_set: boolean;
  stripe_secret_key_masked: string | null;
  stripe_secret_key_set: boolean;
  updated_at: string | null;
}

export function SettingsView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);

  const [editingPk, setEditingPk] = useState(false);
  const [editingSk, setEditingSk] = useState(false);
  const [pkValue, setPkValue] = useState("");
  const [skValue, setSkValue] = useState("");

  const fetchSettings = async () => {
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
    fetchSettings();
  }, []);

  const savePublishableKey = async () => {
    if (!pkValue.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("app-settings", {
      body: { action: "update", stripe_publishable_key: pkValue.trim() },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Erro ao salvar", description: data?.error, variant: "destructive" });
      return;
    }
    setSettings(data);
    setEditingPk(false);
    setPkValue("");
    toast({ title: "Chave publicável atualizada!" });
  };

  const saveSecretKey = async () => {
    if (!skValue.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("app-settings", {
      body: { action: "update", stripe_secret_key: skValue.trim() },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Erro ao salvar", description: data?.error, variant: "destructive" });
      return;
    }
    setSettings(data);
    setEditingSk(false);
    setSkValue("");
    toast({ title: "Chave secreta atualizada!" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Definições</h2>
        <p className="text-sm text-muted-foreground">Configure as chaves da Stripe usadas nos pagamentos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4" />
            Chaves da Stripe
          </CardTitle>
          <CardDescription>
            As chaves ficam guardadas de forma segura e nunca são mostradas por completo aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Publishable Key */}
          <div className="space-y-2">
            <Label className="text-sm">Chave Publicável (Publishable Key)</Label>
            {editingPk ? (
              <div className="flex gap-2">
                <Input
                  value={pkValue}
                  onChange={(e) => setPkValue(e.target.value)}
                  placeholder="pk_live_..."
                  className="h-10 rounded-lg font-mono text-sm"
                  autoFocus
                />
                <Button size="icon" variant="outline" onClick={savePublishableKey} disabled={saving || !pkValue.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => { setEditingPk(false); setPkValue(""); }} disabled={saving}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between h-10 px-3 rounded-lg border border-border bg-muted/30">
                <span className="font-mono text-sm text-muted-foreground">
                  {settings?.stripe_publishable_key_set ? settings.stripe_publishable_key_masked : "Não configurada"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditingPk(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Alterar
                </Button>
              </div>
            )}
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label className="text-sm">Chave Secreta (Secret Key)</Label>
            {editingSk ? (
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={skValue}
                  onChange={(e) => setSkValue(e.target.value)}
                  placeholder="sk_live_..."
                  className="h-10 rounded-lg font-mono text-sm"
                  autoFocus
                />
                <Button size="icon" variant="outline" onClick={saveSecretKey} disabled={saving || !skValue.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => { setEditingSk(false); setSkValue(""); }} disabled={saving}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between h-10 px-3 rounded-lg border border-border bg-muted/30">
                <span className="font-mono text-sm text-muted-foreground">
                  {settings?.stripe_secret_key_set ? settings.stripe_secret_key_masked : "Não configurada"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditingSk(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Alterar
                </Button>
              </div>
            )}
          </div>

          {settings?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Última atualização: {new Date(settings.updated_at).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
