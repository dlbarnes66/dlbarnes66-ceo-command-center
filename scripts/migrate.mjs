// Applies the SQL migrations in ./drizzle and prints clear errors
// (drizzle-kit migrate can exit silently when the connection fails).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL is missing from .env.local");
  process.exit(1);
}

let host = "?";
try {
  const u = new URL(url);
  host = `${u.hostname}:${u.port || 5432} as ${decodeURIComponent(u.username)}`;
} catch {
  console.error("✗ DATABASE_URL isn't a valid URL. Check for spaces, quotes, or special characters in the password.");
  process.exit(1);
}

console.log(`Connecting to ${host} …`);
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15, onnotice: () => {} });

try {
  await sql`select 1`;
  console.log("✓ Connected");
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`✓ Migrations applied. Tables in public: ${tables.map((t) => t.table_name).join(", ")}`);
} catch (err) {
  console.error(`✗ ${err.code ? `[${err.code}] ` : ""}${err.message}`);
  if (/ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|timeout/i.test(String(err.message) + err.code)) {
    console.error("  Can't reach that host. Use the Transaction pooler → Shared pooler string (host ends in pooler.supabase.com).");
  }
  if (err.code === "28P01" || /password authentication/i.test(err.message)) {
    console.error("  Wrong password. Reset it in Supabase → Project Settings → Database (letters and numbers only).");
  }
  if (/Tenant or user not found/i.test(err.message)) {
    console.error("  The pooler username must be postgres.<project-ref>, e.g. postgres.ffwlwozrhawczhhdcxif");
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
