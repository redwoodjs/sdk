import { ExecutedBuilder } from "../utils";

export interface DropTableBuilder<TName extends string> {
  readonly __tableName: TName;
  ifExists(): DropTableBuilder<TName>;
  cascade(): DropTableBuilder<TName>;
  execute(): ExecutedBuilder<this>;
}
