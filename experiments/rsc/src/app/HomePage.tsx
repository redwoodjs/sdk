import { db } from "../db";
import { Like } from "./components/Like";
import { getCount } from "./counterState";

export default async function HomePage() {
  let users = await db
    .selectFrom("User")
    .select(["name", "cellnumber"])
    .execute();

  if (users.length === 0) {
    await db
      .insertInto("User")
      .values({
        name: "Steve",
        cellnumber: "1234567890",
      })
      .execute();

    users = await db
      .selectFrom("User")
      .select(["name", "cellnumber"])
      .execute();
  }

  return (
    <div>
      {JSON.stringify(users)}
      <br />
      <Like />
      <br />
      counter state: {getCount()}
    </div>
  );
}
