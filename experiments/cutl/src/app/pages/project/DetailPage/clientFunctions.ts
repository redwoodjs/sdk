"use client"

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
  
  export function calculateFreeSpaces(usedRects, boardWidth, boardHeight, bladeWidth) {
    let freeRects = [];
  
    // Sort panels by position (top-left first)
    usedRects.sort((a, b) => Math.round(a.y) - Math.round(b.y) || Math.round(a.x) - Math.round(b.x));
  
    let occupiedGrid = Array.from({ length: Math.round(boardHeight) }, () =>
      Array(Math.round(boardWidth)).fill(false)
    );
  
    // Mark occupied areas
    usedRects.forEach(rect => {
      let startX = Math.round(rect.x);
      let startY = Math.round(rect.y);
      let endX = Math.round(rect.x + rect.width);
      let endY = Math.round(rect.y + rect.height);
  
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          occupiedGrid[y][x] = true;
        }
      }
    });
  
    // **Detect Free Spaces (Prioritize Larger Blocks)**
    let rawFreeRects = [];
    for (let y = 0; y < Math.round(boardHeight); y++) {
      for (let x = 0; x < Math.round(boardWidth); x++) {
        if (!occupiedGrid[y][x]) {
          let width = 1;
          let height = 1;
  
          while (x + width < Math.round(boardWidth) && !occupiedGrid[y][x + width]) {
            width++;
          }
  
          while (y + height < Math.round(boardHeight) && !occupiedGrid[y + height][x]) {
            height++;
          }
  
          let adjustedWidth = width - Math.round(bladeWidth);
          let adjustedHeight = height - Math.round(bladeWidth);
  
          rawFreeRects.push({
            x: Math.round(x),
            y: Math.round(y),
            width: adjustedWidth,
            height: adjustedHeight
          });
  
          for (let fy = y; fy < y + height; fy++) {
            for (let fx = x; fx < x + width; fx++) {
              occupiedGrid[fy][fx] = true;
            }
          }
        }
      }
    }
  
    // **Step 2: Keep Only One Large Free Space Instead of Splitting**
    let optimizedFreeRects = [];
    rawFreeRects.sort((a, b) => (b.width * b.height) - (a.width * a.height)); // Sort by area (largest first)
  
    rawFreeRects.forEach(rect => {
      let isMerged = false;
  
      for (let i = 0; i < optimizedFreeRects.length; i++) {
        let existing = optimizedFreeRects[i];
  
        // **Merge if touching vertically**
        if (existing.x === rect.x && existing.width === rect.width && existing.y + existing.height + bladeWidth === rect.y) {
          optimizedFreeRects[i].height += rect.height + bladeWidth;
          isMerged = true;
          break;
        }
  
        // **Merge if touching horizontally**
        if (existing.y === rect.y && existing.height === rect.height && existing.x + existing.width + bladeWidth === rect.x) {
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
  
  