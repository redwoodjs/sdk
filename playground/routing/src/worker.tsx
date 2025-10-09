import { layout, prefix, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
);

const DashboardLayout: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => <div>{children}</div>;

const Dashboard = () => <div>Dashboard</div>;
const Auth = () => <div>Auth Page</div>;

const health = () => new Response("OK");
const trpc = () => new Response("tRPC");
const auth = {
  handler: (request: Request) => new Response("Auth handler"),
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    layout(AppLayout, [route("/", Home)]),
    prefix("/dashboard", [
      layout(DashboardLayout, [
        ({ ctx, request }) => {
          // @ts-expect-error - user is not on ctx
          if (!ctx.user)
            return Response.redirect(new URL("/auth", request.url));
        },
        route("/", Dashboard),
      ]),
    ]),
    prefix("/api", [
      route("/health", health),
      route("/trpc/*", trpc),
      route("/auth/*", ({ request }) => auth.handler(request)),
    ]),
    route("/auth", Auth),
  ]),
]);
