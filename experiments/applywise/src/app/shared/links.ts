import { defineLinks } from "@redwoodjs/reloaded/router";

export const link = defineLinks([
  '/',
  '/login',
  '/signup',
  '/logout',
  '/applications',
  '/applications/new',
  '/applications/update',
  '/applications/:id',
  '/account/settings',
])


