import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import crypto from "crypto";

import config from "../config/index.js";

const isLocal = process.env.NODE_ENV !== "production";

console.log(
  "DEBUG: Connection String exists?",
  !!process.env.AZURE_STORAGE_CONNECTION,
);
console.log("DEBUG: Container Name:", process.env.BLOB_CONTAINER);

const getContainerClient = () => {
  const client = BlobServiceClient.fromConnectionString(
    config.AZURE_STORAGE_CONNECTION,
  );
  return client.getContainerClient(config.BLOB_CONTAINER);
};

export async function uploadToBlob(buffer, mimeType, userId) {
  // get container
  const container = getContainerClient();

  // ensure container exists in Azurite (safe to call every time, no-op if exists)
  await container.createIfNotExists();

  // create blob key with userId prefix for better organization and potential future cleanup
  // blobKey format: userId/timestamp-randomUUID to minimize collisions
  // In a production system, you might want to add more structure (e.g. folders by date) or use a more robust ID generator
  const blobKey = `${userId}/${Date.now()}-${crypto.randomUUID()}`;
  const blockBlob = container.getBlockBlobClient(blobKey);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return { blobKey, url: blockBlob.url };
}

export async function generateSasUrl(blobKey, expiresInMinutes = 15) {
  // const accountName = config.AZURE_STORAGE_ACCOUNT_NAME;
  const accountName = "devstoreaccount1";
  // const accountKey = config.AZURE_STORAGE_ACCOUNT_KEY;
  const accountKey =
    "Eby8vdM02xNOcqFeqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KZY3r6sXaQg==";
  const containerName = config.BLOB_CONTAINER;

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sasParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobKey,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
    },
    sharedKeyCredential,
  );

  // Local Azurite URL format is different from real Azure
  const baseUrl = isLocal
    ? `http://127.0.0.1:10000/${accountName}/${containerName}/${blobKey}`
    : `https://${accountName}.blob.core.windows.net/${containerName}/${blobKey}`;

  return `${baseUrl}?${sasParams.toString()}`;
}

export async function deleteFromBlob(blobKey) {
  const container = getContainerClient();
  const blockBlob = container.getBlockBlobClient(blobKey);
  await blockBlob.deleteIfExists();
}
