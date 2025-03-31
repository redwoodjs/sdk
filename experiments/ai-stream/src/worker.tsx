import { defineApp } from "@redwoodjs/sdk/worker";
import { index, render } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Chat } from "src/pages/Chat/Chat";
import { setCommonHeaders } from "src/headers";

type AppContext = {};

export default defineApp<AppContext>([
  setCommonHeaders(),
  render(Document, [index([Chat])]),
]);
