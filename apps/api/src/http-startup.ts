import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDatabase } from "./database";
import { prepareDatabaseStartup } from "./database/prepare-database-startup";
import { waitForDatabase } from "./database/wait-for-database";
import { migrateColumns } from "./migrations/column-migration";
import { migrateGitHubIntegration } from "./plugins/github/migration";
import { migrateApiKeyReferenceId } from "./utils/migrate-apikey-reference-id";
import { migrateNotificationPreferencesSchema } from "./utils/migrate-notification-preferences-schema";
import { migrateSessionColumn } from "./utils/migrate-session-column";
import { migrateWorkspaceUserEmail } from "./utils/migrate-workspace-user-email";
import { seedDefaultWorkspaceRoles } from "./utils/seed-default-workspace-roles";

export async function runHttpStartupTasks() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  await prepareDatabaseStartup({
    waitForDatabase: async () => {
      await waitForDatabase({
        query: async () => {
          await getDatabase().execute(sql`SELECT 1`);
        },
      });
    },
    runStartupMigrations: async () => {
      if (process.env.KANEO_SKIP_DRIZZLE_MIGRATIONS === "1") {
        return;
      }
      await migrateWorkspaceUserEmail();
      await migrateSessionColumn();
      console.log("🔄 Migrating database...");
      await migrate(getDatabase(), {
        migrationsFolder: `${currentDir}/../drizzle`,
      });
      console.log("✅ Database migrated successfully!");
    },
  });

  if (process.env.KANEO_SKIP_DRIZZLE_MIGRATIONS !== "1") {
    await migrateApiKeyReferenceId();
    await migrateNotificationPreferencesSchema();
    await migrateGitHubIntegration();
    await migrateColumns();
  }
  await seedDefaultWorkspaceRoles();
}
