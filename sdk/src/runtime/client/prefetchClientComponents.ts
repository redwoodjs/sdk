import { loadModule } from "../imports/client";

// @ts-ignore
import { useClientLookup } from "virtual:use-client-lookup.js";

function parseFlightData(flightData: string[]): string[] {
  try {
    const clientComponents = new Set<string>();

    flightData.forEach((payload) => {
      const lines = payload.split("\n");

      lines.forEach((line) => {
        const match = line.match(/^\d+:I\[(.*)]/);
        if (match) {
          try {
            const jsonContent = JSON.parse(`[${match[1]}]`);
            const componentPath = jsonContent[0];
            if (typeof componentPath === "string") {
              clientComponents.add(componentPath);
            }
          } catch (error) {
            // Skip any errors during parsing, as this is an optimization.
            console.error(
              "rwsdk: Error parsing flight data, skipping prefetching for",
              line,
            );
          }
        }
      });
    });

    return Array.from(clientComponents);
  } catch (error) {
    // If parsing flight data fails, we don't want break rendering as this is an optimization.
    console.error("rwsdk: Error parsing flight data, skipping prefetching");
    return [];
  }
}

const onError = (error: Error) => {
  console.error("rwsdk: Error prefetching client component:", error);
};

const doPrefetchClientComponents = () => {
  const flightData = (globalThis as any).__FLIGHT_DATA;

  if (!flightData) {
    console.log("No flight data found, skipping prefetching client components");
    return;
  }

  const clientComponents = parseFlightData(flightData);
  console.log("Prefetching client components:", clientComponents);
  for (const id of clientComponents) {
    Promise.resolve()
      .then(() => id.split("#")[0])
      .then(loadModule)
      .then(() => console.log(`Prefetched client component: ${id}`))
      // If loading the module fails, we don't want to break rendering as this is an optimization.
      .catch(onError);
  }
};

const prefetchClientComponents = async () => {
  // context(justinvdm, 14 Aug 2025): We need to wait for __FLIGHT_DATA to be
  // available - it is added via a script at the end of the body
  if (document.readyState === "loading") {
    // Not ready yet - listen for the event
    document.addEventListener("DOMContentLoaded", doPrefetchClientComponents);
  } else {
    // Already ready - run immediately
    doPrefetchClientComponents();
  }
};

prefetchClientComponents();
