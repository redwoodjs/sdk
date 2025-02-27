"use server"

import { db } from "@/db"

export async function updateUser(data: any) {
  try {
    const user = await db.user.update({
      where: {
        id: "1", // TODO: Make this dynamic
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}
