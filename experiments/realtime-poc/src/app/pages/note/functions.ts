"use server";

import { RouteOptions } from "@redwoodjs/sdk/router";

export const getContent = async (key: string, opts?: RouteOptions) => {
  const doId = opts!.env.NOTE_DURABLE_OBJECT.idFromName(key);
  const noteDO = opts!.env.NOTE_DURABLE_OBJECT.get(doId);
  return noteDO.getContent();
};

export const updateContent = async (
  key: string,
  content: string,
  opts?: RouteOptions,
) => {
  const doId = opts!.env.NOTE_DURABLE_OBJECT.idFromName(key);
  const noteDO = opts!.env.NOTE_DURABLE_OBJECT.get(doId);
  await noteDO.setContent(content);
};
