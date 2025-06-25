import type { Kysely } from "kysely";
import type { Migration, Database } from "../typeInference";
import type { Expect, Equal } from "./test-utils";

(test = "createTable") => {
  const migrations = {
    "0": {
      async up(db: Kysely<any>) {
        return db.schema
          .createTable("users")
          .addColumn("username", "text", (col) => col.notNull().unique())
          .execute();
      },
    },
  } as const;

  type DB = Database<typeof migrations>;

  type test = [
    Expect<
      Equal<
        DB,
        {
          users: {
            username: number;
          };
        }
      >
    >,
  ];
};

//(test = "addColumn with default value") => {
//  const migrations = {
//    "0": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .createTable("users")
//          .addColumn("username", "text", (col) => col.notNull().unique())
//          .addColumn("posts", "integer", (col) => col.defaultTo(0).notNull())
//          .execute();
//      },
//    },
//  } as const;
//
//  type DB = Database<typeof migrations>;
//
//  type test = [
//    Expect<
//      Equal<
//        DB,
//        {
//          users: {
//            username: string;
//            posts: number;
//          };
//        }
//      >
//    >,
//  ];
//};
//
//(test = "alterTable") => {
//  const migrations = {
//    "0": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .createTable("users")
//          .addColumn("username", "text", (col) => col.notNull().unique())
//          .execute();
//      },
//    },
//    "1": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .alterTable("users")
//          .addColumn("displayName", "text")
//          .execute();
//      },
//    },
//  } as const;
//
//  type DB = Database<typeof migrations>;
//
//  type test = [
//    Expect<
//      Equal<
//        DB,
//        {
//          users: {
//            username: string;
//            displayName: string;
//          };
//        }
//      >
//    >,
//  ];
//};
//
//(test = "dropTable") => {
//  const migrations = {
//    "0": {
//      async up(db: Kysely<any>) {
//        return [
//          db.schema
//            .createTable("users")
//            .addColumn("username", "text", (col) => col.notNull().unique())
//            .execute(),
//          db.schema.createTable("posts").addColumn("title", "text").execute(),
//        ];
//      },
//    },
//    "1": {
//      async up(db: Kysely<any>) {
//        return db.schema.dropTable("posts").execute();
//      },
//    },
//  } as const;
//
//  type DB = Database<typeof migrations>;
//
//  type test = [
//    Expect<
//      Equal<
//        DB,
//        {
//          users: {
//            username: string;
//          };
//        }
//      >
//    >,
//  ];
//};
//
//(test = "renameTable") => {
//  const migrations = {
//    "0": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .createTable("users")
//          .addColumn("username", "text", (col) => col.notNull().unique())
//          .execute();
//      },
//    },
//    "1": {
//      async up(db: Kysely<any>) {
//        return db.schema.renameTable("users", "users_new").execute();
//      },
//    },
//  } as const;
//
//  type DB = Database<typeof migrations>;
//
//  type test = [
//    Expect<
//      Equal<
//        DB,
//        {
//          users_new: {
//            username: string;
//          };
//        }
//      >
//    >,
//  ];
//};
//
//(test = "dropColumn") => {
//  const migrations = {
//    "0": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .createTable("users")
//          .addColumn("username", "text", (col) => col.notNull().unique())
//          .addColumn("posts", "integer", (col) => col.defaultTo(0).notNull())
//          .execute();
//      },
//    },
//    "1": {
//      async up(db: Kysely<any>) {
//        return db.schema.alterTable("users").dropColumn("posts").execute();
//      },
//    },
//  } as const;
//
//  type DB = Database<typeof migrations>;
//
//  type test = [
//    Expect<
//      Equal<
//        DB,
//        {
//          users: {
//            username: string;
//          };
//        }
//      >
//    >,
//  ];
//};
//
//(test = "renameColumn") => {
//  const migrations = {
//    "0": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .createTable("users")
//          .addColumn("username", "text", (col) => col.notNull().unique())
//          .execute();
//      },
//    },
//    "1": {
//      async up(db: Kysely<any>) {
//        return db.schema
//          .alterTable("users")
//          .renameColumn("username", "handle")
//          .execute();
//      },
//    },
//  } as const;
//
//  type DB = Database<typeof migrations>;
//
//  type test = [
//    Expect<
//      Equal<
//        DB,
//        {
//          users: {
//            handle: string;
//          };
//        }
//      >
//    >,
//  ];
//};
//
