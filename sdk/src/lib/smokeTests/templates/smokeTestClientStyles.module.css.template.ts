export function getSmokeTestClientStylesCssTemplate(
  color: "blue" | "green",
): string {
  const backgroundColor =
    color === "blue" ? "rgb(0, 0, 255)" : "rgb(0, 128, 0)";
  return `.testBackground {
  background-color: ${backgroundColor} !important;
  width: 10px;
  height: 10px;
  position: absolute;
  top: 0;
  left: 0;
}`;
}
