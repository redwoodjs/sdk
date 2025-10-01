import { db } from "@/db/db";
import { defineScript } from "rwsdk/worker";

export default defineScript(async () => {
  // clean out the database
  await db.deleteFrom("testimonial_taggings").execute();
  await db.deleteFrom("testimonials").execute();
  await db.deleteFrom("testimonial_tags").execute();
  await db.deleteFrom("testimonial_statuses").execute();
  await db.deleteFrom("testimonial_sources").execute();
  await db.deleteFrom("users").execute();

  // set the initial sources
  await db
    .insertInto("testimonial_sources")
    .values([
      { id: 1, name: "Website" },
      { id: 2, name: "Email" },
      { id: 3, name: "YouTube" },
      { id: 4, name: "Discord" },
      { id: 5, name: "Twitter/X" },
      { id: 6, name: "BlueSky" },
      { id: 7, name: "Instagram" },
      { id: 8, name: "LinkedIn" },
      { id: 9, name: "TikTok" },
      { id: 10, name: "Reddit" },
    ])
    .execute();

  // set the testimonial status
  await db
    .insertInto("testimonial_statuses")
    .values([
      { id: 1, name: "Approved" },
      { id: 2, name: "Rejected" },
      { id: 3, name: "Pending" },
    ])
    .execute();

  // create some basic tags
  await db
    .insertInto("testimonial_tags")
    .values([
      { id: 1, name: "Community", color: "#e47947", textColor: "#fff" },
      { id: 2, name: "Docs", color: "#f9c80c", textColor: "#000" },
      { id: 3, name: "DX", color: "#8d51ff", textColor: "#fff" },
    ])
    .execute();

  // create a default user
  await db
    .insertInto("users")
    .values([
      {
        id: "a9a7e2e8-2b8a-4c7b-9f6b-7a1b3c4d5e6f",
        username: "Test User",
        createdAt: new Date().toISOString(),
      },
    ])
    .execute();

  console.log("🌱 Finished seeding");
});
