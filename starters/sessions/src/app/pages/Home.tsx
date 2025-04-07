import { requestContext } from "@redwoodjs/sdk/worker";

export function Home() {
  const { data } = requestContext;
  return (
    <div>
      {data.session?.userId
        ? `You are logged in as user ${data.session.userId}`
        : "You are not logged in"}
    </div>
  );
}
