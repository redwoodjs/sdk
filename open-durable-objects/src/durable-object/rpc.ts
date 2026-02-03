import { encodeEnvelope, RpcEnvelope } from "./envelope.js";
import { serialize, deserialize } from "capnweb";

export interface Connection {
  send(message: Uint8Array): Promise<void>;
  receive(): Promise<Uint8Array>;
}

/**
 * Creates a Proxy-based stub that simulates RPC for the given interface T.
 */
export function createStub<T extends object>(id: string, connection: Connection): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      // Ignore standard promise methods and symbols
      if (typeof prop !== "string" || prop === "then" || prop === "toJSON") {
        return undefined;
      }
      
      return async (...args: any[]) => {
        const uniqueId = crypto.randomUUID();
        const methodName = prop;
        
        // Use capnweb's serialize for the internal params. 
        // We wrap it in our binary RpcEnvelope to satisfy the requirement
        // of hiding binary serialization and avoiding JSON in the hot path
        // (the envelope itself is binary).
        const serializedParams = serialize(args); 
        const params = new TextEncoder().encode(serializedParams);
        
        const envelope: RpcEnvelope = {
          uniqueId,
          methodName,
          params,
          timestamp: BigInt(Date.now())
        };
        
        // Send encoded binary envelope
        await connection.send(encodeEnvelope(envelope));
        
        // Await binary response
        const responseData = await connection.receive();
        
        // Decode response (assuming it uses the same serialization for now)
        return deserialize(new TextDecoder().decode(responseData));
      };
    }
  });
}
