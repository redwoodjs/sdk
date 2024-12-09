import { db } from "../db";

export default async function TradesmenPage(request: Request) {
  const profession = new URL(request.url).pathname.split("/").pop() ?? "";
  const tradesmen = await db
    .selectFrom("Tradesman")
    .selectAll()
    .where("profession", "=", profession)
    .execute();
  const uniqueProfessions = [
    ...new Set(
      tradesmen
        .map((tradesman) => tradesman.profession)
        .filter((profession) => profession !== null),
    ),
  ];

  if (tradesmen.length === 0) {
    return <div>No tradesmen found for {profession}</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen max-w-md mx-auto">
      <h1 className="text-3xl text-gray-800 font-bold text-center mb-4">
        We have the following {profession} in our directory{" "}
      </h1>
      <div className="flex flex-col items-center justify-center w-full">
        {uniqueProfessions.map((profession) => (
          <a
            key={profession}
            className="text-sm font-bold text-gray-600 hover:text-gray-800 bg-gray-100 p-4 rounded-md mb-2 w-full"
            href={`/tradesmen/${profession}`}
          >
            {profession}
          </a>
        ))}
      </div>
    </div>
  );
}
