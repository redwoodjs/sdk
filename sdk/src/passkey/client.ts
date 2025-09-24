import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  startPasskeyLogin,
  finishPasskeyLogin,
} from "./worker.js";

export function usePasskey() {
  const register = async (username: string) => {
    // 1. Get a challenge from the worker
    const options = await startPasskeyRegistration(username);
    // 2. Ask the browser to sign the challenge
    const registration = await startRegistration(options);
    // 3. Give the signed challenge to the worker to finish the registration process
    const success = await finishPasskeyRegistration(username, registration);
    return success;
  };

  const login = async (username: string) => {
    // 1. Get a challenge from the worker
    const options = await startPasskeyLogin();
    // 2. Ask the browser to sign the challenge
    const authentication = await startAuthentication(options);
    // 3. Give the signed challenge to the worker to finish the login process
    const success = await finishPasskeyLogin(authentication);
    return success;
  };

  return { register, login };
}
