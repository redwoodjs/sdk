import { RouteOptions } from "../../../lib/router";
import { Layout } from "../Layout";
import { CalculateSheets } from "./CalculateSheets";
// import { Test } from "./Test"
export default function HomePage({ appContext }: RouteOptions) {
  return (
    <Layout appContext={appContext}>
      <CalculateSheets />
      {/* <Test /> */}
    </Layout>
  );
}
