import { db } from "../db";

import CreateTradesman from "./components/CreateTradesman";

export default async function AdminPage() {
  let tradesmen = await db
    .selectFrom("Tradesman")
    .select(["id", "name", "cellnumber", "profession"])
    .execute();

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-center py-4">Tradesmen</h1>
      <CreateTradesman />
      <hr />
      {tradesmen.map((tradesman) => (
        <div key={tradesman.id}>
          {tradesman.name} ({tradesman.cellnumber})
        </div>
      ))}
    </div>
  );
}
