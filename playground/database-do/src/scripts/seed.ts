import { db } from "@/db/db";

export default async () => {
  console.log("… Seeding todos");
  await db.deleteFrom("todos").execute();

  await db
    .insertInto("todos")
    .values([
      {
        id: crypto.randomUUID(),
        text: "Create a new playground example",
        completed: 1,
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        text: "Write end-to-end tests",
        completed: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        text: "Update the documentation",
        completed: 0,
        createdAt: new Date().toISOString(),
      },
    ])
    .execute();

  console.log("✔ Finished seeding todos 🌱");
};
