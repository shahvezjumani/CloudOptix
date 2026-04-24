import prisma from "../lib/prisma.js";
import { ApiError } from "../utils/index.js";

export async function createFolder(name, userId, parentId = null) {
  // Validate parentId belongs to this user if provided
  if (parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, ownerId: userId, isDeleted: false },
    });
    if (!parent) throw new AppError("Parent folder not found", 404);
  }

  return prisma.folder.create({
    data: { name, ownerId: userId, parentId },
  });
}

export async function listFolderContents(userId, folderId = null) {
  // folderId = null means root level
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId: userId, parentId: folderId, isDeleted: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true, createdAt: true },
    }),
    prisma.file.findMany({
      where: { ownerId: userId, folderId: folderId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        category: true,
        processingStatus: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    folders,
    files: files.map((f) => ({ ...f, sizeBytes: Number(f.sizeBytes) })),
    currentFolderId: folderId,
  };
}

export async function renameFolder(folderId, userId, newName) {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, ownerId: userId, isDeleted: false },
  });
  if (!folder) throw new AppError("Folder not found", 404);

  return prisma.folder.update({
    where: { id: folderId },
    data: { name: newName },
  });
}

export async function deleteFolder(folderId, userId) {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, ownerId: userId, isDeleted: false },
  });
  if (!folder) throw new AppError("Folder not found", 404);

  // Soft delete the folder and all files inside it recursively
  await softDeleteFolderRecursive(folderId, userId);
}

async function softDeleteFolderRecursive(folderId, userId) {
  // Get all child folders
  const children = await prisma.folder.findMany({
    where: { parentId: folderId, isDeleted: false },
    select: { id: true },
  });

  // Recurse into children first
  for (const child of children) {
    await softDeleteFolderRecursive(child.id, userId);
  }

  // Soft delete all files in this folder
  const files = await prisma.file.findMany({
    where: { folderId, isDeleted: false },
    select: { id: true, sizeBytes: true },
  });

  if (files.length > 0) {
    const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, BigInt(0));

    await prisma.file.updateMany({
      where: { folderId },
      data: { isDeleted: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { decrement: totalSize } },
    });
  }

  // Soft delete the folder itself
  await prisma.folder.update({
    where: { id: folderId },
    data: { isDeleted: true },
  });
}

export async function moveFile(fileId, targetFolderId, userId) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, ownerId: userId, isDeleted: false },
  });
  if (!file) throw new AppError("File not found", 404);

  if (targetFolderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: targetFolderId, ownerId: userId, isDeleted: false },
    });
    if (!folder) throw new AppError("Target folder not found", 404);
  }

  return prisma.file.update({
    where: { id: fileId },
    data: { folderId: targetFolderId },
  });
}
