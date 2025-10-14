"use server";

import isOdd from "is-odd";

export async function doServerAction() {
  return `Is 3 odd? ${isOdd(3) ? "Yes" : "No"}`;
}
