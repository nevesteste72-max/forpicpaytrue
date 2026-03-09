import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Send,
  User,
  MessageSquare,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Contact {
  phone: string;
  name: string;
  email: string;
  status: string;
  amount: number;
  currency: string;
  messageSent: boolean;
  lastMessage?: string;
  lastMessageDate?: string;
  transactionId: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
}

export function WhatsAppContactsView() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "sent" | "not_sent">("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Fetch transactions, messages, and instances in parallel
    const [txRes, msgRes, instRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, customer_phone, customer_name, customer_email, status, amount, currency, created_at")
        .neq("customer_phone", "")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("whatsapp_messages")
        .select("remote_jid, message, created_at, sender")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status")
        .eq("status", "connected"),
    ]);

    const transactions = txRes.data || [];
    const messages = msgRes.data || [];
    const instancesList = (instRes.data || []) as unknown as WhatsAppInstance[];
    setInstances(instancesList);

    // Build message lookup by phone (normalized - digits only)
    const messagesByPhone = new Map<string, { message: string; date: string; sender: string }>();
    for (const msg of messages) {
      const phone = msg.remote_jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (!messagesByPhone.has(phone)) {
        messagesByPhone.set(phone, {
          message: msg.message,
          date: msg.created_at,
          sender: msg.sender,
        });
      }
    }

    // Build unique contacts from transactions
    const contactMap = new Map<string, Contact>();
    for (const tx of transactions) {
      if (!tx.customer_phone) continue;
      const normalizedTxPhone = tx.customer_phone.replace(/\D/g, "");
      if (contactMap.has(normalizedTxPhone)) continue;
      
      const msgData = messagesByPhone.get(normalizedTxPhone);
      contactMap.set(normalizedTxPhone, {
        phone: tx.customer_phone,
        name: tx.customer_name || "Cliente",
        email: tx.customer_email,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        messageSent: !!msgData,
        lastMessage: msgData?.message,
        lastMessageDate: msgData?.date,
        transactionId: tx.id,
      });
    }

    setContacts(Array.from(contactMap.values()));
    setLoading(false);
  };

  const openSendDialog = (contact: Contact) => {
    setSelectedContact(contact);
    setMessageText(
      `Olá ${contact.name}! Notamos que sua compra no valor de ${contact.currency} ${contact.amount.toFixed(2)} está com status "${contact.status}". Posso ajudá-lo a completar?`
    );
    setSendDialogOpen(true);
  };

  const sendMessage = async () => {
    if (!selectedContact || !messageText.trim() || instances.length === 0) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: {
          action: "send_message",
          instance_id: instances[0].id,
          phone: selectedContact.phone,
          message: messageText,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Mensagem enviada!", description: `Enviado para ${selectedContact.phone}` });
      setSendDialogOpen(false);
      loadData(); // Refresh
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendToAll = async () => {
    const unsent = contacts.filter((c) => !c.messageSent && c.status !== "completed" && c.status !== "success");
    if (unsent.length === 0 || instances.length === 0) {
      toast({ title: "Nenhum contato pendente" });
      return;
    }

    toast({ title: "Enviando mensagens...", description: `${unsent.length} contatos pendentes` });

    let sent = 0;
    for (const contact of unsent) {
      try {
        const msg = `Olá ${contact.name}! Notamos que sua compra no valor de ${contact.currency} ${contact.amount.toFixed(2)} está pendente. Posso ajudá-lo a completar?`;
        await supabase.functions.invoke("whatsapp-connect", {
          body: {
            action: "send_message",
            instance_id: instances[0].id,
            phone: contact.phone,
            message: msg,
          },
        });
        sent++;
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 2000));
      } catch {
        console.error(`Failed to send to ${contact.phone}`);
      }
    }

    toast({ title: "Concluído!", description: `${sent}/${unsent.length} mensagens enviadas` });
    loadData();
  };

  const filtered = contacts.filter((c) => {
    if (filter === "sent") return c.messageSent;
    if (filter === "not_sent") return !c.messageSent;
    return true;
  });

  const sentCount = contacts.filter((c) => c.messageSent).length;
  const notSentCount = contacts.filter((c) => !c.messageSent).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer" onClick={() => setFilter("all")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{contacts.length}</p>
            <p className="text-xs text-muted-foreground">Total Contatos</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("sent")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{sentCount}</p>
            <p className="text-xs text-muted-foreground">Mensagem Enviada</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("not_sent")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{notSentCount}</p>
            <p className="text-xs text-muted-foreground">Sem Mensagem</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge
            variant={filter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("all")}
          >
            Todos
          </Badge>
          <Badge
            variant={filter === "sent" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("sent")}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Enviados
          </Badge>
          <Badge
            variant={filter === "not_sent" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter("not_sent")}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Não enviados
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={sendToAll}
          disabled={instances.length === 0 || notSentCount === 0}
        >
          <Send className="w-3.5 h-3.5 mr-1" />
          Enviar para todos ({notSentCount})
        </Button>
      </div>

      {instances.length === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-600">
            ⚠️ Nenhuma instância WhatsApp conectada. Conecte uma instância na aba "Instâncias" para enviar mensagens.
          </CardContent>
        </Card>
      )}

      {/* Contacts Table */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <User className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground mb-1">Nenhum contato encontrado</h3>
            <p className="text-sm text-muted-foreground">Contatos aparecerão quando houver transações com número de telefone.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status Compra</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contact) => (
                  <TableRow key={contact.transactionId}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{contact.phone}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          contact.status === "completed" || contact.status === "success"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : contact.status === "failed" || contact.status === "cancelled"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                        }
                      >
                        {contact.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {contact.currency} {contact.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {contact.messageSent ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {contact.lastMessage?.substring(0, 40)}...
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-muted-foreground">Não enviada</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSendDialog(contact)}
                        disabled={instances.length === 0}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        Enviar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Send Message Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Enviar Mensagem
            </DialogTitle>
            <DialogDescription>
              Enviar para {selectedContact?.name} ({selectedContact?.phone})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={5}
              placeholder="Escreva sua mensagem..."
            />
            <Button onClick={sendMessage} disabled={sending || !messageText.trim()} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Mensagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
