import { ExecutedBuilder } from "../utils";

export interface DropViewBuilder<TName extends string> {
  readonly __viewName: TName;
  ifExists(): this;
  cascade(): this;
  execute(): ExecutedBuilder<this>;
}
