import type { Database, Migrations } from "../database";
import type { Equal, Expect } from "./testUtils";

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
  (_test: Expect<Equal<Actual, Expected>>) => {};
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

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      id: number;
      username: string;
      nickname: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
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

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
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
          await db.schema.alterTable("users").dropColumn("age").execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {};
  };
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameTable") => {
  const migrations = {
    "0001_initial": {
      up: async (db) => [
        await db.schema
          .createTable("users")
          .addColumn("id", "integer")
          .execute(),
      ],
    },
    "0002_rename_table": {
      up: async (db) => [
        await db.schema.alterTable("users").renameTo("customers").execute(),
      ],
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    customers: {
      id: number;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameColumn then rename again") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("name", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .renameColumn("name", "firstName")
            .execute(),
        ];
      },
    },
    "2": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .renameColumn("firstName", "givenName")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      givenName: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameColumn then rename back") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("name", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .renameColumn("name", "firstName")
            .execute(),
        ];
      },
    },
    "2": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .renameColumn("firstName", "name")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      name: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameTable then rename again") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("id", "integer")
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
        return [
          await db.schema.alterTable("customers").renameTo("clients").execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    clients: {
      id: number;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameTable then rename back") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("id", "integer")
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
        return [
          await db.schema.alterTable("customers").renameTo("users").execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      id: number;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable renameColumn then drop") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("name", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .renameColumn("name", "firstName")
            .execute(),
        ];
      },
    },
    "2": {
      async up(db) {
        return [
          await db.schema.alterTable("users").dropColumn("firstName").execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {};
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "alterTable dropColumn then add back") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("name", "text")
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          await db.schema.alterTable("users").dropColumn("name").execute(),
        ];
      },
    },
    "2": {
      async up(db) {
        return [
          await db.schema
            .alterTable("users")
            .addColumn("name", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      name: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};
