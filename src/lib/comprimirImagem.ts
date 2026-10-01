/**
 * Converte uma imagem para WebP no próprio browser, antes de a enviar.
 *
 * As capas de produto vinham em PNG de 2 a 3 MB e batiam no limite de upload.
 * Em WebP ficam à volta de 150 KB com a mesma qualidade visível — é melhor
 * encolher o ficheiro do que subir o limite, porque imagens pesadas atrasam
 * o checkout e é aí que se perdem vendas.
 *
 * Se algo correr mal (formato estranho, browser antigo), devolve o ficheiro
 * original: mais vale enviar pesado do que não enviar nada.
 */
export async function comprimirImagem(
  ficheiro: File,
  opcoes: { larguraMax?: number; qualidade?: number } = {},
): Promise<File> {
  const { larguraMax = 1200, qualidade = 0.82 } = opcoes;

  if (!ficheiro.type.startsWith("image/")) return ficheiro;
  // SVG e GIF não ganham nada e perderiam animação/vetor.
  if (ficheiro.type === "image/svg+xml" || ficheiro.type === "image/gif") return ficheiro;

  try {
    const bitmap = await createImageBitmap(ficheiro);

    let { width, height } = bitmap;
    const maior = Math.max(width, height);
    if (maior > larguraMax) {
      const f = larguraMax / maior;
      width = Math.round(width * f);
      height = Math.round(height * f);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return ficheiro;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", qualidade),
    );
    if (!blob || blob.size === 0) return ficheiro;

    // Se por acaso não encolheu, fica o original.
    if (blob.size >= ficheiro.size) return ficheiro;

    const nome = ficheiro.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], nome, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return ficheiro;
  }
}
