import { users } from "../../db/schema";
import { requestContext } from "@redwoodjs/sdk/worker";

export async function Home() {
  const allUsers = await requestContext.data.db.select().from(users).all();
  return (
    <div>
      <h1>Hello World</h1>
      <pre>{JSON.stringify(allUsers, null, 2)}</pre>
    </div>
  );
}
