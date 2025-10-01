import { type Migrations } from "rwsdk/db";

export const migrations = {
  "001_initial_schema": {
    async up(db) {
      return [
        await db.schema
          .createTable("users")
          .addColumn("id", "text", (col) => col.primaryKey())
          .addColumn("username", "text", (col) => col.notNull().unique())
          .addColumn("createdAt", "text", (col) => col.notNull())
          .execute(),

        await db.schema
          .createTable("testimonial_sources")
          .addColumn("id", "integer", (col) => col.primaryKey())
          .addColumn("name", "text", (col) => col.notNull().unique())
          .execute(),

        await db.schema
          .createTable("testimonial_statuses")
          .addColumn("id", "integer", (col) => col.primaryKey())
          .addColumn("name", "text", (col) => col.notNull().unique())
          .execute(),

        await db.schema
          .createTable("testimonial_tags")
          .addColumn("id", "integer", (col) => col.primaryKey())
          .addColumn("name", "text", (col) => col.notNull().unique())
          .addColumn("color", "text")
          .addColumn("textColor", "text")
          .execute(),

        await db.schema
          .createTable("testimonials")
          .addColumn("id", "text", (col) => col.primaryKey())
          .addColumn("content", "text", (col) => col.notNull())
          .addColumn("userId", "text", (col) =>
            col.references("users.id").onDelete("cascade"),
          )
          .addColumn("sourceId", "integer", (col) =>
            col.notNull().references("testimonial_sources.id"),
          )
          .addColumn("statusId", "integer", (col) =>
            col.notNull().references("testimonial_statuses.id"),
          )
          .addColumn("createdAt", "text", (col) => col.notNull())
          .execute(),

        await db.schema
          .createTable("testimonial_taggings")
          .addColumn("testimonialId", "text", (col) =>
            col.notNull().references("testimonials.id").onDelete("cascade"),
          )
          .addColumn("tagId", "integer", (col) =>
            col.notNull().references("testimonial_tags.id").onDelete("cascade"),
          )
          .addPrimaryKeyConstraint("testimonial_taggings_pk", [
            "testimonialId",
            "tagId",
          ])
          .execute(),
      ];
    },

    async down(db) {
      await db.schema.dropTable("testimonial_taggings").ifExists().execute();
      await db.schema.dropTable("testimonials").ifExists().execute();
      await db.schema.dropTable("testimonial_tags").ifExists().execute();
      await db.schema.dropTable("testimonial_statuses").ifExists().execute();
      await db.schema.dropTable("testimonial_sources").ifExists().execute();
      await db.schema.dropTable("users").ifExists().execute();
    },
  },
} satisfies Migrations;
