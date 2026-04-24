import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { ApiError, asyncHandler } from "../utils/index.js";
import config from "../config/index.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log("Authenticating request. Authorization header:", authHeader);
  const token = req.cookies?.accessToken || authHeader?.replace("Bearer ", "");

  console.log("Token extracted:", token);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Access token is required");
  }

  const accessToken = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(accessToken, config.ACCESS_JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const session = await prisma.session.findFirst({
    where: {
      id: decoded.sessionId,
      revoked: false,
    },
  });

  if (!session) {
    throw new ApiError(401, "Session has been revoked or does not exist");
  }

  const user = await prisma.user.findFirst({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      username: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Email not verified");
  }

  req.user = user;
  req.sessionId = decoded.sessionId;

  next();
});
