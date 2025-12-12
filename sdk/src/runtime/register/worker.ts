import { isValidElementType } from "react-is";
import {
  registerClientReference as baseRegisterClientReference,
  registerServerReference as baseRegisterServerReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";
import { getServerModuleExport } from "../imports/worker.js";
import { requestInfo } from "../requestInfo/worker.js";

export function registerServerReference(
  action: Function,
  id: string,
  name: string,
) {
  if (typeof action !== "function") {
    return action;
  }

  // Note: We no longer need to register in a Map since we use virtual lookup
  return baseRegisterServerReference(action, id, name);
}

const isComponent = (target: unknown) =>
  isValidElementType(target) && target?.toString().includes("jsx");

export function registerClientReference<Target extends Record<string, unknown>>(
  ssrModule: Target,
  id: string,
  exportName: string,
) {
  const target = ssrModule[exportName] ?? {};

  if (isValidElementType(target)) {
    // This is the original logic from 'main'.
    // For React components, we create a serializable reference for the RSC pass.
    const reference = baseRegisterClientReference({}, id, exportName);
    const finalDescriptors = Object.getOwnPropertyDescriptors(reference);
    const idDescriptor = finalDescriptors.$$id;

    if (idDescriptor) {
      const originalValue = idDescriptor.value;
      // Create a new accessor descriptor, NOT by spreading the old one.
      finalDescriptors.$$id = {
        enumerable: idDescriptor.enumerable,
        configurable: idDescriptor.configurable,
        get() {
          requestInfo.rw.scriptsToBeLoaded.add(id);
          return originalValue;
        },
      };
    }

    finalDescriptors.$$async = { value: true };
    finalDescriptors.$$isClientReference = { value: true };

    // context(justinvdm, 25 Sep 2025): We create a wrapper function to avoid
    // getting the SSR component's property descriptors - otherwise
    // this will take precedence over the client reference descriptors
    const fn =
      typeof target === "function"
        ? (...args: unknown[]) => (target as Function)(...args)
        : () => null;

    return Object.defineProperties(fn, finalDescriptors);
  }

  // For non-components, return the target object directly for use in SSR.
  return target;
}

export async function __smokeTestActionHandler(
  timestamp?: number,
): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { status: "ok", timestamp };
}

export async function rscActionHandler(req: Request): Promise<unknown> {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type");

  const data = contentType?.startsWith("multipart/form-data")
    ? await req.formData()
    : await req.text();

  const args = (await decodeReply(data, null)) as unknown[];
  const actionId = url.searchParams.get("__rsc_action_id");

  if (import.meta.env.VITE_IS_DEV_SERVER && actionId === "__rsc_hot_update") {
    return null;
  }

  const action = await getServerModuleExport(actionId!);

  if (typeof action !== "function") {
    throw new Error(`Action ${actionId} is not a function`);
  }

  const result = await action(...args);
  if (result instanceof Response) {
    throw result; // bubble to worker.tsx so it's returned as the HTTP response
  }
  return result;
}
