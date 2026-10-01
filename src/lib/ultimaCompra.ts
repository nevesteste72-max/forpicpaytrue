/**
 * Guarda no navegador a referência da última compra deste visitante.
 *
 * A página de acesso precisa da referência da compra para saber o que mostrar.
 * Ela vem no endereço, mas perde-se facilmente: o cliente fecha o separador e
 * volta mais tarde, escreve /acesso à mão, chega por um atalho, ou um passo do
 * funil encaminha para lá sem a levar. Nesses casos a página abria vazia, mesmo
 * com o pagamento feito — parecia que a compra se tinha perdido.
 *
 * Guardar aqui não dá acesso a nada por si: a função meu-acesso confirma o
 * pagamento no servidor antes de devolver qualquer conteúdo. É o mesmo alcance
 * de uma sessão — só vale no navegador onde a compra foi feita.
 */

const CHAVE = "cashpay_ultima_compra";

const PARECE_REFERENCIA =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function guardarUltimaCompra(tx?: string | null): void {
  if (!tx || !PARECE_REFERENCIA.test(tx)) return;
  try {
    localStorage.setItem(CHAVE, tx);
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue sem guardar.
  }
}

export function lerUltimaCompra(): string {
  try {
    const guardado = localStorage.getItem(CHAVE) ?? "";
    return PARECE_REFERENCIA.test(guardado) ? guardado : "";
  } catch {
    return "";
  }
}
