import "dotenv/config";
import { defineConfig } from "@prisma/config"; // Note the '@' symbol

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // We add '!' to tell TypeScript "I promise this exists in my .env"
    url: process.env.DATABASE_URL!,
  },
});
