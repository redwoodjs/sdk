import { defineScript } from "@redwoodjs/sdk/worker";
import { db, setupDb } from "@/db";

export default defineScript(async ({ env }) => {
  setupDb(env);

  // Add seed data here

  console.log("🌱 Finished seeding");
});
