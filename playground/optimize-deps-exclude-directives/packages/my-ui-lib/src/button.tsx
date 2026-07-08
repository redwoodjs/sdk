"use client";

export function MyButton() {
  return (
    <button
      id="my-ui-lib-button"
      data-host-transform={
        (globalThis as any).__myUiLibHostTransformRan ? "true" : "false"
      }
      style={{ padding: "1rem", fontSize: "1.25rem" }}
      onClick={() => alert("clicked!")}
    >
      My UI Lib Button
    </button>
  );
}
