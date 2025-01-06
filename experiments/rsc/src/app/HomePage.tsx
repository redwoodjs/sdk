import { db } from "../db";
import { Like } from "./components/Like";
import { getCount } from "./counterState";

export default async function HomePage() {
  let users = await db.user.findMany();

  if (users.length === 0) {
    await db.user.create({
      data: {
        name: "Steve",
        cellnumber: "1234567890",
      },
    });

    users = await db.user.findMany();
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
