import * as fileService from "../services/file.service.js";
import { asyncHandler, ApiError, ApiResponse } from "../utils/index.js";

export const uploadFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }

  const file = await fileService.uploadFile(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    "bb5f016f-8c99-43cf-8b43-ff8da3e87c77",
  );

  res
    .status(201)
    .json(new ApiResponse(201, "File uploaded successfully", { file }));
});

export const uploadFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "No files provided");
  }

  const folderId = req.body.folderId || null;

  const { succeeded, failed } = await fileService.uploadMultipleFiles(
    req.files,
    req.user.id,
    folderId,
  );

  res.status(201).json(
    new ApiResponse(201, "Files uploaded successfully", {
      succeeded,
      failed,
      total: req.files.length,
      uploadedCount: succeeded.length,
      failedCount: failed.length,
    }),
  );
});

export const listFiles = asyncHandler(async (req, res) => {
  const { page, limit, category, search } = req.query;
  const result = await fileService.listFiles(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 30,
    category,
    search,
  });
  res.json(result);
});

export const getFile = asyncHandler(async (req, res) => {
  const file = await fileService.getFileById(req.params.id, req.user.id);
  res.json({ file });
});

export const downloadFile = asyncHandler(async (req, res) => {
  const sasUrl = await fileService.getDownloadUrl(req.params.id, req.user.id);
  res.json({ url: sasUrl });
});

export const deleteFile = asyncHandler(async (req, res) => {
  await fileService.softDeleteFile(req.params.id, req.user.id);
  res.status(204).send();
});

export const updateFile = asyncHandler(async (req, res) => {
  const file = await fileService.updateFile(
    req.params.id,
    req.user.id,
    req.body,
  );
  res.json({ file });
});

export const getVersions = asyncHandler(async (req, res) => {
  const versions = await fileService.getVersions(req.params.id, req.user.id);
  res.json({ versions });
});

export const restoreVersion = asyncHandler(async (req, res) => {
  const file = await fileService.restoreVersion(
    req.params.id,
    req.params.version,
    req.user.id,
  );
  res.json({ file });
});
