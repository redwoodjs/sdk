"use server";

import { RouteContext } from "redwoodsdk/router";

export const getContent = async (key: string, ctx?: RouteContext) => {
  console.log("##", ctx!.env);
  const doId = ctx!.env.DOCUMENT_DURABLE_OBJECT.idFromName(key);
  const documentDO = ctx!.env.DOCUMENT_DURABLE_OBJECT.get(doId);
  return documentDO.getContent();
};

export const updateContent = async (
  key: string,
  content: string,
  ctx?: RouteContext,
) => {
  const doId = ctx!.env.DOCUMENT_DURABLE_OBJECT.idFromName(key);
  const documentDO = ctx!.env.DOCUMENT_DURABLE_OBJECT.get(doId);
  await documentDO.setContent(content);
};
