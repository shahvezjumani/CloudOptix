import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in the environment variables.");
}

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error(
    "AZURE_STORAGE_CONNECTION_STRING is not defined in the environment variables.",
  );
}

if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_USER) {
  throw new Error(
    "Google OAuth credentials are not fully defined in the environment variables.",
  );
}

if(!process.env.ACCESS_JWT_SECRET || !process.env.ACCESS_JWT_EXPIRES_IN || !process.env.REFRESH_JWT_SECRET || !process.env.REFRESH_JWT_EXPIRES_IN) {
  throw new Error(
    "JWT configuration is not fully defined in the environment variables.",
  );
}

const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
  PORT: process.env.PORT || 3000,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER: process.env.GOOGLE_USER,
  ACCESS_JWT_SECRET: process.env.ACCESS_JWT_SECRET,
  ACCESS_JWT_EXPIRES_IN: process.env.ACCESS_JWT_EXPIRES_IN,
  REFRESH_JWT_SECRET: process.env.REFRESH_JWT_SECRET,
  REFRESH_JWT_EXPIRES_IN: process.env.REFRESH_JWT_EXPIRES_IN,
};

export default config;
