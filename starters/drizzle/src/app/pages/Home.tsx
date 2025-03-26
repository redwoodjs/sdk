import { users } from "../../db/schema";
import { RouteOptions } from "@redwoodjs/sdk/router";

export async function Home({ ctx }: RouteOptions) {
  const allUsers = await ctx.db.select().from(users).all();
  return (
    <div>
      <h1>Hello World</h1>
      <pre>{JSON.stringify(allUsers, null, 2)}</pre>
    </div>
  );
}
