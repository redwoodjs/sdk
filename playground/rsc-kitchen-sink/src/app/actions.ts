"use server";

import { requestInfo } from "rwsdk/worker";

export async function formAction(formData: FormData) {
  const text = formData.get("text") as string;
  return `Message from form action: ${text || "No text entered"}`;
}

export async function onClickAction() {
  return `Message from onClick action at ${new Date().toLocaleTimeString()}`;
}

export async function redirectFromKitchenSink() {
  const { request } = requestInfo;
  const url = new URL("/about", request.url);
  return Response.redirect(url.href, 302);
}

export async function formRedirectAction(_formData: FormData) {
  const { request } = requestInfo;
  const url = new URL("/about?fromForm=true", request.url);
  return Response.redirect(url.href, 302);
}
