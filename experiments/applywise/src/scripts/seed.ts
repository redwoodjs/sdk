import { defineScript } from "@redwoodjs/reloaded/worker";
import { db, setupDb } from "../db";

export default defineScript(async ({ env }) => {
  setupDb(env);

  await db.$executeRawUnsafe(`\
    DELETE FROM Invoice;
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: '1',
      email: "amy@redwoodjs.com",
    },
  });

  console.log("🌱 Finished seeding");
});
