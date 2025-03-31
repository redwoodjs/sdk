import { AppContext } from "@/worker";

export function Home({ appContext }: { appContext: AppContext }) {
  return (
    <div>
      <p>
        {appContext.session?.userId
          ? `You are logged in as user ${appContext.session.userId}`
          : "You are not logged in"}
      </p>
    </div>
  );
}
