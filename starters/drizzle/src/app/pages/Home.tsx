
import { users } from "../../db/schema";
import { RouteContext } from "@redwoodjs/sdk/router";

export async function Home({ ctx }: RouteContext) {
  const allUsers = await ctx.db.select().from(users).all();
  return (
    <div>
      <h1>Hello World</h1>
      <pre>{JSON.stringify(allUsers, null, 2)}</pre>
    </div>
  );
}
