import { defineScript } from "@redwoodjs/sdk/worker";
import { db, setupDb } from "../db";

export default defineScript(async ({ env }) => {
  setupDb(env);

  await db.$executeRawUnsafe(`\
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: '1',
      email: "her.stander@gmail.com",
    },
  });

  console.log("Done seeding!");
});
