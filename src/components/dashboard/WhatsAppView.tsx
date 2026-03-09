import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppContactsView } from "./WhatsAppContactsView";
import { WhatsAppRefundsView } from "./WhatsAppRefundsView";
import {
  MessageSquare,
  Plus,
  Loader2,
  QrCode,
  Wifi,
  WifiOff,
  Trash2,
  RefreshCw,
  Settings,
  Bot,
  Package,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  instance_id: string | null;
  status: string;
  qr_code: string | null;
  agent_prompt: string | null;
  auto_delivery_enabled: boolean;
  auto_recovery_enabled: boolean;
  auto_support_enabled: boolean;
  msg_template_approved: string | null;
  msg_template_pending: string | null;
  msg_template_failed: string | null;
  created_at: string;
}

export function WhatsAppView() {
  const { toast } = useToast();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [currentQr, setCurrentQr] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editDelivery, setEditDelivery] = useState(true);
  const [editRecovery, setEditRecovery] = useState(true);
  const [editSupport, setEditSupport] = useState(true);
  const [editTemplateApproved, setEditTemplateApproved] = useState("");
  const [editTemplatePending, setEditTemplatePending] = useState("");
  const [editTemplateFailed, setEditTemplateFailed] = useState("");
  const [saving, setSaving] = useState(false);

  const forceSetWebhook = async () => {
    const connected = instances.find(i => i.status === "connected");
    if (!connected) return;
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "set_webhook", instance_id: connected.id },
      });
      if (error) throw error;
      toast({ title: "Webhook configurado!", description: "O webhook foi forçado com sucesso." });
    } catch {
      toast({ title: "Erro ao configurar webhook", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setInstances(data as unknown as WhatsAppInstance[]);
    if (error) console.error("Fetch instances error:", error);
    setLoading(false);
  };

  const createInstance = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "create", instance_name: newName.trim().replace(/\s+/g, "-").toLowerCase() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Instância criada!", description: "Escaneie o QR code para conectar." });
      setCreateDialogOpen(false);
      setNewName("");

      if (data?.qrcode) {
        setCurrentQr(data.qrcode);
        setSelectedInstance(data.instance);
        setQrDialogOpen(true);
      }

      fetchInstances();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar instância";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const refreshQr = async (inst: WhatsAppInstance) => {
    setQrLoading(true);
    setSelectedInstance(inst);
    setQrDialogOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "qrcode", instance_id: inst.id },
      });

      if (error) throw error;
      setCurrentQr(data?.qrcode || null);
    } catch {
      toast({ title: "Erro", description: "Não foi possível obter QR code", variant: "destructive" });
    } finally {
      setQrLoading(false);
    }
  };

  const checkStatus = async (inst: WhatsAppInstance) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "status", instance_id: inst.id },
      });

      if (error) throw error;
      toast({ title: "Status", description: `Estado: ${data?.status || "desconhecido"}` });
      fetchInstances();
    } catch {
      toast({ title: "Erro", description: "Não foi possível verificar status", variant: "destructive" });
    }
  };

  const disconnectInstance = async (inst: WhatsAppInstance) => {
    try {
      await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "disconnect", instance_id: inst.id },
      });
      toast({ title: "Desconectado" });
      fetchInstances();
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const deleteInstance = async (inst: WhatsAppInstance) => {
    try {
      await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "delete", instance_id: inst.id },
      });
      toast({ title: "Instância eliminada" });
      fetchInstances();
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const reconnectInstance = async (inst: WhatsAppInstance) => {
    setQrLoading(true);
    setSelectedInstance(inst);
    setQrDialogOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { action: "reconnect", instance_id: inst.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCurrentQr(data?.qrcode || null);
      toast({ title: "Instância recriada!", description: "Escaneie o novo QR code." });
      fetchInstances();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao reconectar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setQrLoading(false);
    }
  };

  const openSettings = (inst: WhatsAppInstance) => {
    setSelectedInstance(inst);
    setEditPrompt(inst.agent_prompt || "");
    setEditDelivery(inst.auto_delivery_enabled);
    setEditRecovery(inst.auto_recovery_enabled);
    setEditSupport(inst.auto_support_enabled);
    setEditTemplateApproved(inst.msg_template_approved || "");
    setEditTemplatePending(inst.msg_template_pending || "");
    setEditTemplateFailed(inst.msg_template_failed || "");
    setSettingsDialogOpen(true);
  };

  const saveSettings = async () => {
    if (!selectedInstance) return;
    setSaving(true);

    try {
      await supabase.functions.invoke("whatsapp-connect", {
        body: {
          action: "update_prompt",
          instance_id: selectedInstance.id,
          agent_prompt: editPrompt,
          auto_delivery_enabled: editDelivery,
          auto_recovery_enabled: editRecovery,
          auto_support_enabled: editSupport,
          msg_template_approved: editTemplateApproved,
          msg_template_pending: editTemplatePending,
          msg_template_failed: editTemplateFailed,
        },
      });
      toast({ title: "Configurações salvas!" });
      setSettingsDialogOpen(false);
      fetchInstances();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><Wifi className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "qr_ready":
      case "connecting":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><QrCode className="w-3 h-3 mr-1" />Aguardando QR</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><WifiOff className="w-3 h-3 mr-1" />Desconectado</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="instances" className="space-y-4">
      <TabsList>
        <TabsTrigger value="instances">Instâncias</TabsTrigger>
        <TabsTrigger value="contacts">Contatos & Mensagens</TabsTrigger>
        <TabsTrigger value="refunds">Reembolsos</TabsTrigger>
      </TabsList>

      <TabsContent value="contacts">
        <WhatsAppContactsView />
      </TabsContent>

      <TabsContent value="refunds">
        <WhatsAppRefundsView />
      </TabsContent>

      <TabsContent value="instances">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Conecte o WhatsApp para entrega, recuperação e suporte automático.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={forceSetWebhook} size="sm" variant="outline" disabled={!instances.some(i => i.status === "connected")}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Forçar Webhook
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Nova Instância
          </Button>
        </div>
      </div>

      {instances.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground mb-1">Nenhuma instância WhatsApp</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie uma instância para começar a automatizar.</p>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Criar Instância
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {instances.map((inst) => (
            <Card key={inst.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{inst.instance_name}</CardTitle>
                  {statusBadge(inst.status)}
                </div>
                <CardDescription className="text-xs">
                  Criado em {new Date(inst.created_at).toLocaleDateString("pt-BR")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  {inst.auto_delivery_enabled && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Package className="w-3 h-3" /> Entrega
                    </span>
                  )}
                  {inst.auto_recovery_enabled && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <AlertTriangle className="w-3 h-3" /> Recuperação
                    </span>
                  )}
                  {inst.auto_support_enabled && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ShieldCheck className="w-3 h-3" /> Suporte IA
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {inst.status !== "connected" && (
                    <Button size="sm" variant="outline" onClick={() => refreshQr(inst)}>
                      <QrCode className="w-3.5 h-3.5 mr-1" />
                      QR Code
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => checkStatus(inst)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Status
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openSettings(inst)}>
                    <Settings className="w-3.5 h-3.5 mr-1" />
                    Config
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reconnectInstance(inst)} className="text-amber-600">
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Reconectar
                  </Button>
                  {inst.status === "connected" && (
                    <Button size="sm" variant="outline" onClick={() => disconnectInstance(inst)} className="text-destructive">
                      <WifiOff className="w-3.5 h-3.5 mr-1" />
                      Desconectar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteInstance(inst)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância WhatsApp</DialogTitle>
            <DialogDescription>Dê um nome para a sua instância. Será usado como identificador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da instância</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="minha-loja"
              />
            </div>
            <Button onClick={createInstance} disabled={creating || !newName.trim()} className="w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar e Conectar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : currentQr ? (
              <img
                src={currentQr.startsWith("data:") ? currentQr : `data:image/png;base64,${currentQr}`}
                alt="QR Code"
                className="w-64 h-64 rounded-lg"
              />
            ) : (
              <p className="text-sm text-muted-foreground">QR code não disponível. Tente novamente.</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => selectedInstance && refreshQr(selectedInstance)}
              disabled={qrLoading}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Atualizar QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
          <ScrollArea className="max-h-[85vh] px-6 py-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Configurações do Agente IA
            </DialogTitle>
            <DialogDescription>Configure o comportamento do assistente para {selectedInstance?.instance_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label>Prompt do Agente</Label>
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Descreva como o agente deve se comportar..."
                rows={5}
                className="mt-1"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Entrega Automática</Label>
                    <p className="text-xs text-muted-foreground">Assistir compradores com a entrega do produto</p>
                  </div>
                </div>
                <Switch checked={editDelivery} onCheckedChange={setEditDelivery} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Recuperação de Vendas</Label>
                    <p className="text-xs text-muted-foreground">Mensagens para compras pendentes/falhadas</p>
                  </div>
                </div>
                <Switch checked={editRecovery} onCheckedChange={setEditRecovery} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">Suporte com IA</Label>
                    <p className="text-xs text-muted-foreground">Responder automaticamente com inteligência artificial</p>
                  </div>
                </div>
                <Switch checked={editSupport} onCheckedChange={setEditSupport} />
              </div>
            </div>

            {/* Message Templates */}
            <div className="space-y-3 border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground">Templates de Mensagem Automática</h4>
              <p className="text-xs text-muted-foreground">Use: {"{name}"}, {"{amount}"}, {"{currency}"}, {"{product}"}</p>
              
              <div>
                <Label className="text-sm">✅ Venda Aprovada</Label>
                <Textarea
                  value={editTemplateApproved}
                  onChange={(e) => setEditTemplateApproved(e.target.value)}
                  placeholder="Mensagem enviada quando a venda é confirmada..."
                  rows={3}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-sm">⏳ Compra Pendente</Label>
                <Textarea
                  value={editTemplatePending}
                  onChange={(e) => setEditTemplatePending(e.target.value)}
                  placeholder="Mensagem enviada para compras pendentes..."
                  rows={3}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-sm">❌ Pagamento Falhado</Label>
                <Textarea
                  value={editTemplateFailed}
                  onChange={(e) => setEditTemplateFailed(e.target.value)}
                  placeholder="Mensagem enviada quando o pagamento falha..."
                  rows={3}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Configurações
            </Button>
          </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>
    </Tabs>
  );
}
