import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, Phone, Mail, Receipt, ArrowRight, AlertCircle } from "lucide-react";
import { guardarUltimaCompra, lerUltimaCompra } from "@/lib/ultimaCompra";

/**
 * Fim do funil: confirma a compra e encaminha para os conteúdos.
 *
 * A página de obrigado que já existia (ThankYouPage) é a dos produtos físicos
 * da África do Sul — fala de armazém, estafeta e prazos de entrega, em inglês.
 * Não serve para um produto que se recebe na hora, por isso esta é separada.
 *
 * Mostra só o que o cliente precisa de reconhecer como seu: a referência da
 * compra, o telefone que escreveu (é obrigatório no checkout) e o email. Se
 * algum deles não existir, não se inventa nem se deixa um espaço vazio — a
 * caixa simplesmente não aparece.
 */

interface Dados {
  pago: boolean;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  referencia: string | null;
  total: number;
  erro?: string;
}

export default function Obrigado() {
  const { transactionId } = useParams<{ transactionId?: string }>();
  const [params] = useSearchParams();

  const txDoEndereco =
    transactionId ||
    params.get("cashpay_tx") ||
    params.get("tx") ||
    "";

  const tx = txDoEndereco || lerUltimaCompra();

  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    if (!tx) {
      setCarregando(false);
      return;
    }
    guardarUltimaCompra(tx);
    (async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meu-acesso?tx=${encodeURIComponent(tx)}`,
        );
        setDados(await r.json());
      } catch {
        setDados(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, [tx]);

  const irParaOsProdutos = () => {
    window.location.href = tx
      ? `/acesso?cashpay_tx=${encodeURIComponent(tx)}`
      : "/acesso";
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const pago = Boolean(dados?.pago);

  return (
    <div className="min-h-screen bg-[#f4f5f7] py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Cabeçalho */}
          <div
            className={`px-6 py-8 text-center text-white ${
              pago
                ? "bg-gradient-to-b from-emerald-500 to-emerald-700"
                : "bg-gradient-to-b from-amber-400 to-amber-600"
            }`}
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              {pago ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              ) : (
                <AlertCircle className="w-10 h-10 text-amber-600" />
              )}
            </div>
            <h1 className="text-2xl font-bold">
              {pago ? "Pagamento aprovado!" : "Pagamento por confirmar"}
            </h1>
            <p className="text-sm text-white/90 mt-1">
              {pago
                ? "A tua compra foi concluída com sucesso"
                : "Ainda não confirmámos este pagamento"}
            </p>
          </div>

          <div className="p-5 space-y-3">
            {pago ? (
              <>
                {dados?.referencia && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-1">
                      <Receipt className="w-4 h-4" />
                      <span>Pedido</span>
                    </div>
                    <p className="font-bold text-slate-900 tracking-wide">
                      {dados.referencia}
                    </p>
                  </div>
                )}

                {dados?.telefone && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-emerald-700 text-sm mb-1">
                      <Phone className="w-4 h-4" />
                      <span>Número de telefone</span>
                    </div>
                    <p className="font-bold text-slate-900">{dados.telefone}</p>
                  </div>
                )}

                {dados?.email && (
                  <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-violet-700 text-sm mb-1">
                      <Mail className="w-4 h-4" />
                      <span>Email</span>
                    </div>
                    <p className="font-semibold text-slate-900 break-all">
                      {dados.email}
                    </p>
                  </div>
                )}

                <button
                  onClick={irParaOsProdutos}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors text-white font-bold py-4 mt-2"
                >
                  Aceder aos produtos da compra
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-center text-xs text-slate-500 pt-1">
                  Enviámos também o acesso para o teu email.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    {dados?.erro ??
                      "Não encontrámos a referência da tua compra. Se já pagaste, usa o link que recebeste no email."}
                  </p>
                </div>
                <button
                  onClick={irParaOsProdutos}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-900 transition-colors text-white font-semibold py-3"
                >
                  Ver os meus produtos
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
