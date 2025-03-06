"use server";

import {
  calculateFreeSpaces,
  findOptimalPacking,
} from "../project/DetailPage/clientFunctions";

export async function calculateCutsAction(
  panels: { width: number; length: number; quantity: number }[],
  sheetWidth: number,
  sheetLength: number,
  bladeWidth: number,
) {
  const packer = await findOptimalPacking(
    panels,
    sheetWidth,
    sheetLength,
    bladeWidth,
  );

  if (!packer) return null;

  const boards = packer.map((board: any) => {
    const usedRects = board.map((rect: any) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      length: rect.height,
    }));

    const freeRects = calculateFreeSpaces(
      usedRects,
      sheetWidth,
      sheetLength,
      bladeWidth,
    );

    // Calculate efficiency
    const totalSheetArea = sheetWidth * sheetLength;
    const usedArea = usedRects.reduce(
      (sum: number, rect: any) => sum + rect.width * rect.length,
      0,
    );
    const efficiency = usedArea / totalSheetArea;

    return {
      width: sheetWidth,
      length: sheetLength,
      usedRects,
      freeRects,
      efficiency, // Add efficiency to the returned data
    };
  });

  return boards;
}
