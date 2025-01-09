"use server";
import { data } from "autoprefixer";
import { db } from "../../../db";

// this needs context? E.g.: We need to be able to get the current user "anywhere", instead of passing it in as
// a variable.
export async function saveInvoice(id: number, invoice) {
  // validate that the user has access to this invoice.

  await db.invoice.update({
    data: {
      notesB: "heylldoksopdksap",
    },
    where: {
      id,
    },
  });

}
