import type {
  Database,
  Migrations,
  MergedSchemaBeforeDrop,
} from "../database";
import type { Expect, Equal } from "./testUtils";
import { Prettify } from "../utils";

declare let _it: any;

(_it = "alterTable addColumn") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
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
  //(_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameColumn") => {
  const migrations = {
    "0001_initial": {
      up: async (db) => [
        await db.schema
          .createTable("users")
          .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
          .addColumn("username", "text")
          .addColumn("displayName", "text")
          .execute(),
      ],
    },
    "0002_rename_column": {
      up: async (db) => [
        await db.schema
          .alterTable("users")
          .renameColumn("displayName", "nickname")
          .execute(),
      ],
    },
  } satisfies Migrations;

  // --- Start Debugging ProcessTable ---
  type Migs = typeof migrations;
  type UsersTable = MergedSchemaBeforeDrop<Migs>["users"];

  // This extracts the original column name from the __renamed tag.
  // Should resolve to "displayName".
  type RenamedFromKeys = {
    [P in keyof UsersTable]: UsersTable[P] extends { __renamed: infer From }
      ? From
      : never;
  }[keyof UsersTable];

  // These are the keys that should be left after filtering.
  // Should be "nickname".
  type KeptKeys = keyof {
    [K in keyof UsersTable as UsersTable[K] extends never
      ? never
      : K extends RenamedFromKeys
      ? never
      : K]: any;
  };

  // This is the table after we've removed the old/dropped columns.
  type TableWithKeysKept = {
    [K in KeptKeys]: UsersTable[K];
  };

  // This is the final table after we've mapped the __renamed tag to the original type.
  type FinalTable = Prettify<{
    [K in keyof TableWithKeysKept]: TableWithKeysKept[K] extends {
      __renamed: infer From extends keyof UsersTable;
    }
      ? UsersTable[From]
      : TableWithKeysKept[K];
  }>;
  // --- End Debugging ProcessTable ---

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      id: number;
      username: string;
      nickname: string;
    };
  };

  type Test = Expect<Equal<Actual, Expected>>;
};

(_it = "alterTable alterColumn setDataType and setDefault") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("age", "integer")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .alterColumn("age", (col) => col.setDataType("text"))
            .alterColumn("age", (col) => col.setDefault("unknown"))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type PrintedSigh = PrintType<Sigh>
      age: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable alterColumn dropDefault, setNotNull, dropNotNull") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("age", "integer")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
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
  //(_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable addUniqueConstraint") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("firstName", "text")
            .addColumn("lastName", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .addUniqueConstraint("unique_name", ["firstName", "lastName"])
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      firstName: string;
      lastName: string;
    };
  };
  //(_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable drop column") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("age", "integer")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .dropColumn("age")
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
  //(_test: Expect<Equal<Actual, Expected>>) => {};
};
