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
      {Object.entries(
        tradesmen.reduce((acc, tradesman) => {
          const { profession } = tradesman;
          if (!acc[profession]) {
            acc[profession] = [];
          }
          acc[profession].push(tradesman);
          return acc;
        }, {} as Record<string, typeof tradesmen>)
      ).map(([profession, groupedTradesmen]) => {
        return (
          <div key={profession}>
            <h2 className="text-xl font-bold">{profession}</h2>
            {groupedTradesmen.map((tradesman) => (
              <div key={tradesman.id}>
            {tradesman.name} ({tradesman.cellnumber})
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
