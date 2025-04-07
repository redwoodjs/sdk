import { AppContext } from "@/worker";

export function Home({ appContext }: { appContext: AppContext }) {
  return (
    <div>
      <p>
        {appContext.user?.username
          ? `You are logged in as user ${appContext.user.username}`
          : "You are not logged in"}
      </p>
    </div>
  );
}
