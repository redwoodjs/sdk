import { Layout } from "../Layout";
import { SearchTerminal } from "./SearchTerminal";
import { Context } from "../../../worker";

export default function HomePage({ ctx }: { ctx: Context }) {
  return (
    <Layout>
      <SearchTerminal ctx={ctx} />
    </Layout>
  );
}
