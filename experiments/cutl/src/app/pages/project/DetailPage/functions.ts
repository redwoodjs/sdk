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
        width: panel.width,
        height: panel.height,
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

export function calculateFreeSpaces(usedRects, boardWidth, boardHeight) {
  let freeRects = [];

  // Sort panels by position (top-left first)
  usedRects.sort((a, b) => a.y - b.y || a.x - b.x);

  let occupiedMap = Array.from({ length: boardHeight }, () =>
    Array(boardWidth).fill(false)
  );

  // Mark occupied areas
  usedRects.forEach(rect => {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        occupiedMap[y][x] = true;
      }
    }
  });

  // Find gaps (unused spaces)
  for (let y = 0; y < boardHeight; y++) {
    for (let x = 0; x < boardWidth; x++) {
      if (!occupiedMap[y][x]) {
        let width = 1;
        let height = 1;

        // Expand width while space is free
        while (x + width < boardWidth && !occupiedMap[y][x + width]) {
          width++;
        }

        // Expand height while space is free
        while (y + height < boardHeight && !occupiedMap[y + height][x]) {
          height++;
        }

        freeRects.push({ x, y, width, height });

        // Mark area as processed
        for (let fy = y; fy < y + height; fy++) {
          for (let fx = x; fx < x + width; fx++) {
            occupiedMap[fy][fx] = true;
          }
        }
      }
    }
  }

  return freeRects;
}
