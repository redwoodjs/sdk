import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Chat } from "src/pages/Chat/Chat";
import { setCommonHeaders } from "src/headers";

type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  render(Document, [index([Chat])]),
]);
