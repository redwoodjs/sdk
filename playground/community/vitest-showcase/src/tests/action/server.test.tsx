import { expect, test } from "vitest";
import { ServerCounter } from "./server";
import { renderServer } from "vitest-plugin-rsc/testing-library";
import { screen } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";

test("server action", async () => {
  await renderServer(<ServerCounter />, { rerenderOnServerAction: true });

  await userEvent.click(await screen.findByRole("button", { name: "server-counter: 0" }));
  await userEvent.click(await screen.findByRole("button", { name: "server-counter: 1" }));
  expect(await screen.findByRole("button", { name: "server-counter: 2" })).toBeVisible();

  await userEvent.click(await screen.findByRole("button", { name: "server-counter-reset" }));
  expect(await screen.findByRole("button", { name: "server-counter: 0" })).toBeVisible();
});