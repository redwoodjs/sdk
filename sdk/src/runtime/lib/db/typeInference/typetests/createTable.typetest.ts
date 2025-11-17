import { Kysely, sql } from "kysely";
import type { Database, Migrations } from "../database";
import type { Equal, Expect, OmitInternals } from "./testUtils";

type ExtractKyselySchema<T> = T extends { __kyselySchema: infer S } ? S : T;

(_it = "createTable") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;

  type Expected = {
    users: {
      username: string;
    };
  };

  (_test: Expect<Equal<OmitInternals<Actual>, Expected>>) => {};
};

(_it = "createTable with multiple columns and defaults") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull())
            .addColumn("active", "boolean", (col) => col.defaultTo(true))
            .addColumn("anotherBoolean", "boolean", (col) =>
              col.defaultTo(sql`true`),
            )
            .addColumn("email", "text", (col) => col)
            .addColumn("favoriteColor", "text", (col) => col.unique())
            .addColumn("name", "text", (col) => col.defaultTo("John Doe"))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
      active: boolean;
      anotherBoolean: boolean;
      favoriteColor: string | null;
      email: string | null;
      name: string;
    };
  };
  (_test: Expect<Equal<OmitInternals<Actual>, Expected>>) => {};
};

(_it = "createTable column without callback is nullable") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("posts")
            .addColumn("title", "text")
            .addColumn("body", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    posts: {
      title: string | null;
      body: string | null;
    };
  };
  (_test: Expect<Equal<OmitInternals<Actual>, Expected>>) => {};
};

(_it = "createTable with primaryKey is non-nullable") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("id", "integer", (col) => col.primaryKey())
            .addColumn("email", "text", (col) => col.notNull())
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      id: number;
      email: string;
    };
  };
  (_test: Expect<Equal<OmitInternals<Actual>, Expected>>) => {};
};

(_it = "createTable with unique but no notNull is nullable") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("products")
            .addColumn("sku", "text", (col) => col.unique())
            .addColumn("name", "text", (col) => col)
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    products: {
      sku: string | null;
      name: string | null;
    };
  };
  (_test: Expect<Equal<OmitInternals<Actual>, Expected>>) => {};
};

(_it = "defaultTo makes columns non-nullable in Database type") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("status", "text", (col) => col.defaultTo("active"))
            .addColumn("count", "integer", (col) => col.defaultTo(0))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      status: string;
      count: number;
    };
  };

  (_test: Expect<Equal<OmitInternals<Actual>, Expected>>) => {};
};

// --- Insert/Update Type Tests ---

(_it = "makes autoIncrement columns optional on insert") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("id", "integer", (col) =>
              col.primaryKey().autoIncrement(),
            )
            .addColumn("username", "text", (col) => col.notNull())
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type DB = Database<typeof migrations>;
  const db = {} as Kysely<ExtractKyselySchema<DB>>;

  db.insertInto("users").values({ username: "test" });
};

(_it = "makes defaultTo columns optional on insert") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull())
            .addColumn("status", "text", (col) =>
              col.notNull().defaultTo("active"),
            )
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type DB = Database<typeof migrations>;
  const db = {} as Kysely<ExtractKyselySchema<DB>>;

  db.insertInto("users").values({ username: "test" });
};
