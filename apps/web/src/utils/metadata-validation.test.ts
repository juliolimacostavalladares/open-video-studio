import { describe, it, expect } from "vitest";
import { validateMetadata } from "./metadata-validation";

describe("validateMetadata", () => {
  it("should validate and parse correct metadata", () => {
    const fields = {
      title: "  Projeto Bacana  ",
      description: "  Uma descrição qualquer  ",
      tagsString: "tecnologia, inovação , IA",
    };

    const result = validateMetadata(fields);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.parsed.title).toBe("Projeto Bacana");
    expect(result.parsed.description).toBe("Uma descrição qualquer");
    expect(result.parsed.tags).toEqual(["tecnologia", "inovação", "IA"]);
  });

  it("should fail validation if title is empty", () => {
    const fields = {
      title: "   ",
      description: null,
      tagsString: "",
    };

    const result = validateMetadata(fields);

    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe("O título não pode ser vazio");
  });

  it("should fail validation if tags contain invalid characters", () => {
    const fields = {
      title: "Título Válido",
      description: null,
      tagsString: "tecnologia, tag@invalida, ok",
    };

    const result = validateMetadata(fields);

    expect(result.isValid).toBe(false);
    expect(result.errors.tags).toBe(
      "As tags devem conter apenas letras, números, espaços ou hífens/sublinhados",
    );
  });

  it("should handle empty description and empty tags correctly", () => {
    const fields = {
      title: "Título Válido",
      description: "   ",
      tagsString: "",
    };

    const result = validateMetadata(fields);

    expect(result.isValid).toBe(true);
    expect(result.parsed.description).toBeNull();
    expect(result.parsed.tags).toEqual([]);
  });
});
