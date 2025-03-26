"use server";

import { RouteOptions } from "@redwoodjs/sdk/router";

export async function sendMessage(
  message: string,
  ...[{ env }]: [RouteOptions]
) {
  const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    prompt: message,
    stream: true,
  });

  return response as unknown as ReadableStream;
}
