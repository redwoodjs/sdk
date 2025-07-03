import { CreateTableBuilder } from "./createTable";
import { AlterTableBuilder } from "./alterTable";
import { DropTableBuilder } from "./dropTable";
import { CreateViewBuilder } from "./createView";
import { DropViewBuilder } from "./dropView";
import {
  SchemaModule as KyselySchemaBuilder,
  CreateIndexBuilder,
  DropIndexBuilder,
  CreateSchemaBuilder,
  DropSchemaBuilder,
  CreateTypeBuilder,
  DropTypeBuilder,
  KyselyPlugin,
  RefreshMaterializedViewBuilder,
} from "kysely";
import type { Assert, AssertStillImplements } from "../assert";

export interface SchemaBuilder {
  createTable<TName extends string>(name: TName): CreateTableBuilder<TName, {}>;
  alterTable<TName extends string>(name: TName): AlterTableBuilder<TName, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  createView<TName extends string>(
    name: TName,
  ): CreateViewBuilder<TName, never>;
  dropView<TName extends string>(name: TName): DropViewBuilder<TName>;
  withSchema(schema: string): this;
  createIndex(name: string): CreateIndexBuilder;
  dropIndex(name: string): DropIndexBuilder;
  createSchema(name: string): CreateSchemaBuilder;
  dropSchema(name: string): DropSchemaBuilder;
  createType(name: string): CreateTypeBuilder;
  dropType(name: string): DropTypeBuilder;
  refreshMaterializedView(viewName: string): RefreshMaterializedViewBuilder;
  $call<T>(func: (qb: this) => T): T;
  withPlugin(plugin: KyselyPlugin): this;
  withoutPlugins(): this;
}

type _Assert = Assert<
  AssertStillImplements<SchemaBuilder, KyselySchemaBuilder>
>;
