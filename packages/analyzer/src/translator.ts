export async function translateText(
  text: string,
  targetLanguage: "ko" | "en",
): Promise<string> {
  if (!text) {
    return text;
  }

  // Step 1 scaffold.
  return targetLanguage === "ko" || targetLanguage === "en" ? text : text;
}
