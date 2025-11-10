import type { Database, Migrations } from "../database";
import type { Equal, Expect } from "./testUtils";

(_it = "dropTable") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),

          await db.schema
            .createTable("posts")
            .addColumn("title", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [await db.schema.dropTable("posts").execute()];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "dropTable non-existent table") => {
  const migrations = {
    "0": {
      async up(db) {
        return [await db.schema.dropTable("ghost").execute()];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {};
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "dropTable all tables") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema.createTable("a").addColumn("x", "text").execute(),
          await db.schema.createTable("b").addColumn("y", "text").execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema.dropTable("a").execute(),
          await db.schema.dropTable("b").execute(),
        ];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {};
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "chaining createTable and dropTable") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text")
            .execute(),
          await db.schema
            .createTable("posts")
            .addColumn("title", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema.dropTable("posts").execute(),
          await db.schema
            .createTable("comments")
            .addColumn("text", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string | null;
    };
    comments: {
      text: string | null;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "drop table then add it back") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [await db.schema.dropTable("users").execute()];
      },
    },
    "2": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string | null;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "rename table then drop it") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema.alterTable("users").renameTo("customers").execute(),
        ];
      },
    },
    "2": {
      async up(db) {
        return [await db.schema.dropTable("customers").execute()];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {};

  (_test: Expect<Equal<Actual, Expected>>) => {};
};
