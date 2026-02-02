export interface RpcEnvelope {
  uniqueId: string;
  methodName: string;
  params: Uint8Array;
  timestamp: bigint;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeEnvelope(env: RpcEnvelope): Uint8Array {
  const idBytes = encoder.encode(env.uniqueId);
  const methodBytes = encoder.encode(env.methodName);
  
  const totalLength = 4 + idBytes.length + 4 + methodBytes.length + 4 + env.params.length + 8;
  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);
  
  let offset = 0;
  
  view.setUint32(offset, idBytes.length, true);
  offset += 4;
  buffer.set(idBytes, offset);
  offset += idBytes.length;
  
  view.setUint32(offset, methodBytes.length, true);
  offset += 4;
  buffer.set(methodBytes, offset);
  offset += methodBytes.length;
  
  view.setUint32(offset, env.params.length, true);
  offset += 4;
  buffer.set(env.params, offset);
  offset += env.params.length;
  
  view.setBigUint64(offset, env.timestamp, true);
  
  return buffer;
}

export function decodeEnvelope(data: Uint8Array): RpcEnvelope {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  
  const idLen = view.getUint32(offset, true);
  offset += 4;
  const uniqueId = decoder.decode(data.slice(offset, offset + idLen));
  offset += idLen;
  
  const methodLen = view.getUint32(offset, true);
  offset += 4;
  const methodName = decoder.decode(data.slice(offset, offset + methodLen));
  offset += methodLen;
  
  const paramsLen = view.getUint32(offset, true);
  offset += 4;
  const params = data.slice(offset, offset + paramsLen);
  offset += paramsLen;
  
  const timestamp = view.getBigUint64(offset, true);
  
  return { uniqueId, methodName, params, timestamp };
}
