import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";

async function main() {
  const dataDir = path.join(process.cwd(), ".local-db");
  const isInitialized = fs.existsSync(path.join(dataDir, "PG_VERSION"));

  console.log(`Starting Embedded PostgreSQL on port 5432 (dataDir: ${dataDir})...`);

  const pg = new EmbeddedPostgres({
    port: 5432,
    user: "postgres",
    password: "postgres",
    databaseDir: dataDir,
    initdbFlags: ["-E", "UTF8", "--locale=C"],
    persistent: true,
  });

  try {
    if (!isInitialized) {
      console.log("Initializing database cluster with UTF-8 encoding...");
      await pg.initialise();
      console.log("Database cluster initialized.");
    }

    await pg.start();
    console.log("PostgreSQL server started successfully on 127.0.0.1:5432.");

    // Ensure sai_accounting_db exists
    try {
      await pg.createDatabase("sai_accounting_db");
      console.log("Created database: sai_accounting_db");
    } catch {
      // Database might already exist
    }

    console.log("Database ready to accept connections for Sai Notes & Accounting System.");

    // Keep running
    process.on("SIGINT", async () => {
      console.log("Shutting down PostgreSQL...");
      await pg.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("Shutting down PostgreSQL...");
      await pg.stop();
      process.exit(0);
    });

    setInterval(() => {}, 1000 * 60 * 60);
  } catch (err) {
    console.error("Failed to start PostgreSQL:", err);
    process.exit(1);
  }
}

main();
