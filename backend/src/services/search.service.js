import prisma from "../lib/prisma.js";
import { generateEmbedding, cosineSimilarity } from "../utils/embeddings.js";

export async function semanticSearch(query, userId) {
  // 1. Embed the search query using same function as ai-workers
  const queryEmbedding = generateEmbedding(query);

  if (!queryEmbedding.length) {
    return metadataSearch(query, userId);
  }

  // 2. Pull all processed files that have embeddings
  const files = await prisma.file.findMany({
    where: {
      ownerId: userId,
      isDeleted: false,
      processingStatus: "done",
      embedding: { not: null },
    },
    select: {
      id: true,
      name: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      folderId: true,
      createdAt: true,
      embedding: true,
      extractedText: true,
    },
  });

  // 3. Score each file by cosine similarity
  const scored = files
    .map((file) => {
      const fileEmbedding = JSON.parse(file.embedding);
      const score = cosineSimilarity(queryEmbedding, fileEmbedding);
      return {
        ...file,
        embedding: undefined, // don't send vector to client
        extractedText: undefined, // don't send full text to client
        sizeBytes: Number(file.sizeBytes),
        score: Math.round(score * 100), // as percentage
      };
    })
    .filter((f) => f.score > 20) // minimum 20% relevance
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // top 20 results

  // Fallback to metadata search if no semantic results
  if (scored.length === 0) {
    return metadataSearch(query, userId);
  }

  return scored;
}

export async function metadataSearch(query, userId) {
  const files = await prisma.file.findMany({
    where: {
      ownerId: userId,
      isDeleted: false,
      OR: [
        { name: { contains: query } },
        { category: { contains: query } },
        { extractedText: { contains: query } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      folderId: true,
      createdAt: true,
    },
  });

  return files.map((f) => ({
    ...f,
    sizeBytes: Number(f.sizeBytes),
    score: null, // no score for metadata search
  }));
}

export async function getDuplicates(userId) {
  const duplicates = await prisma.duplicateFile.findMany({
    where: {
      file: { ownerId: userId, isDeleted: false },
    },
    include: {
      file: {
        select: {
          id: true,
          name: true,
          sizeBytes: true,
          createdAt: true,
          category: true,
          mimeType: true,
        },
      },
      duplicateOf: {
        select: {
          id: true,
          name: true,
          sizeBytes: true,
          createdAt: true,
          category: true,
          mimeType: true,
        },
      },
    },
    orderBy: { similarity: "desc" },
  });

  return duplicates.map((d) => ({
    id: d.id,
    type: d.duplicateType,
    similarity: d.similarity,
    file: {
      ...d.file,
      sizeBytes: Number(d.file.sizeBytes),
    },
    duplicateOf: {
      ...d.duplicateOf,
      sizeBytes: Number(d.duplicateOf.sizeBytes),
    },
  }));
}

export async function getOptimizationSuggestions(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Large files older than 30 days
  const largeOldFiles = await prisma.file.findMany({
    where: {
      ownerId: userId,
      isDeleted: false,
      sizeBytes: { gt: BigInt(10 * 1024 * 1024) }, // > 10MB
      createdAt: { lt: thirtyDaysAgo },
    },
    select: {
      id: true,
      name: true,
      sizeBytes: true,
      category: true,
      createdAt: true,
    },
    orderBy: { sizeBytes: "desc" },
    take: 10,
  });

  // Uncategorized files
  const uncategorized = await prisma.file.findMany({
    where: {
      ownerId: userId,
      isDeleted: false,
      OR: [{ category: null }, { category: "Other" }],
    },
    select: {
      id: true,
      name: true,
      sizeBytes: true,
      createdAt: true,
    },
    take: 20,
  });

  // Failed processing
  const failedFiles = await prisma.file.findMany({
    where: {
      ownerId: userId,
      isDeleted: false,
      processingStatus: "failed",
    },
    select: {
      id: true,
      name: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return {
    largeOldFiles: largeOldFiles.map((f) => ({
      ...f,
      sizeBytes: Number(f.sizeBytes),
      suggestion: "Consider moving to cold storage",
    })),
    uncategorized: uncategorized.map((f) => ({
      ...f,
      sizeBytes: Number(f.sizeBytes),
      suggestion: "Could not be auto-categorized",
    })),
    failedFiles: failedFiles.map((f) => ({
      ...f,
      sizeBytes: Number(f.sizeBytes),
      suggestion: "AI processing failed — try re-uploading",
    })),
  };
}
