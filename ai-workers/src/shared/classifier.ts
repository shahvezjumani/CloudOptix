import { languageClient } from "./clients";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Finance: [
    "invoice",
    "receipt",
    "payment",
    "bank",
    "tax",
    "salary",
    "budget",
    "expense",
  ],
  Legal: [
    "contract",
    "agreement",
    "legal",
    "court",
    "attorney",
    "lawsuit",
    "terms",
  ],
  Medical: [
    "prescription",
    "diagnosis",
    "doctor",
    "hospital",
    "patient",
    "medicine",
  ],
  Travel: [
    "flight",
    "hotel",
    "booking",
    "passport",
    "visa",
    "itinerary",
    "ticket",
  ],
  Work: [
    "meeting",
    "project",
    "report",
    "presentation",
    "proposal",
    "deadline",
  ],
  Education: [
    "assignment",
    "course",
    "lecture",
    "grade",
    "university",
    "exam",
    "thesis",
  ],
  Personal: [
    "diary",
    "journal",
    "personal",
    "family",
    "birthday",
    "wedding",
    "letter",
  ],
};

function keywordScore(text: string): { category: string; score: number } {
  const lower = text.toLowerCase();
  let best = { category: "Other", score: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > best.score) best = { category, score };
  }

  return best;
}

export async function classifyFile(
  fileName: string,
  extractedText: string,
  description: string,
  tags: string[],
  mimeType: string,
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext) && !extractedText) {
    if (tags.some((t) => ["receipt", "invoice", "money"].includes(t)))
      return "Finance";
    if (tags.some((t) => ["map", "airplane", "passport"].includes(t)))
      return "Travel";
    return "Photos";
  }

  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "Videos";

  const combinedText = [fileName, extractedText, description, ...tags]
    .filter(Boolean)
    .join(" ");

  if (!combinedText.trim()) return "Other";

  const keywordResult = keywordScore(combinedText);
  if (keywordResult.score >= 2) return keywordResult.category;

  // Language Service — extractKeyPhrases (correct V2 SDK method)
  try {
    const results = await languageClient.analyze("KeyPhraseExtraction", [
      { id: "1", language: "en", text: combinedText.substring(0, 5000) },
    ]);

    const keyPhrases = ((results[0] as any).keyPhrases as string[]) ?? [];
    const phraseText = keyPhrases.join(" ");
    const phraseResult = keywordScore(phraseText);

    return phraseResult.score > 0
      ? phraseResult.category
      : keywordResult.category !== "Other"
        ? keywordResult.category
        : "Other";
  } catch (err) {
    console.error("Language Service failed:", (err as Error).message);
    return keywordResult.category;
  }
}
