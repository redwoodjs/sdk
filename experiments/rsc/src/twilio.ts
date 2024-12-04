import { db } from "./db";

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
    return response.json();
  }
}





export async function getUniqueProfessions(): Promise<string[]> {
  const professions = await db
    .selectFrom("Tradesman")
    .select("profession")
    .distinct()
    .execute()

  return professions.map((p) => p.profession);
}

// Replace the static array with a function that loads from DB
export const quickReplyMessage = async (): Promise<string> => {
  const tradeProfessions = await getUniqueProfessions();
  console.log(tradeProfessions)
  return `Welcome to *The Valley Directory!* We have the following tradesmen available:\n\n${formatQuickReply(tradeProfessions)}\n\nPlease reply with the name of the profession you would like to contact and we will send you the contact details for the tradesmen available in your area.`;
};
export function formatQuickReply(tradeProfessions: string[]): string {
  return tradeProfessions.map((profession) => `*${profession}*`).join("\n");
}

type WhatsAppMessageData = {
  From: string;
  To: string;
  Body: string;
  MediaUrl?: string;
};


type vCardData = {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
}
// This is a helper function to generate a vCard string
// It also needs to upload to R2 storage and return the url

export function generateVCard(data: vCardData): string {
  const { fullName, phone, email, address } = data;

  // Build the vCard string
  let vCard = `BEGIN:VCARD\nVERSION:3.0\n`;
  vCard += `FN;CHARSET=UTF-8:${fullName}\n`; // Full name
  vCard += `N;CHARSET=UTF-8:${fullName.split(" ").reverse().join(";")}\n`;
  vCard += `TEL;TYPE=VOICE:${phone}\n`; // Phone number
  vCard += `REV:${new Date().toISOString()}\n`;

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

// Save the vCard to R2 storage and return the filename - filename is the cellnumber
export async function saveVCardToR2(vCard: vCardData, env: Env): Promise<string> {
  const filename = `${vCard.phone}.vcf`;
  const vCardString = generateVCard(vCard);
  await env.valley_directory_r2.put(filename, vCardString);
  return filename;
}
