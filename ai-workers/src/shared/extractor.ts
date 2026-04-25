import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text?.trim() ?? "";
  } catch (err) {
    console.error("PDF extraction failed:", (err as Error).message);
    return "";
  }
}

export async function extractImageText(buffer: Buffer): Promise<string> {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(buffer, "eng", {
      logger: () => {}, // suppress verbose progress logs
    });
    return text?.trim() ?? "";
  } catch (err) {
    console.error("OCR failed:", (err as Error).message);
    return "";
  }
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (mimeType.startsWith("image/")) {
    return extractImageText(buffer);
  }

  if (mimeType === "text/plain") {
    return buffer.toString("utf-8").trim();
  }

  // Word docs, etc. — return empty for now, extend later
  return "";
}
