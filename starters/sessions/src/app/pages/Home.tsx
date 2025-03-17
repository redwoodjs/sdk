import { Context } from "@/worker";

export function Home({ ctx }: { ctx: Context }) {
  return (
    <div>
      <p>
        {ctx.session?.userId
          ? `You are logged in as user ${ctx.session.userId}`
          : "You are not logged in"}
      </p>
    </div>
  );
}
