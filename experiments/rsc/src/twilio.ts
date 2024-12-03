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

// This will come from the DB
export const tradesmen = [
  {
    name: "Jack Parrow",
    phone: "+27724217253",
    email: "jackparrow@gmail.com",
    address: "123 Main Street, Springfield, USA",
    jobTitle: "Plumber",
  },
  {
    name: "John Doe",
    phone: "+27724378171",
    email: "john.doe@example.com",
    address: "123 Main Street, Springfield, USA",
    jobTitle: "Plumber",
  },
  {
    name: "Jane Doe",
    phone: "+27724378172",
    email: "jane.doe@example.com",
    address: "123 Main Street, Springfield, USA",
    jobTitle: "Electrician",
  },
];

// Keeping it simple, we just get the unique professions from the tradesmen, but we can also make a professions table in the DB
export const tradeProfessions = [
  ...new Set(tradesmen.map((tradesman) => tradesman.jobTitle)),
];

// todo(harryhcs, 2024-12-02): Add vCards
// todo(harryhcs, 2024-12-02): Remove all this twilio stuff from the main worker file
export const quickReplyMessage = `
    Welcome to *The Valley Directory!* We have the following tradesmen available:\n\n${formatQuickReply(tradeProfessions)}\n\nPlease reply with the name of the profession you would like to contact and we will send you the contact details for the tradesmen available in your area.`;

export function formatQuickReply(tradeProfessions: string[]): string {
  return tradeProfessions.map((profession) => `*${profession}*`).join("\n");
}

type WhatsAppMessageData = {
  From: string;
  To: string;
  Body: string;
  MediaUrl?: string;
};

// This is a helper function to generate a vCard string
// It also needs to upload to R2 storage and return the url
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
