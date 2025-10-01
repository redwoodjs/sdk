import { Kysely, Migration, MigrationProvider, Migrator } from "kysely";

/**
 * A custom MigrationProvider that works with in-memory migrations
 * rather than reading from files.
 */
export class InMemoryMigrationProvider implements MigrationProvider {
  private migrations: Record<string, Migration>;

  constructor(migrations: Record<string, Migration>) {
    this.migrations = migrations;
  }

  async getMigrations(): Promise<Record<string, Migration>> {
    return this.migrations;
  }
}

/**
 * Helper function to create a migrator using Kysely's built-in Migrator.
 *
 * @example
 * ```typescript
 * const migrator = createMigrator(db, migrations, "__my_migrations");
 * const result = await migrator.migrateToLatest();
 * if (result.error) {
 *   throw new Error(`Migration failed: ${result.error}`);
 * }
 * ```
 */
export function createMigrator(
  db: Kysely<any>,
  migrations: Record<string, Migration>,
  migrationTableName: string = "__rwsdk_migrations",
): Migrator {
  return new Migrator({
    db,
    provider: new InMemoryMigrationProvider(migrations),
    migrationTableName,
    // Use a custom lock table name based on the migration table name
    migrationLockTableName: `${migrationTableName}_lock`,
  });
}
