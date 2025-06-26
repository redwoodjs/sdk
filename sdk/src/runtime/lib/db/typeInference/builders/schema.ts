import { TableBuilder } from "./table";
import { AlterTableBuilder } from "./alterTable";
import { DropTableBuilder } from "./dropTable";
import { CreateViewBuilder } from "./createView";
import { DropViewBuilder } from "./dropView";

export interface SchemaBuilder {
  createTable<TName extends string>(name: TName): TableBuilder<TName, {}>;
  alterTable<TName extends string>(name: TName): AlterTableBuilder<TName, {}>;
  dropTable<TName extends string>(name: TName): DropTableBuilder<TName>;
  createView<TName extends string>(name: TName): CreateViewBuilder<TName, {}>;
  dropView<TName extends string>(name: TName): DropViewBuilder<TName>;
}
