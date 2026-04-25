import { documentClient, visionClient } from "./clients";

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  try {
    // Pass buffer directly — no contentType option needed
    const poller = await documentClient.beginAnalyzeDocument(
      "prebuilt-read",
      buffer,
    );

    const result = await poller.pollUntilDone();
    return result.content?.trim() ?? "";
  } catch (err) {
    console.error("Document Intelligence failed:", (err as Error).message);
    return "";
  }
}

export interface ImageAnalysisResult {
  extractedText: string;
  description: string;
  tags: string[];
}

export async function analyzeImage(
  buffer: Buffer,
): Promise<ImageAnalysisResult> {
  try {
    const result = await visionClient.path("/imageanalysis:analyze").post({
      body: buffer,
      queryParameters: {
        features: ["Caption", "Read", "Tags"],
        language: "en",
      },
      contentType: "application/octet-stream",
    });

    const body = result.body as any;

    const extractedText =
      body.readResult?.blocks
        ?.flatMap((block: any) => block.lines)
        ?.map((line: any) => line.text)
        ?.join("\n") ?? "";

    const description = body.captionResult?.text ?? "";

    const tags =
      body.tagsResult?.values
        ?.filter((t: any) => t.confidence > 0.7)
        ?.map((t: any) => t.name) ?? [];

    return { extractedText, description, tags };
  } catch (err) {
    console.error("Vision analysis failed:", (err as Error).message);
    return { extractedText: "", description: "", tags: [] };
  }
}

export interface ExtractionResult {
  extractedText: string;
  description: string;
  tags: string[];
}

export async function extractContent(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const text = await extractDocumentText(buffer, mimeType);
    return { extractedText: text, description: "", tags: [] };
  }

  if (mimeType.startsWith("image/")) {
    return analyzeImage(buffer);
  }

  if (mimeType === "text/plain") {
    return {
      extractedText: buffer.toString("utf-8").trim(),
      description: "",
      tags: [],
    };
  }

  return { extractedText: "", description: "", tags: [] };
}
