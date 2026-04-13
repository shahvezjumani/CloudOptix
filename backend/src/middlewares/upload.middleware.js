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

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.memoryStorage(); // keep file in buffer, upload directly to blob

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    console.log(`Accepted file type: ${file.mimetype}`);
    console.log(`File info: ${JSON.stringify(file)} `);
    console.log(`File : ${file} `);
    cb(null, true);
  } else {
    console.log(`Rejected file type: ${file.mimetype}`);

    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter,
});
