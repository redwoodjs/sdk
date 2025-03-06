"use client";

// 🛑 Use a WeakMap for per-request caching (Cloudflare-Safe)
const REQUEST_CACHE = new WeakMap<object, Map<string, any>>();

export async function findOptimalPacking(
  panels: { width: number; length: number }[],
  boardWidth: number,
  boardLength: number,
  bladeWidth: number,
) {
  const cacheKey = JSON.stringify({
    panels,
    boardWidth,
    boardLength,
    bladeWidth,
  });

  // Ensure cache is created for each request
  let cache = REQUEST_CACHE.get(globalThis);
  if (!cache) {
    cache = new Map<string, any>();
    REQUEST_CACHE.set(globalThis, cache);
  }

  // ⚡ Check cache first (per request)
  if (cache.has(cacheKey)) {
    console.log("⚡ Using Cached Packing Result");
    return cache.get(cacheKey);
  }

  // Import Guillotine Packer dynamically for Cloudflare Workers
  let Packer;
  // @ts-ignore
  if (import.meta.env.SSR) {
    Packer = await import("guillotine-packer");
  } else {
    throw new Error("findOptimalPacking should only be called on the server");
  }
  const packer = Packer.packer;

  console.log(
    "📏 Total Panel Area:",
    panels.reduce((sum, panel) => sum + panel.width * panel.length, 0),
  );
  console.log("📐 Board Area:", boardWidth * boardLength);
  console.log("🔪 Blade Width:", bladeWidth);

  const forcedSortStrategy = Packer.SortStrategy.Area;
  const forcedSplitStrategy = Packer.SplitStrategy.ShortLeftoverAxisSplit;
  const forcedSelectionStrategy = Packer.SelectionStrategy.BEST_AREA_FIT;

  console.log("🔧 Forcing Strategies:");
  console.log("Sort Strategy:", forcedSortStrategy);
  console.log("Split Strategy:", forcedSplitStrategy);
  console.log("Selection Strategy:", forcedSelectionStrategy);

  // 🛠 Run the packing algorithm
  const result = await packer(
    {
      binHeight: boardLength,
      binWidth: boardWidth,
      items: panels.map((panel) => ({
        name: "panel",
        width: panel.width,
        height: panel.length,
      })),
    },
    {
      allowRotation: true,
      kerfSize: bladeWidth,
      sortStrategy: forcedSortStrategy,
      splitStrategy: forcedSplitStrategy,
      selectionStrategy: forcedSelectionStrategy,
    },
  );

  // ✅ Store in per-request cache
  cache.set(cacheKey, result);

  return result;
}

export function calculateFreeSpaces(
  usedRects: { x: number; y: number; width: number; length: number }[],
  boardWidth: number,
  boardLength: number,
  bladeWidth: number,
) {
  // Sort panels by position (top-left first)
  usedRects.sort(
    (a, b) =>
      Math.round(a.y) - Math.round(b.y) || Math.round(a.x) - Math.round(b.x),
  );

  let occupiedGrid = Array.from({ length: Math.round(boardLength) }, () =>
    Array(Math.round(boardWidth)).fill(false),
  );

  // Mark occupied areas
  usedRects.forEach((rect) => {
    let startX = Math.round(rect.x);
    let startY = Math.round(rect.y);
    let endX = Math.round(rect.x + rect.width);
    let endY = Math.round(rect.y + rect.length);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        occupiedGrid[y][x] = true;
      }
    }
  });

  // **Detect Free Spaces (Prioritize Larger Blocks)**
  let rawFreeRects = [];
  for (let y = 0; y < Math.round(boardLength); y++) {
    for (let x = 0; x < Math.round(boardWidth); x++) {
      if (!occupiedGrid[y][x]) {
        let width = 1;
        let length = 1;

        while (
          x + width < Math.round(boardWidth) &&
          !occupiedGrid[y][x + width]
        ) {
          width++;
        }

        while (
          y + length < Math.round(boardLength) &&
          !occupiedGrid[y + length][x]
        ) {
          length++;
        }

        let adjustedWidth = width - Math.round(bladeWidth);
        let adjustedLength = length - Math.round(bladeWidth);

        rawFreeRects.push({
          x: Math.round(x),
          y: Math.round(y),
          width: adjustedWidth,
          length: adjustedLength,
        });

        for (let fy = y; fy < y + length; fy++) {
          for (let fx = x; fx < x + width; fx++) {
            occupiedGrid[fy][fx] = true;
          }
        }
      }
    }
  }

  // **Step 2: Keep Only One Large Free Space Instead of Splitting**
  let optimizedFreeRects: {
    x: number;
    y: number;
    width: number;
    length: number;
  }[] = [];
  rawFreeRects.sort((a, b) => b.width * b.length - a.width * a.length); // Sort by area (largest first)

  rawFreeRects.forEach((rect) => {
    let isMerged = false;

    for (let i = 0; i < optimizedFreeRects.length; i++) {
      let existing = optimizedFreeRects[i];

      // **Merge if touching vertically**
      if (
        existing.x === rect.x &&
        existing.width === rect.width &&
        existing.y + existing.length + bladeWidth === rect.y
      ) {
        optimizedFreeRects[i].length += rect.length + bladeWidth;
        isMerged = true;
        break;
      }

      // **Merge if touching horizontally**
      if (
        existing.y === rect.y &&
        existing.length === rect.length &&
        existing.x + existing.width + bladeWidth === rect.x
      ) {
        optimizedFreeRects[i].width += rect.width + bladeWidth;
        isMerged = true;
        break;
      }
    }

    if (!isMerged) {
      optimizedFreeRects.push(rect);
    }
  });

  return optimizedFreeRects;
}
