import prisma from "../lib/prisma.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../services/email.service.js";
import {
  asyncHandler,
  ApiResponse,
  ApiError,
  generateOtp,
} from "../utils/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

const register = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    throw new ApiError(400, "Email, password, and username are required");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new ApiError(400, "Email already in use");
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      username,
      storageUsed: 0,
    },
  });

  delete user.password;

  console.log(user);

  await sendWelcomeEmail(email, username);

  const otp = generateOtp();

  await sendVerificationEmail(email, otp);

  await prisma.otp.create({
    data: {
      email,
      code: await bcrypt.hash(otp, 10),
    },
  });

  // Quick fix for the BigInt serialization issue
  const userResponse = serializationUser(user);
  return res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const otpRecord = await prisma.otp.findFirst({
    where: {
      email,
    },
  });

  if (!otpRecord) {
    throw new ApiError(400, "No OTP found for this email");
  }

  const isValid = await bcrypt.compare(otp, otpRecord.code);

  if (!isValid) {
    throw new ApiError(400, "Invalid OTP");
  }

  await prisma.user.update({
    where: {
      email,
    },
    data: {
      isVerified: true,
    },
  });

  res.status(200).json(new ApiResponse(200, {}, "Email verified successfully"));
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!user) {
    throw new ApiError(400, "Invalid email or password");
  }

  if (!user.isVerified) {
    throw new ApiError(400, "Email not verified");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid email or password");
  }

  delete user.password;

  const refreshToken = jwt.sign(
    { userId: user.id },
    config.REFRESH_JWT_SECRET,
    {
      expiresIn: config.REFRESH_JWT_EXPIRES_IN,
    },
  );

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: await bcrypt.hash(refreshToken, 10),
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "unknown",
    },
  });

  const accessToken = jwt.sign(
    { userId: user.id, sessionId: session.id },
    config.ACCESS_JWT_SECRET,
    {
      expiresIn: config.ACCESS_JWT_EXPIRES_IN,
    },
  );

  const userResponse = serializationUser(user);

  res
    .status(200)
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json(
      new ApiResponse(
        200,
        { accessToken, user: userResponse },
        "Login successful",
      ),
    );
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  //   get refreshToken
  // clear cookies
  // decode the refreshToken
  // get id
  // search session record of this id
  // make the revoke true
  // return json success

  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.REFRESH_JWT_SECRET);
  } catch {
    // Token invalid/expired — just clear cookie and exit
    return res
      .clearCookie("refreshToken")
      .json(new ApiResponse(200, {}, "Logged out"));
  }

  // Find active sessions for this user and revoke by comparing tokens
  const sessions = await prisma.session.findMany({
    where: { userId: decoded.userId, revoked: false },
  });

  // Find the matching session using bcrypt.compare
  for (const session of sessions) {
    const matches = await bcrypt.compare(refreshToken, session.refreshToken);
    if (matches) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revoked: true },
      });
      break;
    }
  }

  res
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "Logout successful"));
});

const logoutAll = asyncHandler(async (req, res) => {
  /*
  get refreshToken
decode
get userId
updade all where userid is userId, make revoked
clear cookies
  */

  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  const decode = await jwt.verify(refreshToken, config.REFRESH_JWT_SECRET);

  await prisma.session.updateMany({
    where: {
      userId: decode.userId,
    },
    data: {
      revoked: true,
    },
  });

  res
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "Logout from all sessions successful"));
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    throw new ApiError(401, "Refresh token is required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.REFRESH_JWT_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Find active sessions for this user
  const sessions = await prisma.session.findMany({
    where: { userId: decoded.userId, revoked: false },
  });

  // Find the matching session
  let matchedSession = null;
  for (const session of sessions) {
    const matches = await bcrypt.compare(token, session.refreshToken);
    if (matches) {
      matchedSession = session;
      break;
    }
  }

  if (!matchedSession) {
    throw new ApiError(401, "Session not found or revoked");
  }

  // Generate new tokens
  const newRefreshToken = jwt.sign(
    { userId: decoded.userId },
    config.REFRESH_JWT_SECRET,
    { expiresIn: config.REFRESH_JWT_EXPIRES_IN },
  );

  const newAccessToken = jwt.sign(
    { userId: decoded.userId, sessionId: matchedSession.id },
    config.ACCESS_JWT_SECRET,
    { expiresIn: config.ACCESS_JWT_EXPIRES_IN },
  );

  // Rotate refresh token in DB
  await prisma.session.update({
    where: { id: matchedSession.id },
    data: { refreshToken: await bcrypt.hash(newRefreshToken, 10) },
  });

  // Send new refresh token as httpOnly cookie
  // Send new access token in body — frontend stores in memory
  res
    .status(200)
    .cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(
      new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"),
    );
});

function serializationUser(user) {
  return {
    ...user,
    storageUsed: user.storageUsed ? user.storageUsed.toString() : "0",
  };
}

const getMe = asyncHandler(async (req, res) => {
  // req.user is already set by authenticate middleware
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      storageUsed: true,
      createdAt: true,
    },
  });

  res.json(
    new ApiResponse(
      200,
      {
        ...user,
        storageUsed: Number(user.storageUsed),
        storageUsedMB: (Number(user.storageUsed) / (1024 * 1024)).toFixed(2),
      },
      "User fetched successfully",
    ),
  );
});

// ── Resend OTP ────────────────────────────────────────────────────────────────
// POST /auth/resend-otp
const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    throw new ApiError(400, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "Email already verified");
  }

  // Delete old OTP
  await prisma.otp.deleteMany({
    where: { email },
  });

  // Generate and send new OTP
  const otp = generateOtp();
  await sendVerificationEmail(email, otp);

  await prisma.otp.create({
    data: {
      email,
      code: await bcrypt.hash(otp, 10),
    },
  });

  res.status(200).json(new ApiResponse(200, {}, "OTP resent successfully"));
});

// forgot password
// reset password

export {
  register,
  verifyEmail,
  resendOtp,
  login,
  logout,
  logoutAll,
  refreshToken,
  getMe,
};
