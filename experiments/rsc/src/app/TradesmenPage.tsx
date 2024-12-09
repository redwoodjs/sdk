import { db } from "../db";

export default async function TradesmenPage() {
    const tradesmen = await db.selectFrom("Tradesman").selectAll().execute();     
    const uniqueProfessions = [...new Set(tradesmen.map((tradesman) => tradesman.profession).filter((profession) => profession !== null))];
  return (
    <div className="flex flex-col items-center justify-center h-screen max-w-md mx-auto">
      <h1 className="text-3xl text-gray-800 font-bold text-center mb-4">What kind of tradesman are you looking for?</h1>
      <div className="flex flex-col items-center justify-center w-full">
        {uniqueProfessions.map((profession) => (
          <a key={profession} className="text-sm font-bold text-gray-600 hover:text-gray-800 bg-gray-100 p-4 rounded-md mb-2 w-full" href={`/tradesmen/${profession}`}>{profession}</a>
        ))}
      </div>
    </div>
  );
}
