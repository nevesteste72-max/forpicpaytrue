import { describe, it, expect } from "vitest";
import { suggestEmail } from "@/lib/emailSuggest";

describe("suggestEmail", () => {
  it("corrige erros de dedo no dominio", () => {
    expect(suggestEmail("julio@gmial.com")).toBe("julio@gmail.com");
    expect(suggestEmail("julio@gmail.con")).toBe("julio@gmail.com");
    expect(suggestEmail("julio@hotmai.com")).toBe("julio@hotmail.com");
    expect(suggestEmail("ana@sapo.ptt")).toBe("ana@sapo.pt");
  });
  it("completa prefixos inequivocos", () => {
    expect(suggestEmail("julio@gm")).toBe("julio@gmail.com");
    expect(suggestEmail("julio@hotm")).toBe("julio@hotmail.com");
  });
  it("nao adivinha quando nao ha dominio", () => {
    expect(suggestEmail("julio@")).toBeNull();
    expect(suggestEmail("julio")).toBeNull();
    expect(suggestEmail("")).toBeNull();
  });
  it("nao sugere nada para dominios ja corretos ou desconhecidos", () => {
    expect(suggestEmail("julio@gmail.com")).toBeNull();
    expect(suggestEmail("geral@empresa-qualquer.pt")).toBeNull();
    expect(suggestEmail("ivan@tecnhogar.store")).toBeNull();
  });
});
