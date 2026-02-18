import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { DocPageViewView } from "@/app/pages/DocPageView";
import { setCommonHeaders } from "@/app/headers";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(Document, [
    route("/", () => <DocPageView slug="index" />),
    route("/*", ({ params }) => <DocPageView slug={params.$0} />),
  ]),
]);
