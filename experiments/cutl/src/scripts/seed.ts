import { db } from "../db";
import { defineScript } from "./defineScript";

export default defineScript(async () => {
  await db.$executeRawUnsafe(`\
    DELETE FROM Project;
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: '1',
      email: "her.stander@gmail.com",
    },
  });

  const cutlistItems = [
    { width: 1105, length: 1550, quantity: 2 },
    { width: 1105, length: 505, quantity: 2 },
    { width: 505, length: 1550, quantity: 2 },
    { width: 505, length: 1391, quantity: 1 }
  ];

  await db.project.create({
    data: {
      userId: user.id,
      title: "Cutlist 1",
      currency: 'R',
      boardsNeeded: 0,
      total: 0,
      boardLength: 2440,
      boardWidth: 1220,
      bladeWidth: 3,
      boardPrice: 1250,
      createdAt: new Date("2024-01-01T10:00:00Z"),
      cutlistItems: JSON.stringify(cutlistItems),
    },
  });

  console.log("Done seeding!");
});
