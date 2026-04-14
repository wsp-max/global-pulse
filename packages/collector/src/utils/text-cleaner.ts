const HTML_ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&quot;": '"',
  "&#34;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeHtmlEntities(input: string): string {
  const namedDecoded = input.replace(
    /&(?:nbsp|quot|apos|amp|lt|gt|#34|#39);/gi,
    (entity) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? entity,
  );

  return namedDecoded
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function normalizeUrlSpacing(input: string): string {
  return input
    .replace(/https?:\s*\/\/\s*/gi, (match) =>
      match.toLowerCase().startsWith("https") ? "https://" : "http://",
    )
    .replace(/www\.\s*/gi, "www.");
}

export function cleanText(input: string | undefined | null): string {
  if (!input) return "";
  return normalizeUrlSpacing(
    decodeHtmlEntities(input)
      .replace(/<[^>]*>/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function cleanUrl(input: string | undefined | null): string {
  if (!input) return "";
  return normalizeUrlSpacing(decodeHtmlEntities(input)).replace(/\s+/g, "").trim();
}

