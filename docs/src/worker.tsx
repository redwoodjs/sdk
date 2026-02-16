import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { DocPage } from "@/app/pages/DocPage";
import { setCommonHeaders } from "@/app/headers";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(Document, [
    route("/", () => <DocPage slug="index" />),
    route("/*", ({ params }) => <DocPage slug={params.$0} />),
  ]),
]);
