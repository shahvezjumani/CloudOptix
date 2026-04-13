import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", authController.register);

router.post("/verify-email", authController.verifyEmail);

router.post("/login", authController.login);

router.post("/refresh-token", authController.refreshToken);

router.post("/logout", authController.logout);

router.post("/logout-all", authController.logoutAll);

// GET  /api/auth/me

export default router;
