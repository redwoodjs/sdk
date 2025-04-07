import { requestContext } from "@redwoodjs/sdk/worker";

export function Home() {
  return (
    <div>
      <p>
        {requestContext.data.user?.username
          ? `You are logged in as user ${requestContext.data.user.username}`
          : "You are not logged in"}
      </p>
    </div>
  );
}
