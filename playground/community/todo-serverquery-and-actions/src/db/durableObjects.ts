import { SqliteDurableObject } from "rwsdk/db";
import { migrations } from "@/db/migrations";

export class Database extends SqliteDurableObject {
  migrations = migrations;
}