import { env } from "cloudflare:workers";

import debug from "rwsdk/debug";
import { type Database, createDb } from "rwsdk/db";
import { type migrations } from "./migrations";

const log = debug("passkey:db");

export type PasskeyDatabase = Database<typeof migrations>;
export type User = PasskeyDatabase["users"];
export type Credential = PasskeyDatabase["credentials"];

export const db = createDb<PasskeyDatabase>(
  env.PASSKEY_DURABLE_OBJECT,
  "passkey-main"
);

export async function createUser(username: string): Promise<User> {
  const user: User = {
    id: crypto.randomUUID(),
    username,
    createdAt: new Date().toISOString(),
  };
  await db.insertInto("users").values(user).execute();
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  return await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function createCredential(
  credential: Omit<Credential, "id" | "createdAt">
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
}

export async function getCredentialById(
  credentialId: string
): Promise<Credential | undefined> {
  return await db
    .selectFrom("credentials")
    .selectAll()
    .where("credentialId", "=", credentialId)
    .executeTakeFirst();
}

export async function updateCredentialCounter(
  credentialId: string,
  counter: number
): Promise<void> {
  await db
    .updateTable("credentials")
    .set({ counter })
    .where("credentialId", "=", credentialId)
    .execute();
}

export async function getUserCredentials(
  userId: string
): Promise<Credential[]> {
  return await db
    .selectFrom("credentials")
    .selectAll()
    .where("userId", "=", userId)
    .execute();
}
