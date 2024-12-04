"use server";
import { db } from "../db";

export async function createTradesman(formData: FormData) {
  const name = formData.get("name");
  const cellnumber = formData.get("cellnumber");
  const profession = formData.get("profession");

  await db
    .insertInto("Tradesman")
    .values({
      name: name as string,
      cellnumber: cellnumber as string,
      profession: profession as string,
    })
    .execute();
}
