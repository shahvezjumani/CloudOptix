import openai from "./openai";

const CATEGORIES = [
  "Finance",
  "Legal",
  "Medical",
  "Travel",
  "Work",
  "Education",
  "Personal",
  "Photos",
  "Videos",
  "Other",
] as const;

type Category = (typeof CATEGORIES)[number];

export async function classifyFile(
  fileName: string,
  extractedText: string,
  mimeType: string,
): Promise<Category> {
  // Fast rule-based path — no API call needed
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext) && !extractedText) {
    return "Photos";
  }
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) {
    return "Videos";
  }
  if (!extractedText || extractedText.length < 20) {
    return "Other";
  }

  // Truncate to save tokens — first 1000 chars is enough
  const textSample = extractedText.substring(0, 1000);

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!,
      messages: [
        {
          role: "system",
          content: `You are a file classification assistant.
Classify the file into exactly ONE of these categories: ${CATEGORIES.join(", ")}.
Respond with ONLY the category name, nothing else.`,
        },
        {
          role: "user",
          content: `File name: ${fileName}\n\nContent preview:\n${textSample}`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const category = response.choices[0]?.message?.content?.trim() as Category;
    return CATEGORIES.includes(category) ? category : "Other";
  } catch (err) {
    console.error("Classification failed:", (err as Error).message);
    return "Other";
  }
}
