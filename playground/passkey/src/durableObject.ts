import { PasskeyDurableObject as RwSdkPasskeyDurableObject, passkeyMigrations } from 'rwsdk/passkey/worker';

export class PasskeyDurableObject extends RwSdkPasskeyDurableObject {
  migrations = passkeyMigrations;
}
