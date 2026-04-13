import { Router } from "express";
import authRoutes from "./auth.routes.js";
import filesRoutes from "./files.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/files", filesRoutes);

export default router;
