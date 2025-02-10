import { RouteContext } from '@redwoodjs/reloaded/worker';
import { Layout } from "../Layout";

export default function HomePage({ ctx }: RouteContext) {
  return (
    <Layout ctx={ctx}>
      This will be an invoice, but when you try to save it it'll just say that you need to create an account.
    </Layout>
  );
}
