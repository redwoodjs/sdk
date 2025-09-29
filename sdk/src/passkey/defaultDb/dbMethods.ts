import debug from "../../../runtime/lib/debug.mjs";
import { type Database } from "../../../runtime/lib/db/index.mjs";
import { type migrations } from "./migrations.mjs";

const log = debug("passkey:db");

export type PasskeyDatabase = Database<typeof migrations>;
export type User = PasskeyDatabase["users"];
export type Credential = PasskeyDatabase["credentials"];

export function createDbMethods(db: PasskeyDatabase) {
  return {
    async createUser(username: string): Promise<User> {
      const user: User = {
        id: crypto.randomUUID(),
        username,
        createdAt: new Date().toISOString(),
      };
      await db.insertInto("users").values(user).execute();
      return user;
    },

    async getUserById(id: string): Promise<User | undefined> {
      return await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async createCredential(
      credential: Omit<Credential, "id" | "createdAt">,
    ): Promise<Credential> {
      log("Creating credential for user: %s", credential.userId);

      const newCredential: Credential = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...credential,
      };

      await db.insertInto("credentials").values(newCredential).execute();
      log("Credential created successfully: %s", newCredential.id);
      return newCredential;
    },

    async getCredentialById(
      credentialId: string,
    ): Promise<Credential | undefined> {
      return await db
        .selectFrom("credentials")
        .selectAll()
        .where("credentialId", "=", credentialId)
        .executeTakeFirst();
    },

    async updateCredentialCounter(
      credentialId: string,
      counter: number,
    ): Promise<void> {
      await db
        .updateTable("credentials")
        .set({ counter })
        .where("credentialId", "=", credentialId)
        .execute();
    },

    async getUserCredentials(userId: string): Promise<Credential[]> {
      return await db
        .selectFrom("credentials")
        .selectAll()
        .where("userId", "=", userId)
        .execute();
    },
  };
}
