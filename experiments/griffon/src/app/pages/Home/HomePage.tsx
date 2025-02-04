import { Layout } from "../Layout";
import { RouteContext } from "../../../lib/router";

export default function HomePage({ ctx}: RouteContext) {
  return (
    <Layout ctx={ctx}>
      home page
    </Layout>
  );
}
