"use server";

import { db } from "@/db/db";

export async function addTestimonial(content: string) {
  if (!content) {
    return;
  }

  await db
    .insertInto("testimonials")
    .values({
      id: crypto.randomUUID(),
      content,
      userId: "a9a7e2e8-2b8a-4c7b-9f6b-7a1b3c4d5e6f", // default user
      sourceId: 1, // "Website"
      statusId: 3, // "Pending"
      createdAt: new Date().toISOString(),
    })
    .execute();
}
