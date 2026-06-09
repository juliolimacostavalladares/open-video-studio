export interface MetadataFields {
  title: string;
  description: string | null;
  tagsString: string;
}

export interface ValidationErrors {
  title?: string;
  tags?: string;
}

export function validateMetadata(fields: MetadataFields): {
  isValid: boolean;
  errors: ValidationErrors;
  parsed: {
    title: string;
    description: string | null;
    tags: string[];
  };
} {
  const errors: ValidationErrors = {};
  const trimmedTitle = fields.title.trim();

  if (!trimmedTitle) {
    errors.title = "O título não pode ser vazio";
  }

  // Parse tags by splitting with commas
  const tagsArray = fields.tagsString
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  // Simple validation for tags: alphanumeric characters, spaces, hyphens, and underscores only
  const invalidTag = tagsArray.find(
    (t) => !/^[a-zA-Z0-9\u00C0-\u00FF\s\-_]+$/.test(t),
  );
  if (invalidTag) {
    errors.tags =
      "As tags devem conter apenas letras, números, espaços ou hífens/sublinhados";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    parsed: {
      title: trimmedTitle,
      description:
        fields.description && fields.description.trim() !== ""
          ? fields.description.trim()
          : null,
      tags: tagsArray,
    },
  };
}
