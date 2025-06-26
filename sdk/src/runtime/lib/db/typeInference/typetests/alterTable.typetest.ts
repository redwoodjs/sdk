import type { Database, Migrations } from "../database";
import type { Expect, Equal } from "./testUtils";

(_it = "alterTable addColumn") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema
            .alterTable("users")
            .addColumn("displayName", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
      displayName: string;
    };
  };
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameColumn and dropColumn") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text")
            .addColumn("displayName", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema
            .alterTable("users")
            .renameColumn("displayName", "nickname")
            .dropColumn("username")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      nickname: any;
    };
  };
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable alterColumn setDataType and setDefault") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema.createTable("users").addColumn("age", "integer").execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema
            .alterTable("users")
            .alterColumn("age", (col) => col.setDataType("text"))
            .alterColumn("age", (col) => col.setDefault("unknown"))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      age: string;
    };
  };

  // todo(justinvdm, 2024-01-08): Support setDataType()
  // @ts-ignore
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable alterColumn dropDefault, setNotNull, dropNotNull") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema.createTable("users").addColumn("age", "integer").execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema
            .alterTable("users")
            .alterColumn("age", (col) => col.dropDefault())
            .alterColumn("age", (col) => col.setNotNull())
            .alterColumn("age", (col) => col.dropNotNull())
            .execute(),
        ];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      age: number;
    };
  };
  (_test: Expect<Equal<Actual, Expected>>) => {};
};
