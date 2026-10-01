import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical } from "lucide-react";

/**
 * Aviso fixo no topo, visível em toda a plataforma E no checkout, sempre que a
 * Stripe estiver em modo de teste. Existe para que ninguém se esqueça de que
 * naquele momento nenhuma venda está a cobrar dinheiro a sério.
 *
 * A fonte da verdade é a função get-stripe-key, que já devolve o modo e é
 * pública — por isso funciona tanto no painel como numa página de pagamento
 * aberta por um visitante.
 */
export function TestModeBanner() {
  const [emTeste, setEmTeste] = useState(false);

  useEffect(() => {
    let vivo = true;

    const verificar = async () => {
      try {
        const { data } = await supabase.functions.invoke("get-stripe-key", { body: {} });
        if (vivo) setEmTeste(data?.mode === "test");
      } catch {
        // Falha a verificar não deve partir a página; assume-se produção.
        if (vivo) setEmTeste(false);
      }
    };

    verificar();
    // Reconfirma de minuto a minuto, para a barra aparecer/desaparecer sem
    // ser preciso recarregar a página depois de trocar de modo.
    const t = setInterval(verificar, 60000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  if (!emTeste) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 shadow-md">
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-center">
          <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-bold tracking-wide uppercase">
            Modo de teste — nenhum pagamento é cobrado a sério
          </span>
        </div>
      </div>
      {/* Empurra o conteúdo para baixo, para a barra não tapar nada. */}
      <div aria-hidden className="h-[30px]" />
    </>
  );
}
