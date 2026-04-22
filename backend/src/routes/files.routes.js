import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  uploadSingle,
  uploadMultiple,
} from "../middleware/upload.middleware.js";
import * as ctrl from "../controllers/files.controller.js";

const router = Router();

// router.use(authenticate); // all file routes require auth

router.post("/upload", uploadSingle, ctrl.uploadFile); // single
router.post("/upload/batch", uploadMultiple, ctrl.uploadFiles); // multiple
router.get("/", ctrl.listFiles);
router.get("/:id", ctrl.getFile);
router.get("/:id/download", ctrl.downloadFile);
router.delete("/:id", ctrl.deleteFile);
router.patch("/:id", ctrl.updateFile);
router.get("/:id/versions", ctrl.getVersions);
router.post("/:id/restore/:version", ctrl.restoreVersion);

export default router;
