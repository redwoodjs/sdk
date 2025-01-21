export class TwilioClient {
  private apiUrl: string;
  private accountSid: string;
  private authToken: string;
  private fromPhoneNumber: string;

  constructor(env: Env) {
    this.apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    // @ts-ignore - TODO: fix this - binding from worker-configuration.d.ts
    this.accountSid = env.TWILIO_ACCOUNT_SID;
    // @ts-ignore - TODO: fix this - binding from worker-configuration.d.ts
    this.authToken = env.TWILIO_AUTH_TOKEN;
    this.fromPhoneNumber = "whatsapp:+27774540893";
  }

  async getMediaUrlFromTwilio(uri: string) {
    const headers = {
      Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
    };
    const response = await fetch(uri, { headers });
    const url = response.url;
    return url;
  }

  async sendWhatsAppMessage(
    message: string,
    phoneNumber: string,
    originalMessageSid: string | null,
  ) {
    const messageData = new URLSearchParams();
    messageData.append("From", this.fromPhoneNumber);
    messageData.append("To", phoneNumber);
    messageData.append("Body", message);
    messageData.append("msgId", originalMessageSid!);

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
      body: messageData.toString(),
    });
    return response.json();
  }
}


