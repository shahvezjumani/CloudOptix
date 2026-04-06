import { app, InvocationContext } from "@azure/functions";

export async function ProcessUpload(
  blob: Buffer,
  context: InvocationContext,
): Promise<void> {
  context.log(
    `Storage blob function processed blob "${context.triggerMetadata.name}" with size ${blob.length} bytes`,
  );
}

app.storageBlob("ProcessUpload", {
  path: "uploads/{name}",
  connection: "",
  handler: ProcessUpload,
});
