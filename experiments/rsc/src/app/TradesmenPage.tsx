import { db } from "../db";

export default async function TradesmenPage(props: { profession: string }) {
  const tradesmen = await db
    .selectFrom("Tradesman")
    .selectAll()
    .where("profession", "=", props.profession)
    .execute();

  if (tradesmen.length === 0) {
    return <div>No tradesmen found for {props.profession}</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen max-w-md mx-auto">
      <h1 className="text-3xl text-gray-800 font-bold text-center mb-4">
        We have the following {props.profession} in our directory{" "}
      </h1>
      <div className="flex flex-col items-center justify-center w-full">
        {tradesmen.map((tradesman) => (
          <a
            key={tradesman.id}
            className="text-sm font-bold text-gray-600 hover:text-gray-800 bg-gray-100 p-4 rounded-md mb-2 w-full"
            href={`/tradesmen/${tradesman.id}`}
          >
            {tradesman.name}
          </a>
        ))}
      </div>
    </div>
  );
}
