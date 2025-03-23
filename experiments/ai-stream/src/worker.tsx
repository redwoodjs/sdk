import { defineApp } from "@redwoodjs/sdk/worker";
import { index, layout } from "@redwoodjs/sdk/router";
import { Document } from "src/Document";
import { Home } from "src/pages/Home";
import { setCommonHeaders } from "src/headers";

type Context = {};

export default defineApp<Context>([
  setCommonHeaders(),
  async ({ ctx, env }) => {
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      prompt: "What is the origin of the phrase Hello, World",
    });

    return new Response(JSON.stringify(response));
  },
  layout(Document, [index([Home])]),
]);
