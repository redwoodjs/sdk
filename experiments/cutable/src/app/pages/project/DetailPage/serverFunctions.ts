"use server";

import { type Project } from "@prisma/client";
import { db } from "../../../../db";
import type { ProjectItem } from "./ProjectDetailPage";

export interface BoardPiece {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function saveProject(
  id: string,
  project: Omit<Project, "cutlistItems">,
  cutlistItems: ProjectItem[],
  userId: string,
) {
  await db.project.findFirstOrThrow({
    where: {
      id,
      userId: userId,
    },
  });

  const data = {
    title: project.title,
    boardWidth: project.boardWidth,
    boardLength: project.boardLength,
    bladeWidth: project.bladeWidth,
    boardPrice: project.boardPrice,
    cutlistItems: JSON.stringify(cutlistItems),
  };

  await db.project.update({
    data,
    where: {
      id,
    },
  });
}
