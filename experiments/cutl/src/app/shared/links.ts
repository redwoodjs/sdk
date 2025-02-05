import { defineLinks } from "../../lib/links";

export const link = defineLinks([
  '/',

  '/auth/login',
  '/auth/logout',
  '/auth/callback',

  '/project/list',
  '/project/:id',
  '/project/:id/detail',
])


