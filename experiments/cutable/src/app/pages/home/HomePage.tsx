import { RouteOptions } from "@redwoodjs/sdk/router";
import { Layout } from "../Layout";
import { CalculateSheets } from "./CalculateSheets";
// import { Test } from "./Test"
export default function HomePage({ ctx }: RouteOptions) {
  return (
    <Layout ctx={ctx}>
      <CalculateSheets />
      {/* <Test /> */}
    </Layout>
  );
}
