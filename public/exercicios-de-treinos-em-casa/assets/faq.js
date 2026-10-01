/**
 * Abre e fecha as perguntas frequentes.
 *
 * A pagina foi copiada do site original, que servia esta logica dentro de um
 * bundle que tambem enviava o tracking dele para api.checkpay.me. Aqui so
 * queremos o acordeao, por isso ficou reescrito em vez de reaproveitado.
 *
 * A altura e medida no momento do clique (scrollHeight) e nao fixada no CSS,
 * porque as respostas tem comprimentos diferentes e mudam de altura quando o
 * texto quebra noutro tamanho de ecra.
 */
const perguntas = Array.from(document.querySelectorAll(".faq-item"));

function fechar(item) {
  const caixa = item.querySelector(".faq-content-wrapper");
  const texto = item.querySelector(".faq-content");
  const icone = item.querySelector(".faq-icon");
  if (caixa) caixa.style.maxHeight = null;
  if (texto) texto.classList.replace("opacity-100", "opacity-0");
  if (icone) icone.classList.remove("rotate-180");
}

perguntas.forEach((item) => {
  const botao = item.querySelector(".faq-button");
  const caixa = item.querySelector(".faq-content-wrapper");
  const texto = item.querySelector(".faq-content");
  const icone = item.querySelector(".faq-icon");
  if (!botao || !caixa || !texto) return;

  botao.addEventListener("click", () => {
    const estavaAberta = Boolean(caixa.style.maxHeight);

    // Só uma aberta de cada vez: a lista fica curta e fácil de percorrer.
    perguntas.forEach(fechar);

    if (!estavaAberta) {
      caixa.style.maxHeight = texto.scrollHeight + "px";
      texto.classList.replace("opacity-0", "opacity-100");
      if (icone) icone.classList.add("rotate-180");
    }
  });
});
