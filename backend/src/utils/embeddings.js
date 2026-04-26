// Local embedding — matches ai-workers/src/shared/embeddings.ts
// Swap this function body when Azure OpenAI access arrives

export function generateEmbedding(text) {
  if (!text?.trim()) return [];

  const DIMS = 512;
  const vector = new Array(DIMS).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % DIMS;
    }
    vector[Math.abs(hash)] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  return magnitude === 0 ? vector : vector.map((v) => v / magnitude);
}

export function cosineSimilarity(vecA, vecB) {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;

  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}
