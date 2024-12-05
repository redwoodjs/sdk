import CreateUser from "./components/CreateUser";
import Login from "./components/Login";
import { db } from "../db";

import CreateTradesman from "./components/CreateTradesman";

export default async function AdminPage() {
  let tradesmen = await db
    .selectFrom("Tradesman")
    .select(["id", "name", "cellnumber", "profession"])
    .execute();

  const users = await db
    .selectFrom("User")
    .select(["id", "name", "cellnumber"])
    .execute();

  const isAuthenticated = true;
  return (
    <div className="p-4">
      <h1>Admin Page</h1>
      {isAuthenticated ? (
        <>
          <h2>Users</h2>
          {users.map((user) => (
            <div key={user.id}>
              {user.name} ({user.cellnumber})
            </div>
          ))}
          <hr />
          <CreateUser />
          <hr />
          {tradesmen.map((tradesman) => (
            <div key={tradesman.id}>
              {tradesman.name} ({tradesman.cellnumber})
            </div>
          ))}
          <CreateTradesman />
        </>
      ) : (
        <Login />
      )}
    </div>
  );
}
