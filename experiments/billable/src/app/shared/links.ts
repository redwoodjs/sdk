import { defineLinks } from "redwoodsdk/router";

export const link = defineLinks([
  "/",

  "/user/login",
  "/user/logout",
  "/user/auth",

  "/invoice/list",
  "/invoice/:id",
  "/invoice/:id/upload",
  "/invoice/logos",
]);
