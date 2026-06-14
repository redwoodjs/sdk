import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import {
  DefaultCanary,
  DuplicateCanary,
  DynamicCanary,
  MixedCanary,
  NamedCanary,
  ReExportCanary,
  ServerProofCanary,
  TypeDiagnosticCanary,
} from "@/app/pages/ClientReferenceCanaries";
import { Home } from "@/app/pages/Home";
import { SsrFalse } from "@/app/pages/SsrFalse";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [route("/", Home)]),
  render(Document, [route("/canary/named", NamedCanary)]),
  render(Document, [route("/canary/default", DefaultCanary)]),
  render(Document, [route("/canary/mixed", MixedCanary)]),
  render(Document, [route("/canary/re-export", ReExportCanary)]),
  render(Document, [route("/canary/duplicate", DuplicateCanary)]),
  render(Document, [route("/canary/dynamic", DynamicCanary)]),
  render(Document, [route("/canary/server-proof", ServerProofCanary)]),
  render(Document, [route("/canary/types", TypeDiagnosticCanary)]),
  render(Document, [route("/ssr-off/", SsrFalse)], { ssr: false }),
]);
