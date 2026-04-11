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

  res.status(201).json(new ApiResponse("User registered successfully", user));
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
    }
  );

  res
    .status(200)
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json(new ApiResponse(200, { accessToken, user }, "Login successful"));
});

export { register, verifyEmail, login };
