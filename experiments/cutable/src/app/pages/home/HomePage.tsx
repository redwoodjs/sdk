import { RouteContext } from "redwoodsdk/router"
import { Layout } from "../Layout"
import {CalculateSheets} from "./CalculateSheets"
// import { Test } from "./Test"
export default function HomePage({ ctx }: RouteContext) {
  return (
    <Layout ctx={ctx}>
      <CalculateSheets />
      {/* <Test /> */}
    </Layout>
  )
}

