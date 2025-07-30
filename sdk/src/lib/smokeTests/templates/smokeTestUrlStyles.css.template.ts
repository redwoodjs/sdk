export function getSmokeTestUrlStylesCssTemplate(
  color: "red" | "green",
): string {
  const backgroundColor = color === "red" ? "rgb(255, 0, 0)" : "rgb(0, 128, 0)";
  return `* {
  background-color: ${backgroundColor} !important;
}`;
}
