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

  async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    mediaUrl?: string,
  ) {
    const data: WhatsAppMessageData = {
      From: this.fromPhoneNumber,
      To: phoneNumber,
      Body: message,
    };

    if (mediaUrl) {
      data.MediaUrl = mediaUrl;
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
      body: new URLSearchParams(data),
    });
    console.log(response);
    return response.json();
  }
}

type WhatsAppMessageData = {
  From: string;
  To: string;
  Body: string;
  MediaUrl?: string;
};

export function generateVCard(data: {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
}): string {
  const { fullName, phone, email, address } = data;

  // Build the vCard string
  let vCard = `BEGIN:VCARD\nVERSION:3.0\n`;
  vCard += `FN:${fullName}\n`; // Full name
  vCard += `TEL;TYPE=CELL:${phone}\n`; // Phone number

  // Optional fields
  if (email) {
    vCard += `EMAIL:${email}\n`;
  }
  if (address) {
    vCard += `ADR;TYPE=HOME:;;${address}\n`;
  }

  vCard += `END:VCARD`;

  return vCard;
}
