"use server"

import { db } from "@/db"

export async function updateUser(data: any) {
  try {
    const user = await db.user.update({
      where: {
        id: "c87fe526-3415-44fb-9a87-b7ab2f119314", // TODO: Make this dynamic
      },
      data: data,
    });
    console.log(user);

    return {
      success: true,
      error: null,
      user,
    }
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}
