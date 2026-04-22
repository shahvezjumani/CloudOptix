import prisma from "../lib/prisma.js";
import {
  uploadToBlob,
  generateSasUrl,
  deleteFromBlob,
} from "./blob.service.js";
import { computeHash } from "../utils/hash.util.js";
import { ApiError } from "../utils/index.js";

export async function uploadFile(
  buffer,
  originalName,
  mimeType,
  sizeBytes,
  userId,
  folderId = null,
) {
  // 1. Compute hash for future duplicate detection
  const hash = computeHash(buffer);

  // 2. Upload to Azure Blob
  const { blobKey, url } = await uploadToBlob(buffer, mimeType, userId);

  // 3. Create DB record — status "pending" until Azure Function processes it
  const file = await prisma.file.create({
    data: {
      ownerId: userId,
      name: originalName,
      originalName: originalName,
      mimeType,
      sizeBytes: BigInt(sizeBytes),
      blobUrl: url,
      blobKey,
      hash,
      processingStatus: "pending",
      folderId, // null = root
    },
  });

  // 4. Update user's storage usage
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { increment: BigInt(sizeBytes) } },
  });

  // Convert BigInt before returning (JSON.stringify can't handle BigInt)
  return serializeFile(file);
}

// Upload multiple files — runs in parallel with Promise.allSettled
// allSettled (not Promise.all) means one failure won't abort the whole batch
export async function uploadMultipleFiles(files, userId, folderId = null) {
  const results = await Promise.allSettled(
    files.map((f) =>
      uploadFile(
        f.buffer,
        f.originalname,
        f.mimetype,
        f.size,
        userId,
        folderId,
      ),
    ),
  );

  const succeeded = [];
  const failed = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      succeeded.push(result.value);
    } else {
      failed.push({
        fileName: files[index].originalname,
        error: result.reason?.message || "Upload failed",
      });
    }
  });

  return { succeeded, failed };
}

export async function listFiles(
  userId,
  { page = 1, limit = 30, category, search } = {},
) {
  const skip = (page - 1) * limit;

  const where = {
    ownerId: userId,
    isDeleted: false,
    ...(category && { category }),
    ...(search && { name: { contains: search } }),
  };

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        category: true,
        processingStatus: true,
        createdAt: true,
        blobKey: true,
      },
    }),
    prisma.file.count({ where }),
  ]);

  return {
    files: files.map(serializeFile),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  };
}

export async function getFileById(fileId, userId) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
  });
  if (!file) throw new AppError("File not found", 404);
  return serializeFile(file);
}

export async function getDownloadUrl(fileId, userId) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
    select: { blobKey: true },
  });
  if (!file) throw new AppError("File not found", 404);
  return generateSasUrl(file.blobKey, 15); // 15-minute window
}

export async function softDeleteFile(fileId, userId) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
  });
  if (!file) throw new AppError("File not found", 404);

  await prisma.file.update({
    where: { id: fileId },
    data: { isDeleted: true },
  });

  // Reclaim storage
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { decrement: file.sizeBytes } },
  });
}

export async function updateFile(fileId, userId, { name, tags } = {}) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
  });
  if (!file) throw new AppError("File not found", 404);

  // Replace tags: delete all existing, insert new ones
  const updated = await prisma.$transaction(async (tx) => {
    if (tags !== undefined) {
      await tx.fileTag.deleteMany({ where: { fileId } });
      if (tags.length > 0) {
        await tx.fileTag.createMany({
          data: tags.map((tag) => ({ fileId, tag })),
        });
      }
    }
    return tx.file.update({
      where: { id: fileId },
      data: { ...(name && { name }) },
      include: { tags: true },
    });
  });

  return serializeFile(updated);
}

export async function getVersions(fileId, userId) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
  });
  if (!file) throw new AppError("File not found", 404);

  const versions = await prisma.fileVersion.findMany({
    where: { fileId },
    orderBy: { version: "desc" },
  });
  return versions.map(serializeFile);
}

export async function restoreVersion(fileId, version, userId) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
  });
  if (!file) throw new AppError("File not found", 404);

  const targetVersion = await prisma.fileVersion.findFirst({
    where: { fileId, version: parseInt(version) },
  });
  if (!targetVersion) throw new AppError("Version not found", 404);

  // Save current state as a new version before restoring
  const latest = await prisma.fileVersion.findFirst({
    where: { fileId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.fileVersion.create({
      data: {
        fileId,
        version: nextVersion,
        blobKey: file.blobKey,
        sizeBytes: file.sizeBytes,
      },
    }),
    prisma.file.update({
      where: { id: fileId },
      data: {
        blobKey: targetVersion.blobKey,
        sizeBytes: targetVersion.sizeBytes,
      },
    }),
  ]);

  return getFileById(fileId, userId);
}

// BigInt can't be JSON serialized — convert to string/number
function serializeFile(file) {
  return {
    ...file,
    sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : undefined,
  };
}
