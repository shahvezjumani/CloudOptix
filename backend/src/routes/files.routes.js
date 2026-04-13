import { Router } from "express";
import * as filesController from "../controllers/files.controller.js";

const router = Router();

router.post("/upload", filesController.uploadFile);

export default router;
