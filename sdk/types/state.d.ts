declare module "rwsdk/__state" {
  export function defineRwState<T>(key: string, initializer: () => T): T;
  export function getRwState<T>(key: string): T | undefined;
  export function setRwState<T>(key: string, value: T): void;
}
