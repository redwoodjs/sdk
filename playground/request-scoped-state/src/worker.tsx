import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { CounterPage } from "@/app/pages/CounterPage";
import { Home } from "@/app/pages/Home";
import { Counter } from "./lib/counter.js";
import { setCounter } from "./lib/counterState.js";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    setCounter(new Counter(0, crypto.randomUUID()));
    ctx;
  },
  render(Document, [route("/", Home), route("/counter", CounterPage)]),
]);
