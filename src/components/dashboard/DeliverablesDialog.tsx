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
  Check,
} from "lucide-react";

type Destino = "main" | "bump1" | "bump2" | "bump3";

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
  applies_to: Destino;
}

interface Props {
  productId: string | null;
  productName?: string;
  onClose: () => void;
}

// 45 MB: acima disto o WhatsApp recusa o anexo.
const LIMITE_BYTES = 45 * 1024 * 1024;

export function DeliverablesDialog({ productId, productName, onClose }: Props) {
  const { toast } = useToast();
  const inputFicheiro = useRef<HTMLInputElement>(null);

  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [itens, setItens] = useState<Entregavel[]>([]);
  const [entregaWhats, setEntregaWhats] = useState(true);
  const [bumps, setBumps] = useState<(string | null)[]>([null, null, null]);

  const [destino, setDestino] = useState<Destino>("main");
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
        .select(
          "whatsapp_delivery_enabled, order_bump_name, order_bump_2_name, order_bump_3_name",
        )
        .eq("id", productId)
        .maybeSingle(),
    ]);

    setItens((entregaveis as Entregavel[]) ?? []);
    setEntregaWhats(produto?.whatsapp_delivery_enabled !== false);
    setBumps([
      produto?.order_bump_name ?? null,
      produto?.order_bump_2_name ?? null,
      produto?.order_bump_3_name ?? null,
    ]);
    setCarregando(false);
  };

  useEffect(() => {
    if (productId) {
      setDestino("main");
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const destinos: { valor: Destino; rotulo: string }[] = [
    { valor: "main", rotulo: "Produto principal" },
    ...bumps
      .map((nome, i) =>
        nome
          ? { valor: `bump${i + 1}` as Destino, rotulo: `Order bump ${i + 1}: ${nome}` }
          : null,
      )
      .filter(Boolean as unknown as (v: unknown) => v is { valor: Destino; rotulo: string }),
  ];

  const nomeDestino = (d: Destino) =>
    destinos.find((x) => x.valor === d)?.rotulo ??
    (d === "main" ? "Produto principal" : `Order bump ${d.slice(-1)} (já não existe)`);

  const proximaPosicao = () =>
    itens.length ? Math.max(...itens.map((i) => i.position)) + 1 : 1;

  const subirFicheiro = async (ficheiro: File) => {
    if (!productId) return;
    if (ficheiro.size > LIMITE_BYTES) {
      toast({
        title: "Ficheiro demasiado grande",
        description: "O WhatsApp não aceita anexos acima de ~45 MB. Para vídeos, usa um link.",
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
      applies_to: destino,
      position: proximaPosicao(),
    });

    setOcupado(false);
    if (error) {
      toast({ title: "Falha ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Guardado", description: `Vai para: ${nomeDestino(destino)}` });
    carregar();
  };

  const adicionarLink = async () => {
    if (!productId || !urlNova.trim()) return;
    if (!/^https?:\/\//i.test(urlNova.trim())) {
      toast({
        title: "Link inválido",
        description: "Tem de começar por http:// ou https://",
        variant: "destructive",
      });
      return;
    }

    setOcupado(true);
    const { error } = await supabase.from("product_deliverables").insert({
      payment_link_id: productId,
      kind: "link",
      external_url: urlNova.trim(),
      caption: legendaNova.trim() || null,
      applies_to: destino,
      position: proximaPosicao(),
    });
    setOcupado(false);

    if (error) {
      toast({ title: "Falha ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    setUrlNova("");
    setLegendaNova("");
    toast({ title: "Guardado", description: `Vai para: ${nomeDestino(destino)}` });
    carregar();
  };

  const mudarDestino = async (item: Entregavel, novo: Destino) => {
    setOcupado(true);
    const { error } = await supabase
      .from("product_deliverables")
      .update({ applies_to: novo })
      .eq("id", item.id);
    setOcupado(false);
    if (error) {
      toast({ title: "Falha ao alterar", description: error.message, variant: "destructive" });
      return;
    }
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
                    Envia mensagem, links e ficheiros assim que o pagamento é confirmado.
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
                    Ainda não há nada. Quem comprar recebe só a mensagem, sem material.
                  </p>
                </div>
              ) : (
                itens.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      {item.kind === "file" ? (
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className="text-sm truncate flex-1">
                        {item.kind === "file" ? item.filename : item.caption || item.external_url}
                      </p>
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

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        Entregar a quem comprou:
                      </span>
                      <select
                        value={item.applies_to}
                        onChange={(e) => mudarDestino(item, e.target.value as Destino)}
                        disabled={ocupado}
                        className="flex-1 h-7 text-xs rounded-md border border-border bg-background px-2"
                      >
                        {destinos.map((d) => (
                          <option key={d.valor} value={d.valor}>
                            {d.rotulo}
                          </option>
                        ))}
                        {!destinos.some((d) => d.valor === item.applies_to) && (
                          <option value={item.applies_to}>{nomeDestino(item.applies_to)}</option>
                        )}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Para quem é o proximo item */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label className="text-sm">Adicionar novo item — para quem é?</Label>
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value as Destino)}
                disabled={ocupado}
                className="w-full h-9 text-sm rounded-md border border-border bg-background px-2"
              >
                {destinos.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.rotulo}
                  </option>
                ))}
              </select>

              {destino === "main" ? (
                <p className="text-xs text-muted-foreground">
                  Vai para <strong>toda a gente</strong> que comprar este produto.
                </p>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-1">
                  <Check className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Só vai para quem <strong>pagou este order bump</strong>. Quem não pagou nunca o
                  recebe.
                </p>
              )}

              {destinos.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  Este produto ainda não tem order bumps. Cria um na edição do produto para poderes
                  entregar material só a quem o pagar.
                </p>
              )}

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
                Subir ficheiro
              </Button>
              <p className="text-xs text-muted-foreground">
                Até 45 MB. Para vídeos usa antes um link.
              </p>

              <div className="pt-1 space-y-2">
                <Input
                  value={urlNova}
                  onChange={(e) => setUrlNova(e.target.value)}
                  placeholder="https://... (link em alternativa)"
                  className="h-9 text-sm"
                />
                <Input
                  value={legendaNova}
                  onChange={(e) => setLegendaNova(e.target.value)}
                  placeholder="Descrição (opcional)"
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

            <p className="text-xs text-muted-foreground">
              Guarda sozinho — não há botão de gravar.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
