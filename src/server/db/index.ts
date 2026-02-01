import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "sminventory.db");

// Create SQLite connection
const sqlite = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export the raw SQLite connection for direct queries if needed
export { sqlite };

// Initialize database with default data
export async function initializeDatabase() {
  // Create tables if they don't exist (Drizzle handles this via migrations)
  // But we'll ensure default profiles exist
  
  const existingProfiles = db.select().from(schema.executionProfiles).all();
  
  if (existingProfiles.length === 0) {
    // Insert default execution profiles
    db.insert(schema.executionProfiles).values([
      {
        id: "local-16gb",
        name: "Local (16GB VRAM)",
        maxVramGb: 16,
        preferredPrecision: "fp8",
        preferredLocation: "local",
        isDefault: 1,
      },
      {
        id: "local-24gb",
        name: "Local (24GB VRAM)",
        maxVramGb: 24,
        preferredPrecision: "fp16",
        preferredLocation: "local",
        isDefault: 0,
      },
      {
        id: "cloud-a100",
        name: "Cloud (A100 80GB)",
        maxVramGb: 80,
        preferredPrecision: "fp16",
        preferredLocation: "warehouse",
        isDefault: 0,
      },
    ]).run();
  }
}
