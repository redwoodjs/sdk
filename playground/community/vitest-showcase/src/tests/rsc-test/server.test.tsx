import { expect, test } from "vitest";
import { renderServer } from "vitest-plugin-rsc/testing-library";
import { screen } from "@testing-library/dom";
import { HelloRsc } from "./server";

test("renders a basic RSC component", async () => {
  await renderServer(<HelloRsc name="RWSDK" />);
  expect(await screen.findByText("Hello RWSDK")).toBeVisible();
});
