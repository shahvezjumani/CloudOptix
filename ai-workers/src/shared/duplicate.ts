import crypto from "crypto";
import sharp from "sharp";
import prisma from "./prisma";

export function computeHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function computePerceptualHash(
  buffer: Buffer,
): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const avg =
      data.reduce((sum: number, val: number) => sum + val, 0) / data.length;
    let hash = "";
    for (const pixel of data) hash += pixel >= avg ? "1" : "0";
    return hash;
  } catch (err) {
    console.error("pHash failed:", (err as Error).message);
    return null;
  }
}

function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export interface DuplicateResult {
  id: string;
  name: string;
  createdAt: Date;
  duplicateType: "exact" | "visual";
  similarity: number;
}

export async function detectDuplicates(
  fileId: string,
  ownerId: string,
  hash: string | null,
  pHash: string | null,
  mimeType: string,
): Promise<DuplicateResult[]> {
  const duplicates: DuplicateResult[] = [];

  // Exact match
  if (hash) {
    const exact = await prisma.file.findMany({
      where: { ownerId, hash, id: { not: fileId }, isDeleted: false },
      select: { id: true, name: true, createdAt: true },
    });
    duplicates.push(
      ...exact.map((f) => ({
        ...f,
        duplicateType: "exact" as const,
        similarity: 100,
      })),
    );
  }

  // Visual match — pHash now exists in schema after migration
  if (pHash && mimeType.startsWith("image/")) {
    const others = await prisma.file.findMany({
      where: {
        ownerId,
        mimeType: { startsWith: "image/" },
        id: { not: fileId },
        isDeleted: false,
        pHash: { not: null }, // ✓ now valid after migration
      },
      select: { id: true, name: true, pHash: true, createdAt: true },
    });

    for (const img of others) {
      if (!img.pHash) continue;
      const distance = hammingDistance(pHash, img.pHash);
      if (distance <= 10) {
        duplicates.push({
          id: img.id,
          name: img.name,
          createdAt: img.createdAt,
          duplicateType: "visual",
          similarity: Math.round(((64 - distance) / 64) * 100),
        });
      }
    }
  }

  return duplicates;
}
