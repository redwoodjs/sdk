import { users } from "../../db/schema";
import { RouteOptions } from "@redwoodjs/sdk/router";
import { AppContext } from "@/worker";

export async function Home({ appContext }: RouteOptions<AppContext>) {
  const allUsers = await appContext.db.select().from(users).all();
  return (
    <div>
      <h1>Hello World</h1>
      <pre>{JSON.stringify(allUsers, null, 2)}</pre>
    </div>
  );
}
