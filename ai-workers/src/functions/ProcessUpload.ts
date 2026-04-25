import { app, InvocationContext } from "@azure/functions";
import prisma from "../shared/prisma";
import { extractText } from "../shared/extractor";
import { classifyFile } from "../shared/classifier";
import { generateEmbedding } from "../shared/embeddings";
import { computePerceptualHash, detectDuplicates } from "../shared/duplicate";

export async function ProcessUpload(
  blob: Buffer,
  context: InvocationContext,
): Promise<void> {
  // Extract path parts from trigger metadata
  const userId = context.triggerMetadata?.userId as string;
  const blobName = context.triggerMetadata?.blobName as string;
  const blobKey = `${userId}/${blobName}`;

  context.log(`🔄 Processing blob: ${blobKey} (${blob.length} bytes)`);

  // 1. Find matching DB record
  const file = await prisma.file.findFirst({
    where: { blobKey, processingStatus: "pending" },
  });

  if (!file) {
    context.log(`⚠️  No pending file found for blobKey: ${blobKey}`);
    return;
  }

  // 2. Mark as processing
  await prisma.file.update({
    where: { id: file.id },
    data: { processingStatus: "processing" },
  });

  try {
    const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);

    // 3. Extract text
    context.log("📄 Extracting text...");
    const extractedText = await extractText(buffer, file.mimeType);
    context.log(`   → ${extractedText.length} characters`);

    // 4. Classify
    context.log("🏷️  Classifying...");
    const category = await classifyFile(
      file.originalName,
      extractedText,
      file.mimeType,
    );
    context.log(`   → ${category}`);

    // 5. Generate embedding
    context.log("🧠 Generating embedding...");
    const embeddingInput = extractedText || file.originalName;
    const embedding = await generateEmbedding(embeddingInput);
    context.log(`   → ${embedding?.length ?? 0} dimensions`);

    // 6. Perceptual hash for images
    let pHash: string | null = null;
    if (file.mimeType.startsWith("image/")) {
      context.log("🖼️  Computing perceptual hash...");
      pHash = await computePerceptualHash(buffer);
    }

    // 7. Detect duplicates
    context.log("🔍 Checking for duplicates...");
    const duplicates = await detectDuplicates(
      file.id,
      file.ownerId,
      file.hash,
      pHash,
      file.mimeType,
    );
    context.log(`   → ${duplicates.length} duplicate(s)`);

    // 8. Update file record with all AI results
    await prisma.file.update({
      where: { id: file.id },
      data: {
        extractedText: extractedText || null,
        category,
        embedding: embedding ? JSON.stringify(embedding) : null,
        pHash,
        processingStatus: "done",
      },
    });

    // 9. Store duplicate relationships
    if (duplicates.length > 0) {
      await prisma.duplicateFile.createMany({
        data: duplicates.map((d) => ({
          fileId: file.id,
          duplicateOfId: d.id,
          duplicateType: d.duplicateType,
          similarity: d.similarity,
        })),
        skipDuplicates: true,
      });
    }

    context.log(`✅ Complete: "${file.name}" → ${category}`);
  } catch (err) {
    context.log.error(`❌ Processing failed: ${(err as Error).message}`);
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
