import { db } from "../db";
import { defineScript } from "./defineScript";

export default defineScript(async () => {
  await db.$executeRawUnsafe(`\
    DELETE FROM Project;
    DELETE FROM CutlistItem;
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: '1',
      email: "her.stander@gmail.com",
    },
  });

  await db.project.create({
    data: {
      userId: user.id,
      title: "Cutlist 1",
      currency: '$',
      createdAt: new Date("2024-01-01T10:00:00Z"),
    },
  });

  console.log("Done seeding!");
});
