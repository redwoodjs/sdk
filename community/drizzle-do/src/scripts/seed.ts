import { getDb } from "@/db/db";

export default async () => {
  console.log("… Seeding todos");
  const db = getDb();
  await db.deleteTodos();

  await db.insertTodos([
    {
      id: crypto.randomUUID(),
      text: "Create a new playground example",
      completed: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      text: "Write end-to-end tests",
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      text: "Update the documentation",
      completed: false,
      createdAt: new Date().toISOString(),
    },
  ]);

  console.log("✔ Finished seeding todos 🌱");
};
