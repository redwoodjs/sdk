import { RouteContext } from "@redwoodjs/reloaded/router";
import { Layout } from "../Layout";
import {SearchTerminal} from "./SearchTerminal";

export default function HomePage({ ctx }: RouteContext) {
  return (
    <Layout ctx={ctx}>
      <SearchTerminal ctx={ctx} />
    </Layout>
  );
}
