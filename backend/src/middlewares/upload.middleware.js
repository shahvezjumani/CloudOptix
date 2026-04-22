import multer from "multer";

const ALLOWED_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",

  // PDF
  "application/pdf",

  // Word Documents
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx

  // Excel Spreadsheets
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx

  // PowerPoint Presentations
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx

  // Text
  "text/plain", // .txt
  "text/csv", // .csv
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB per batch
const MAX_FILES = 50; // max files per request

const storage = multer.memoryStorage(); // keep file in buffer, upload directly to blob

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const multerInstance = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter,
});

// Single file upload
export const uploadSingle = multerInstance.single("file");

// Multiple files upload
export const uploadMultiple = multerInstance.array("files", MAX_FILES);
