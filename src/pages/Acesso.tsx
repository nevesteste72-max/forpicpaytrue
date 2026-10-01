import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, ArrowRight, Info, AlertCircle } from "lucide-react";

interface Item {
  titulo: string;
  href: string;
  imagem: string | null;
  tipo: "file" | "link";
}

/**
 * "Conteúdos da sua compra" — a página onde o cliente aterra depois de pagar.
 *
 * Mostra EXATAMENTE o que foi comprado (produto principal, order bumps aceites
 * e upsells), nada mais. A lista vem da função meu-acesso, que valida contra a
 * base de dados; o browser nunca decide o que mostrar.
 */
export default function Acesso() {
  const { transactionId } = useParams<{ transactionId?: string }>();
  const [params] = useSearchParams();

  const tx =
    transactionId ||
    params.get("cashpay_tx") ||
    params.get("tx") ||
    "";

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([]);

  useEffect(() => {
    if (!tx) {
      setErro("Não encontrámos a referência da tua compra.");
      setCarregando(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meu-acesso?tx=${encodeURIComponent(tx)}`,
        );
        const d = await r.json();
        if (d?.error) setErro(d.error);
        else {
          setNome(d.nome ?? null);
          setItens(d.itens ?? []);
        }
      } catch {
        setErro("Não foi possível carregar os teus conteúdos.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [tx]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Cabeçalho */}
        <div className="rounded-t-xl bg-emerald-600 text-white text-center py-4 px-4">
          <h1 className="text-lg font-bold">Conteúdos da sua compra</h1>
          <p className="text-xs text-emerald-50 mt-0.5">
            {itens.length > 0
              ? "Seleciona um item para aceder"
              : "A tua compra está confirmada"}
          </p>
        </div>

        <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-4 space-y-3">
          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">{erro}</p>
            </div>
          )}

          {!erro && itens.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                O teu pagamento está confirmado, mas os conteúdos ainda não estão disponíveis aqui.
                Enviámos tudo também para o teu email e para o teu WhatsApp.
              </p>
            </div>
          )}

          {itens.map((item, i) => (
            <div
              key={`${item.titulo}-${i}`}
              className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm"
            >
              {item.imagem && (
                <img
                  src={item.imagem}
                  alt=""
                  className="w-16 h-16 object-contain mx-auto mb-2"
                  loading="lazy"
                />
              )}
              <p className="text-sm font-bold text-gray-900 mb-3">{item.titulo}</p>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ACESSAR CONTEÚDO
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}

          {itens.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 mt-4">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <strong>Importante:</strong> os links de acesso foram também enviados para o teu
                email e WhatsApp. Guarda-os num sítio seguro para acederes quando quiseres.
              </p>
            </div>
          )}
        </div>

        {nome && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Compra de {nome}
          </p>
        )}
      </div>
    </div>
  );
}
