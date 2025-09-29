import {
  type Authenticator,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";

interface User {
  id: string;
  username: string;
  authenticators: Authenticator[];
}

export class PasskeyDurableObject {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async getUser(username: string): Promise<User | null> {
    return this.state.storage.get<User>(`user:${username}`);
  }

  async createUser(username: string): Promise<User> {
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      authenticators: [],
    };
    await this.state.storage.put(`user:${username}`, newUser);
    return newUser;
  }

  async addAuthenticator(
    username: string,
    registrationInfo: VerifiedRegistrationResponse["registrationInfo"],
  ) {
    const user = await this.getUser(username);
    if (!user) {
      throw new Error("User not found");
    }

    const newAuthenticator: Authenticator = {
      credentialID: registrationInfo.credentialID,
      credentialPublicKey: registrationInfo.credentialPublicKey,
      counter: registrationInfo.counter,
      credentialDeviceType: registrationInfo.credentialDeviceType,
      credentialBackedUp: registrationInfo.credentialBackedUp,
      transports: registrationInfo.transports,
    };

    user.authenticators.push(newAuthenticator);
    await this.state.storage.put(`user:${username}`, user);
  }

  async getAuthenticator(
    credentialID: string,
  ): Promise<{ user: User; authenticator: Authenticator } | null> {
    // This is inefficient, but it's the only way with DO's key-value storage.
    // In a real app, you'd use a different storage solution for this query.
    const allUsers = await this.state.storage.list<User>();
    for (const user of allUsers.values()) {
      const authenticator = user.authenticators.find(
        (auth) => auth.credentialID === credentialID,
      );
      if (authenticator) {
        return { user, authenticator };
      }
    }
    return null;
  }

  async updateAuthenticatorCounter(credentialID: string, newCounter: number) {
    const result = await this.getAuthenticator(credentialID);
    if (!result) {
      throw new Error("Authenticator not found");
    }
    const { user, authenticator } = result;
    authenticator.counter = newCounter;
    await this.state.storage.put(`user:${user.username}`, user);
  }
}
