import { defineScript } from "rwsdk/worker";
import { db } from "@/db";

export default defineScript(async () => {
  await db.$executeRawUnsafe(`\
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  await db.user.create({
    data: {
      id: "1",
      username: "testuser",
    },
  });

  console.log("🌱 Finished seeding");
});
