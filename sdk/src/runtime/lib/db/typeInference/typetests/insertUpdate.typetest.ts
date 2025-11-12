import type { Database, Migrations, Insertable, Updatable } from "../database";
import type { Equal, Expect } from "./testUtils";

declare let _it: any;

(_it = "insertable type with defaultTo column should be optional") => {
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
  type Actual = Insertable<typeof migrations, "users">;
  type Expected = {
    id: string;
    username: string;
    status?: string;
    createdAt?: string;
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "insertable type with autoIncrement column should be optional") => {
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
  type Actual = Insertable<typeof migrations, "posts">;
  type Expected = {
    id?: number;
    title: string;
    content: string | null;
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "insertable type with both defaultTo and autoIncrement") => {
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
  type Actual = Insertable<typeof migrations, "orders">;
  type Expected = {
    id?: number;
    userId: string;
    status?: string;
    createdAt?: string;
    notes: string | null;
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "updatable type should make all columns optional") => {
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
  type Actual = Updatable<typeof migrations, "users">;
  type Expected = {
    id?: string;
    username?: string;
    email?: string;
    status?: string;
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "updatable type with nullable columns") => {
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
  type Actual = Updatable<typeof migrations, "posts">;
  type Expected = {
    id?: number;
    title?: string;
    content?: string | null;
    publishedAt?: string | null;
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

