import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Clock, XCircle, Eye, RotateCcw, Copy } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface RefundRequest {
  id: string;
  customer_email: string;
  customer_name: string;
  product_name: string;
  amount: number;
  currency: string;
  reason: string;
  reason_details: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
  transaction_id: string;
}

export function RefundsView() {
  const { toast } = useToast();
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRefunds();
  }, []);

  const loadRefunds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("refund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRefunds((data as RefundRequest[]) || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setProcessing(true);
    const updateData: Record<string, unknown> = { status };
    if (status === "approved" || status === "rejected") {
      updateData.processed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("refund_requests")
      .update(updateData)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "Reembolso aprovado!" : "Reembolso rejeitado" });

      // If approved, send confirmation email
      if (status === "approved") {
        await supabase.functions.invoke("send-refund-email", {
          body: {
            refund_request_id: id,
          },
        });
      }


      loadRefunds();
      setDetailsOpen(false);
    }
    setProcessing(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />Rejeitado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="w-3 h-3 mr-1" />Pendente
          </Badge>
        );
    }
  };

  const pendingCount = refunds.filter((r) => r.status === "pending").length;
  const approvedCount = refunds.filter((r) => r.status === "approved").length;
  const totalAmount = refunds
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const copyRefundLink = () => {
    const url = `${window.location.origin}/refund`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{refunds.length}</p>
            <p className="text-xs text-muted-foreground">Total Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {totalAmount.toFixed(0)} MZN
            </p>
            <p className="text-xs text-muted-foreground">Reembolsado</p>
          </CardContent>
        </Card>
      </div>

      {/* Refund link */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Link do formulário de reembolso</p>
            <p className="text-xs text-muted-foreground">{window.location.origin}/refund</p>
          </div>
          <Button size="sm" variant="outline" onClick={copyRefundLink}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      {refunds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <RotateCcw className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground mb-1">Nenhum pedido de reembolso</h3>
            <p className="text-sm text-muted-foreground">
              Os pedidos aparecerão aqui quando clientes solicitarem reembolso.
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
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.customer_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.customer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.product_name}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {r.currency} {Number(r.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {r.reason}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedRefund(r); setDetailsOpen(true); }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pedido de Reembolso</DialogTitle>
            <DialogDescription>Detalhes e ações do pedido</DialogDescription>
          </DialogHeader>
          {selectedRefund && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{selectedRefund.customer_name || selectedRefund.customer_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{selectedRefund.customer_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produto</span>
                  <span className="font-medium">{selectedRefund.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">{selectedRefund.currency} {Number(selectedRefund.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo</span>
                  <span>{selectedRefund.reason}</span>
                </div>
                {selectedRefund.reason_details && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground">Detalhes:</span>
                    <p className="mt-1">{selectedRefund.reason_details}</p>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Status</span>
                  {statusBadge(selectedRefund.status)}
                </div>
              </div>

              {selectedRefund.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => updateStatus(selectedRefund.id, "approved")}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Aprovar Reembolso
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => updateStatus(selectedRefund.id, "rejected")}
                    disabled={processing}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
