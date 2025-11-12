import { Kysely } from "kysely";
import type { Database, Insertable, Migrations, Updatable } from "../database";
import type { Equal, Expect } from "./testUtils";

declare let _it: any;

(_it = "insertInto values accepts optional defaultTo columns") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("id", "text", (col) => col.primaryKey())
            .addColumn("username", "text", (col) => col.notNull())
            .addColumn("status", "text", (col) => col.defaultTo("active"))
            .addColumn("createdAt", "text", (col) => col.defaultTo("now"))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Db = Database<typeof migrations>;
  type InsertType = Insertable<typeof migrations, "users">;
  type Expected = {
    id: string;
    username: string;
    status?: string;
    createdAt?: string;
  };

  (_test: Expect<Equal<InsertType, Expected>>) => {};

  function testInsert(db: Kysely<Db>) {
    db.insertInto("users").values({
      id: "123",
      username: "test",
      status: "active",
      createdAt: "now",
    });

    db.insertInto("users").values({
      id: "123",
      username: "test",
    });
  }
};

(_it = "insertInto values accepts optional autoIncrement columns") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("posts")
            .addColumn("id", "integer", (col) =>
              col.primaryKey().autoIncrement(),
            )
            .addColumn("title", "text", (col) => col.notNull())
            .addColumn("content", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Db = Database<typeof migrations>;
  type InsertType = Insertable<typeof migrations, "posts">;
  type Expected = {
    id?: number;
    title: string;
    content: string | null;
  };

  (_test: Expect<Equal<InsertType, Expected>>) => {};

  const insert1: InsertType = {
    id: 1,
    title: "Post",
    content: "Content",
  };

  const insert2: InsertType = {
    title: "Post",
    content: null,
  };
};

(
  _it = "insertInto values accepts optional defaultTo and autoIncrement columns",
) => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("orders")
            .addColumn("id", "integer", (col) =>
              col.primaryKey().autoIncrement(),
            )
            .addColumn("userId", "text", (col) => col.notNull())
            .addColumn("status", "text", (col) => col.defaultTo("pending"))
            .addColumn("createdAt", "text", (col) => col.defaultTo("now"))
            .addColumn("notes", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Db = Database<typeof migrations>;
  type InsertType = Insertable<typeof migrations, "orders">;
  type Expected = {
    id?: number;
    userId: string;
    status?: string;
    createdAt?: string;
    notes: string | null;
  };

  (_test: Expect<Equal<InsertType, Expected>>) => {};

  const insert1: InsertType = {
    userId: "user123",
    notes: null,
  };

  const insert2: InsertType = {
    id: 1,
    userId: "user123",
    status: "completed",
    createdAt: "2024-01-01",
    notes: "Some notes",
  };
};

(_it = "updateTable set accepts all columns as optional") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("id", "text", (col) => col.primaryKey())
            .addColumn("username", "text", (col) => col.notNull())
            .addColumn("email", "text", (col) => col.notNull())
            .addColumn("status", "text", (col) => col.defaultTo("active"))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Db = Database<typeof migrations>;
  type UpdateType = Updatable<typeof migrations, "users">;
  type Expected = {
    id?: string;
    username?: string;
    email?: string;
    status?: string;
  };

  (_test: Expect<Equal<UpdateType, Expected>>) => {};

  const update1: UpdateType = {
    username: "newuser",
  };

  const update2: UpdateType = {
    email: "new@email.com",
    status: "inactive",
  };
};

(_it = "updateTable set accepts nullable columns as optional") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("posts")
            .addColumn("id", "integer", (col) => col.primaryKey())
            .addColumn("title", "text", (col) => col.notNull())
            .addColumn("content", "text")
            .addColumn("publishedAt", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Db = Database<typeof migrations>;
  type UpdateType = Updatable<typeof migrations, "posts">;
  type Expected = {
    id?: number;
    title?: string;
    content?: string | null;
    publishedAt?: string | null;
  };

  (_test: Expect<Equal<UpdateType, Expected>>) => {};

  const update1: UpdateType = {
    title: "New Title",
  };

  const update2: UpdateType = {
    content: null,
    publishedAt: "2024-01-01",
  };
};
