import crypto from "crypto";

export function computeHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
