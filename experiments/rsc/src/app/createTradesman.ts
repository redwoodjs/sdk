"use server";
import { db } from "../db";
import { R2Storage } from "../r2storage";

export async function createTradesman(formData: FormData) {
  const name = formData.get("name");
  const cellnumber = formData.get("cellnumber");
  const profession = formData.get("profession");
  const profilePicture = formData.get("profilePicture") as File | null;
  if (!profilePicture) {
    throw new Error("profilePicture is required.");
  }
  const filename = (name as string)?.split(" ").join("-").toLowerCase() + ".jpg";
  const file = new File([profilePicture], filename, { type: "image/jpeg" });
  const profilePictureUrl = await R2Storage.uploadFile(file, filename);

  await db.tradesman.create({
    data: {
      name: name as string,
      cellnumber: cellnumber as string,
      profession: profession as string,
      profilePicture: profilePictureUrl as string,
    },
  });
}
