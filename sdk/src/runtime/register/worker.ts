import {
  registerServerReference as baseRegisterServerReference,
  registerClientReference as baseRegisterClientReference,
  decodeReply,
} from "react-server-dom-webpack/server.edge";
import { isValidElementType } from "react-is";
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

export function registerClientReference<Target extends Record<string, unknown>>(
  ssrModule: Target,
  id: string,
  exportName: string,
) {
  const target = ssrModule[exportName] ?? {};
  console.log("### in registerClientReference", id, exportName, target);

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

    return Object.defineProperties(() => null, finalDescriptors);
  }

  console.log(
    "####### registerClientReference non-component",
    id,
    exportName,
    target,
  );
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

  return action(...args);
}
