import { defineLinks } from "../../lib/links";

export const link = defineLinks([
  '/',

  '/user/login',
  '/user/logout',
  '/user/auth',

  '/invoice/list',
  '/invoice/:id',
  '/invoice/:id/upload',
  '/invoice/logos',
])


