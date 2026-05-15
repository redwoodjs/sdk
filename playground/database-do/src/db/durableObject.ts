import { migrations } from "@/db/migrations";
import { SqliteDurableObject } from "rwsdk/db";

export class AppDurableObject extends SqliteDurableObject {
  migrations = migrations;
}
