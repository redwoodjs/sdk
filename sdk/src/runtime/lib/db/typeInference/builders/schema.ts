import { TableBuilder } from "./table";
import { AlterTableBuilder } from "./alterTable";
import { DropTableBuilder } from "./dropTable";
import { CreateViewBuilder } from "./createView";
import { DropViewBuilder } from "./dropView";
import { SchemaModule as KyselySchemaBuilder } from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface SchemaBuilder {
  createTable<TName extends string>(name: TName): TableBuilder<TName, {}>;
  alterTable<TName extends string>(name: TName): AlterTableBuilder<TName, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  createView<TName extends string>(name: TName): CreateViewBuilder<TName, {}>;
  dropView<TName extends string>(name: TName): DropViewBuilder<TName>;
  alterView(name: string): any;
  withSchema(schema: string): this;
  createIndex(name: string): any;
  dropIndex(name: string): any;
  createSchema(name: string): any;
  dropSchema(name: string): any;
  createType(name: string): any;
  dropType(name: string): any;
  toOperationNode(): any;
  $call<T>(func: (qb: this) => T): T;
}

type _Assert = Assert<
  AssertStillImplements<SchemaBuilder, KyselySchemaBuilder>
>;
