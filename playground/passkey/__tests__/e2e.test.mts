import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("can register and login", async ({ page, url }) => {
  await page.goto(`${url}/login`);

  const randomName = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: "-",
    length: 2,
  });

  const getUsernameInput = () =>
    page.waitForSelector('input[placeholder="Username"]');
  const getRegisterButton = () =>
    page.waitForSelector("button ::-p-text(Register with Passkey)");
  const getLoginButton = () =>
    page.waitForSelector("button ::-p-text(Login with Passkey)");
  const getResult = () => page.$eval("p", (el) => el.textContent);

  const usernameInput = await getUsernameInput();
  await usernameInput?.type(randomName);

  const registerButton = await getRegisterButton();
  await registerButton?.click();

  await poll(async () => {
    const result = await getResult();
    expect(result).toBe("Registration successful!");
    return true;
  });

  const loginButton = await getLoginButton();
  await loginButton?.click();

  await poll(async () => {
    const result = await getResult();
    expect(result).toBe("Login successful!");
    return true;
  });
});
