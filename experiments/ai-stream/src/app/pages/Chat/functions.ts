"use server";

import { RouteContext } from "@redwoodjs/sdk/router";

export async function sendMessage(message: string, ctx?: RouteContext) {
  const response = await ctx!.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    prompt: message,
    stream: true,
  });

  return response as unknown as ReadableStream;
}
