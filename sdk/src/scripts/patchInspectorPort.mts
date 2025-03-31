// context(justinvdm, 31 Mar 2024): Miniflare always tries to use port 9229 for its inspector,
// which causes issues when running multiple worker scripts concurrently (e.g. during
// parallel postinstall runs in our monorepo). We patch the net module's Server.prototype.listen
// method to use auto-assigned ports (port 0) instead of the hardcoded 9229. This ensures
// that any server attempting to listen on port 9229 will instead be assigned a random available port.
import net from "node:net";
import baseDebug from "debug";

const debug = baseDebug("rwsdk:patch-net");

const originalListen = net.Server.prototype.listen;

net.Server.prototype.listen = function (...args: any[]) {
  if (typeof args[0] === "object" && args[0]?.port === 9229) {
    debug("Overriding port 9229 with 0 in object options");
    args[0].port = 0;
  } else if (typeof args[0] === "number" && args[0] === 9229) {
    debug("Overriding port 9229 with 0 in positional args");
    args[0] = 0;
  }

  return originalListen.apply(this, args as any);
};
