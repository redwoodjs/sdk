"use server";

import { RouteContext } from "redwoodsdk/router";

export const updateDocument = async (content: string, ctx?: RouteContext) => {
  ctx!.env.REALTIME_DURABLE_OBJECT;
};
