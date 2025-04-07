import { requestContext } from "@redwoodjs/sdk/worker";

export function Home() {
  const { data } = requestContext;
  return (
    <div>
      {data.user?.username
        ? `You are logged in as user ${data.user.username}`
        : "You are not logged in"}
    </div>
  );
}
