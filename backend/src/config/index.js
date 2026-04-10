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

const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING,
  PORT: process.env.PORT || 3000,
};

export default config;
