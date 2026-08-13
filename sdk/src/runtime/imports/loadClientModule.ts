import {
  isDynamicImportFailure,
  isRecoveryConfigured,
  suspendForRecovery,
} from "../client/recovery.js";

type LoadClientModuleOptions = {
  id: string;
  moduleFn: (() => Promise<any>) | undefined;
  recoveryConfigured?: () => boolean;
  suspend?: typeof suspendForRecovery;
};

export async function loadClientModule({
  id,
  moduleFn,
  recoveryConfigured = isRecoveryConfigured,
  suspend = suspendForRecovery,
}: LoadClientModuleOptions) {
  if (!moduleFn) {
    if (recoveryConfigured()) {
      return suspend("module-not-found");
    }

    throw new Error(
      `(client) No module found for '${id}' in module lookup for "use client" directive`,
    );
  }

  try {
    return await moduleFn();
  } catch (error) {
    if (isDynamicImportFailure(error) && recoveryConfigured()) {
      return suspend("module-not-found");
    }
    throw error;
  }
}
