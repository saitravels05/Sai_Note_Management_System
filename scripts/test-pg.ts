import EmbeddedPostgres from "embedded-postgres";
import path from "path";

async function main() {
  console.log("Initializing Embedded Postgres...");
  const dataDir = path.join(process.cwd(), ".local-db");
  const pg = new EmbeddedPostgres({
    port: 5432,
    user: "postgres",
    password: "postgres",
    databaseDir: dataDir,
  });

  try {
    await pg.initialise();
    console.log("Embedded Postgres initialized.");
    await pg.start();
    console.log("Embedded Postgres started successfully on port 5432!");
  } catch (err) {
    console.error("Failed to start Embedded Postgres:", err);
  }
}

main();
