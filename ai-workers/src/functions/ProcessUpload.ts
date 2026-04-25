import { app, InvocationContext } from "@azure/functions";
import prisma from "../shared/prisma";
import { extractContent } from "../shared/extractor";
import { classifyFile } from "../shared/classifier";
import { generateEmbedding } from "../shared/embeddings";
import { computePerceptualHash, detectDuplicates } from "../shared/duplicate";

export async function ProcessUpload(
  blob: Buffer,
  context: InvocationContext,
): Promise<void> {
  const userId = context.triggerMetadata?.userId as string;
  const blobName = context.triggerMetadata?.blobName as string;
  const blobKey = `${userId}/${blobName}`;

  context.log(`🔄 Processing: ${blobKey} (${blob.length} bytes)`);

  const file = await prisma.file.findFirst({
    where: { blobKey, processingStatus: "pending" },
  });

  if (!file) {
    context.log(`⚠️  No pending file found for: ${blobKey}`);
    return;
  }

  await prisma.file.update({
    where: { id: file.id },
    data: { processingStatus: "processing" },
  });

  try {
    const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);

    // 1. Extract content using appropriate Azure service
    context.log("📄 Extracting content...");
    const { extractedText, description, tags } = await extractContent(
      buffer,
      file.mimeType,
    );
    context.log(
      `   → text: ${extractedText.length} chars | desc: "${description}" | tags: [${tags.join(", ")}]`,
    );

    // 2. Classify using Language Service + keywords
    context.log("🏷️  Classifying...");
    const category = await classifyFile(
      file.originalName,
      extractedText,
      description,
      tags,
      file.mimeType,
    );
    context.log(`   → ${category}`);

    // 3. Generate embedding (local until OpenAI available)
    context.log("🧠 Generating embedding...");
    const embeddingInput = [
      extractedText,
      description,
      ...tags,
      file.originalName,
    ]
      .filter(Boolean)
      .join(" ");
    const embedding = generateEmbedding(embeddingInput);
    context.log(`   → ${embedding.length} dimensions`);

    // 4. Perceptual hash for images
    let pHash: string | null = null;
    if (file.mimeType.startsWith("image/")) {
      context.log("🖼️  Computing perceptual hash...");
      pHash = await computePerceptualHash(buffer);
    }

    // 5. Detect duplicates
    context.log("🔍 Detecting duplicates...");
    const duplicates = await detectDuplicates(
      file.id,
      file.ownerId,
      file.hash,
      pHash,
      file.mimeType,
    );
    context.log(`   → ${duplicates.length} duplicate(s)`);

    // 6. Save everything to DB
    await prisma.file.update({
      where: { id: file.id },
      data: {
        extractedText: extractedText || null,
        category,
        embedding: embedding.length ? JSON.stringify(embedding) : null,
        pHash,
        processingStatus: "done",
      },
    });

    // 7. Save duplicate records
    if (duplicates.length > 0) {
      for (const d of duplicates) {
        await prisma.duplicateFile.upsert({
          where: {
            fileId_duplicateOfId: {
              fileId: file.id,
              duplicateOfId: d.id,
            },
          },
          update: {
            similarity: d.similarity,
            duplicateType: d.duplicateType,
          },
          create: {
            fileId: file.id,
            duplicateOfId: d.id,
            duplicateType: d.duplicateType,
            similarity: d.similarity,
          },
        });
      }
    }

    context.log(`✅ Done: "${file.name}" → ${category}`);
  } catch (err) {
    context.error(`❌ Failed: ${(err as Error).message}`);
    await prisma.file.update({
      where: { id: file.id },
      data: { processingStatus: "failed" },
    });
  }
}

app.storageBlob("ProcessUpload", {
  path: "user-files/{userId}/{blobName}",
  connection: "AZURE_STORAGE_CONNECTION",
  handler: ProcessUpload,
});
