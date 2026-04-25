import { AzureKeyCredential } from "@azure/core-auth";
import ImageAnalysisClient from "@azure-rest/ai-vision-image-analysis";
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";
import { TextAnalysisClient } from "@azure/ai-language-text";

// Azure AI Vision — image OCR + tags + description
export const visionClient = ImageAnalysisClient(
  process.env.AZURE_VISION_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_VISION_KEY!),
);

// Document Intelligence — PDF + Word extraction
export const documentClient = new DocumentAnalysisClient(
  process.env.AZURE_DOCUMENT_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_DOCUMENT_KEY!),
);

// Language Service — classification + key phrases
export const languageClient = new TextAnalysisClient(
  process.env.AZURE_LANGUAGE_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_LANGUAGE_KEY!),
);
