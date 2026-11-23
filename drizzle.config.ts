import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env.local the way Next.js does, so load it here.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present */
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to .env.local (see .env.example).");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
