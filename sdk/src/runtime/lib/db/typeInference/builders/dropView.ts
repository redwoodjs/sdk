import { ExecutedBuilder } from "../utils";

export interface DropViewBuilder<TName extends string> {
  readonly __viewName: TName;
  ifExists(): DropViewBuilder<TName>;
  cascade(): DropViewBuilder<TName>;
  execute(): Promise<ExecutedBuilder<this>>;
}
