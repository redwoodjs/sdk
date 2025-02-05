import { Layout } from "../Layout";
import { RouteContext } from "../../../lib/router";
import { link } from '../../shared/links'

export default function HomePage({ ctx}: RouteContext) {
  return (
    <Layout ctx={ctx}>
      home page, lets show the calculator here too for free users. Signed in users can save and load cutlists.
    </Layout>
  );
}
