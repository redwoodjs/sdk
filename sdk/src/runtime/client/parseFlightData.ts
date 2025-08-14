export function parseFlightData(flightData: string[]): string[] {
  const clientComponents = new Set<string>();

  flightData.forEach((payload) => {
    const lines = payload.split("\n");

    lines.forEach((line) => {
      const match = line.match(/^\d+:I\[(.*?)\]/);
      if (match) {
        try {
          const jsonContent = JSON.parse(`[${match[1]}]`);
          const componentPath = jsonContent[0];
          if (typeof componentPath === "string") {
            clientComponents.add(componentPath);
          }
        } catch (error) {
          console.error("Error parsing JSON content:", error);
        }
      }
    });
  });

  return Array.from(clientComponents);
}
