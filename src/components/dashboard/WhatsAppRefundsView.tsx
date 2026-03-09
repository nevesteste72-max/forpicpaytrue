import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, MessageSquare, User, CheckCircle, XCircle, Clock, Send, Eye } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface RefundContact {
  phone: string;
  name: string;
  email: string;
  lastRefundMessage: string;
  lastRefundDate: string;
  messageCount: number;
  amount: number;
  currency: string;
  transactionStatus: string;
  remoteJid: string;
}

interface ChatMessage {
  message: string;
  sender: string;
  created_at: string;
}

const REFUND_KEYWORDS = [
  "reembolso", "refund", "devolver", "dinheiro de volta", "money back",
  "estorno", "cancelar compra", "cancel purchase", "quero meu dinheiro",
  "want my money", "não recebi", "didn't receive", "não funciona",
  "doesn't work", "fraude", "fraud", "scam", "golpe",
];

export function WhatsAppRefundsView() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<RefundContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<RefundContact | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [resolveMessage, setResolveMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadRefundRequests();
  }, []);

  const loadRefundRequests = async () => {
    setLoading(true);

    const [msgRes, txRes] = await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("remote_jid, message, created_at, sender")
        .eq("sender", "customer")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("transactions")
        .select("customer_phone, customer_name, customer_email, amount, currency, status")
        .limit(500),
    ]);

    const messages = msgRes.data || [];
    const transactions = txRes.data || [];

    // Build tx lookup by phone digits
    const txByPhone = new Map<string, { name: string; email: string; amount: number; currency: string; status: string }>();
    for (const tx of transactions) {
      if (!tx.customer_phone) continue;
      const digits = tx.customer_phone.replace(/\D/g, "");
      if (digits.length < 5) continue;
      if (!txByPhone.has(digits)) {
        txByPhone.set(digits, {
          name: tx.customer_name || "Cliente",
          email: tx.customer_email,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
        });
      }
    }

    // Find messages with refund keywords
    const refundMap = new Map<string, RefundContact>();

    for (const msg of messages) {
      const lower = msg.message.toLowerCase();
      const isRefund = REFUND_KEYWORDS.some((kw) => lower.includes(kw));
      if (!isRefund) continue;

      const phone = msg.remote_jid.replace("@s.whatsapp.net", "");
      const phoneDigits = phone.replace(/\D/g, "");
      const txInfo = txByPhone.get(phoneDigits);

      const existing = refundMap.get(phoneDigits);
      if (existing) {
        existing.messageCount += 1;
      } else {
        refundMap.set(phoneDigits, {
          phone,
          name: txInfo?.name || "Desconhecido",
          email: txInfo?.email || "",
          lastRefundMessage: msg.message,
          lastRefundDate: msg.created_at,
          messageCount: 1,
          amount: txInfo?.amount || 0,
          currency: txInfo?.currency || "MZN",
          transactionStatus: txInfo?.status || "unknown",
          remoteJid: msg.remote_jid,
        });
      }
    }

    setContacts(
      Array.from(refundMap.values()).sort(
        (a, b) => new Date(b.lastRefundDate).getTime() - new Date(a.lastRefundDate).getTime()
      )
    );
    setLoading(false);
  };

  const openChat = async (contact: RefundContact) => {
    setSelectedContact(contact);
    setChatOpen(true);
    setChatLoading(true);
    setResolveMessage("");

    const { data } = await supabase
      .from("whatsapp_messages")
      .select("message, sender, created_at")
      .eq("remote_jid", contact.remoteJid)
      .order("created_at", { ascending: true })
      .limit(100);

    setChatMessages((data as ChatMessage[]) || []);
    setChatLoading(false);
  };

  const sendResolveMessage = async () => {
    if (!selectedContact || !resolveMessage.trim()) return;
    setSending(true);

    try {
      // Get connected instance
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("status", "connected")
        .limit(1);

      if (!instances || instances.length === 0) {
        toast({ title: "Erro", description: "Nenhuma instância WhatsApp conectada", variant: "destructive" });
        return;
      }

      const { error } = await supabase.functions.invoke("whatsapp-connect", {
        body: {
          action: "send_message",
          instance_id: instances[0].id,
          phone: selectedContact.phone,
          message: resolveMessage.trim(),
        },
      });

      if (error) throw error;

      toast({ title: "Mensagem enviada!", description: `Mensagem enviada para ${selectedContact.name}` });
      setResolveMessage("");
      // Refresh chat
      openChat(selectedContact);
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "successful":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />Concluída
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="w-3 h-3 mr-1" />Pendente
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />Falhada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />Desconhecido
          </Badge>
        );
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{contacts.length}</p>
            <p className="text-xs text-muted-foreground">Pedidos de Reembolso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">
              {contacts.filter((c) => c.messageCount >= 3).length}
            </p>
            <p className="text-xs text-muted-foreground">Insistentes (3+ msgs)</p>
          </CardContent>
        </Card>
      </div>

      {contacts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground mb-1">Nenhum pedido de reembolso</h3>
            <p className="text-sm text-muted-foreground">
              Clientes que pedem reembolso aparecerão aqui automaticamente.
            </p>
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
                  <TableHead>Valor</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Última Mensagem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.phone}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{contact.phone}</TableCell>
                    <TableCell className="text-sm">
                      {contact.currency} {contact.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{statusBadge(contact.transactionStatus)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          contact.messageCount >= 3
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                        }
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {contact.messageCount >= 3 ? "Alta" : "Normal"} ({contact.messageCount}x)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {contact.lastRefundMessage.substring(0, 60)}...
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openChat(contact)}>
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver & Resolver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Chat & Resolve Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0">
          <div className="px-6 pt-6 pb-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {selectedContact?.name} — {selectedContact?.phone}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-3 mt-1">
                <span>{selectedContact?.currency} {selectedContact?.amount.toFixed(2)}</span>
                <span>•</span>
                {selectedContact && statusBadge(selectedContact.transactionStatus)}
              </DialogDescription>
            </DialogHeader>
          </div>

          <ScrollArea className="h-[350px] px-6 border-y border-border">
            {chatLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 py-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                        msg.sender === "customer"
                          ? "bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p>{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender === "customer" ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                        {new Date(msg.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="px-6 py-4 space-y-3">
            <Textarea
              value={resolveMessage}
              onChange={(e) => setResolveMessage(e.target.value)}
              placeholder="Escreva a mensagem de resolução para o cliente..."
              rows={3}
              className="text-sm"
            />
            <Button
              onClick={sendResolveMessage}
              disabled={sending || !resolveMessage.trim()}
              className="w-full"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar & Resolver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
