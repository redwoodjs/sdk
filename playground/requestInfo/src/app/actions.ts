"use server";

//import isOdd from "is-odd";
import { requestInfo } from "rwsdk/worker";

export async function doServerAction() {
  const { response } = requestInfo;
  response.headers.set("X-Server-Action-Success", "true");
  return `Is 3 odd? ${/* isOdd(3) ? "Yes" : "No" */ ""}`;
}
