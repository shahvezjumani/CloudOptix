import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
import crypto from "crypto";

const getContainerClient = () => {
  const client = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION,
  );
  return client.getContainerClient(process.env.BLOB_CONTAINER);
};

export async function uploadToBlob(buffer, mimeType, userId) {
  const container = getContainerClient();
  const blobKey = `${userId}/${Date.now()}-${crypto.randomUUID()}`;
  const blockBlob = container.getBlockBlobClient(blobKey);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return { blobKey, url: blockBlob.url };
}

export async function generateSasUrl(blobKey, expiresInMinutes = 15) {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const container = process.env.BLOB_CONTAINER;

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);

  const sasParams = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: blobKey,
      permissions: BlobSASPermissions.parse("r"), // read only
      expiresOn,
    },
    sharedKeyCredential,
  );

  return `https://${accountName}.blob.core.windows.net/${container}/${blobKey}?${sasParams.toString()}`;
}

export async function deleteFromBlob(blobKey) {
  const container = getContainerClient();
  const blockBlob = container.getBlockBlobClient(blobKey);
  await blockBlob.deleteIfExists();
}
