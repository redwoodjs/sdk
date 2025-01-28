import { db } from "../db";
import { defineScript } from "./defineScript";

export default defineScript(async () => {
  await db.$executeRawUnsafe(`\
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: '1',
      email: "herman@redwoodjs.com",
    },
  });
});
