import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Upload,
  Link as LinkIcon,
  Trash2,
  FileText,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";

interface Entregavel {
  id: string;
  kind: "file" | "link";
  storage_path: string | null;
  external_url: string | null;
  filename: string | null;
  mimetype: string | null;
  caption: string | null;
  position: number;
  is_active: boolean;
}

interface Props {
  productId: string | null;
  productName?: string;
  onClose: () => void;
}

// 45 MB: acima disto o WhatsApp recusa o anexo, por isso travamos aqui
// em vez de deixar a entrega falhar silenciosamente no cliente.
const LIMITE_BYTES = 45 * 1024 * 1024;

export function DeliverablesDialog({ productId, productName, onClose }: Props) {
  const { toast } = useToast();
  const inputFicheiro = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [itens, setItens] = useState<Entregavel[]>([]);
  const [entregaWhats, setEntregaWhats] = useState(true);

  const [urlNova, setUrlNova] = useState("");
  const [legendaNova, setLegendaNova] = useState("");

  const carregar = async () => {
    if (!productId) return;
    setCarregando(true);

    const [{ data: entregaveis }, { data: produto }] = await Promise.all([
      supabase
        .from("product_deliverables")
        .select("*")
        .eq("payment_link_id", productId)
        .order("position", { ascending: true }),
      supabase
        .from("payment_links")
        .select("whatsapp_delivery_enabled")
        .eq("id", productId)
        .maybeSingle(),
    ]);

    setItens((entregaveis as Entregavel[]) ?? []);
    setEntregaWhats(produto?.whatsapp_delivery_enabled !== false);
    setCarregando(false);
  };

  useEffect(() => {
    if (productId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const proximaPosicao = () =>
    itens.length ? Math.max(...itens.map((i) => i.position)) + 1 : 1;

  const subirFicheiro = async (ficheiro: File) => {
    if (!productId) return;
    if (ficheiro.size > LIMITE_BYTES) {
      toast({
        title: "Ficheiro demasiado grande",
        description:
          "O WhatsApp não aceita anexos acima de ~45 MB. Para vídeos, usa antes um link.",
        variant: "destructive",
      });
      return;
    }

    setOcupado(true);
    const caminho = `${productId}/${Date.now()}-${ficheiro.name.replace(/[^\w.\-]/g, "_")}`;

    const { error: erroUpload } = await supabase.storage
      .from("deliverables")
      .upload(caminho, ficheiro, { upsert: false, contentType: ficheiro.type || undefined });

    if (erroUpload) {
      setOcupado(false);
      toast({ title: "Falha ao enviar", description: erroUpload.message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("product_deliverables").insert({
      payment_link_id: productId,
      kind: "file",
      storage_path: caminho,
      filename: ficheiro.name,
      mimetype: ficheiro.type || "application/octet-stream",
      position: proximaPosicao(),
    });

    setOcupado(false);
    if (error) {
      toast({ title: "Falha ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ficheiro adicionado", description: "Vai ser enviado no WhatsApp após o pagamento." });
    carregar();
  };

  const adicionarLink = async () => {
    if (!productId || !urlNova.trim()) return;
    if (!/^https?:\/\//i.test(urlNova.trim())) {
      toast({ title: "Link inválido", description: "Tem de começar por http:// ou https://", variant: "destructive" });
      return;
    }

    setOcupado(true);
    const { error } = await supabase.from("product_deliverables").insert({
      payment_link_id: productId,
      kind: "link",
      external_url: urlNova.trim(),
      caption: legendaNova.trim() || null,
      position: proximaPosicao(),
    });
    setOcupado(false);

    if (error) {
      toast({ title: "Falha ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    setUrlNova("");
    setLegendaNova("");
    toast({ title: "Link adicionado" });
    carregar();
  };

  const remover = async (item: Entregavel) => {
    setOcupado(true);
    if (item.kind === "file" && item.storage_path) {
      await supabase.storage.from("deliverables").remove([item.storage_path]);
    }
    const { error } = await supabase.from("product_deliverables").delete().eq("id", item.id);
    setOcupado(false);
    if (error) {
      toast({ title: "Falha ao remover", description: error.message, variant: "destructive" });
      return;
    }
    carregar();
  };

  const alternarWhats = async () => {
    if (!productId) return;
    const novo = !entregaWhats;
    setOcupado(true);
    const { error } = await supabase
      .from("payment_links")
      .update({ whatsapp_delivery_enabled: novo })
      .eq("id", productId);
    setOcupado(false);
    if (error) {
      toast({ title: "Não foi possível alterar", description: error.message, variant: "destructive" });
      return;
    }
    setEntregaWhats(novo);
    toast({
      title: novo ? "Entrega por WhatsApp ligada" : "Entrega por WhatsApp desligada",
      description: novo
        ? "Quem comprar recebe a mensagem e os ficheiros no WhatsApp."
        : "Este produto deixa de ser entregue por WhatsApp.",
    });
  };

  return (
    <Dialog open={!!productId} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entregáveis</DialogTitle>
          <DialogDescription>
            O que o cliente recebe depois de pagar{productName ? ` — ${productName}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Entrega por WhatsApp */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Entrega por WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Envia mensagem, link e ficheiros assim que o pagamento é confirmado.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={entregaWhats ? "default" : "outline"}
                onClick={alternarWhats}
                disabled={ocupado}
              >
                {entregaWhats ? "Ligada" : "Desligada"}
              </Button>
            </div>

            {/* Lista */}
            <div className="space-y-2">
              <Label className="text-sm">Itens a entregar ({itens.length})</Label>
              {itens.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Ainda não há nada. Quem comprar recebe só a mensagem de confirmação, sem material.
                  </p>
                </div>
              ) : (
                itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2.5"
                  >
                    {item.kind === "file" ? (
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        {item.kind === "file" ? item.filename : item.caption || item.external_url}
                      </p>
                      {item.kind === "link" && item.caption && (
                        <p className="text-xs text-muted-foreground truncate">{item.external_url}</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remover(item)}
                      disabled={ocupado}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Subir ficheiro */}
            <div className="space-y-2">
              <Label className="text-sm">Subir ficheiro</Label>
              <input
                ref={inputFicheiro}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) subirFicheiro(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => inputFicheiro.current?.click()}
                disabled={ocupado}
              >
                {ocupado ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Escolher ficheiro
              </Button>
              <p className="text-xs text-muted-foreground">
                Até 45 MB. Para vídeos usa antes um link — ficheiros grandes não passam no WhatsApp.
              </p>
            </div>

            {/* Adicionar link */}
            <div className="space-y-2">
              <Label className="text-sm">Ou adicionar um link</Label>
              <Input
                value={urlNova}
                onChange={(e) => setUrlNova(e.target.value)}
                placeholder="https://..."
                className="h-9 text-sm"
              />
              <Input
                value={legendaNova}
                onChange={(e) => setLegendaNova(e.target.value)}
                placeholder="Descrição (opcional) — ex: Área de membros"
                className="h-9 text-sm"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={adicionarLink}
                disabled={ocupado || !urlNova.trim()}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Adicionar link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
