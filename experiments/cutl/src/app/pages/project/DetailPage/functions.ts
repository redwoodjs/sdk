"use server";

import {
  type Project,
} from "@prisma/client";
import { db } from "../../../../db";
import type { ProjectItem } from './ProjectDetailPage';



export interface BoardPiece {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function saveProject(id: string, project: Omit<Project, 'cutlistItems'>, cutlistItems: ProjectItem[], userId: string) {

  await db.project.findFirstOrThrow({
    where: {
      id,
      userId: userId
    }
  })

  const data = {
    title: project.title,
    boardWidth: project.boardWidth,
    boardLength: project.boardLength,
    bladeWidth: project.bladeWidth,
    boardPrice: project.boardPrice,
    cutlistItems: JSON.stringify(cutlistItems),
  }

  await db.project.update({
    data,
    where: {
      id,
    }
  })
}

export async function findOptimalPacking(
  panels: { width: number; height: number }[],
  boardWidth: number,
  boardHeight: number,
  bladeWidth: number
) {
  // Import Guillotine Packer dynamically for Cloudflare Workers
  const Packer = await import('guillotine-packer');
  const packer = Packer.packer;

  const totalPanelArea = panels.reduce((sum, panel) => sum + (panel.width * panel.height), 0);
const boardArea = boardWidth * boardHeight;

console.log("📏 Total Panel Area:", totalPanelArea);
console.log("📐 Board Area:", boardArea);
console.log("🔪 Blade Width:", bladeWidth);
console.log("📝 Expected Board Usage:", totalPanelArea / boardArea);




const forcedSortStrategy = Packer.SortStrategy.Area;  // Sort by area for better utilization
const forcedSplitStrategy = Packer.SplitStrategy.ShortLeftoverAxisSplit; // Favor short leftover areas
const forcedSelectionStrategy = Packer.SelectionStrategy.BEST_AREA_FIT; // Prioritize maximizing fit

console.log("🔧 Forcing Strategies:");
console.log("Sort Strategy:", forcedSortStrategy);
console.log("Split Strategy:", forcedSplitStrategy);
console.log("Selection Strategy:", forcedSelectionStrategy);


  const result = await packer(
    {
      binHeight: boardHeight,
      binWidth: boardWidth,
      items: panels.map((panel) => ({
        name: "panel",
        width: panel.width + bladeWidth,
        height: panel.height + bladeWidth,
      })),
    },
    {
      allowRotation: true, // Ensure rotation is enabled
      kerfSize: bladeWidth,
      sortStrategy: forcedSortStrategy,
      splitStrategy: forcedSplitStrategy,
      selectionStrategy: forcedSelectionStrategy
    }
  );
  return result;
}

