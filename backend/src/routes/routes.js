import { Router } from "express";
import authRoutes from "./auth.routes.js";
import filesRoutes from "./files.routes.js";
import foldersRoutes from "./folders.routes.js";
import searchRoutes from "./search.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/files", filesRoutes);
router.use("/folders", foldersRoutes);
router.use("/search", searchRoutes);

export default router;
