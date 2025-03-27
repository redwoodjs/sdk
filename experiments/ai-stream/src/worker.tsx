import { defineApp } from "@redwoodjs/sdk/worker";
import { index, document } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Chat } from "src/pages/Chat/Chat";
import { setCommonHeaders } from "src/headers";

type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  document(Document, [index([Chat])]),
]);
