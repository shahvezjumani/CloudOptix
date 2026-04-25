import openai from "./openai";

export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  if (!text?.trim()) return null;

  // Embedding model has token limit — truncate safely
  const truncated = text.substring(0, 8000);

  try {
    const response = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
      input: truncated,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error("Embedding failed:", (err as Error).message);
    return null;
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}
