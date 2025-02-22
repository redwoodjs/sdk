"use server";

import { db } from "@/db";
import { TApplicationFormData } from "./component/AddApplicationForm";

export async function createContact(formData: FormData) {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;

  try {
    const contact = await db.contact.create({
      data: {
        firstName,
        lastName,
        email,
        role
      }
    })

    console.log({ contact })

    return {
      success: true,
      error: null,
      firstName,
      lastName,
      email,
      role
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function createApplication(data: Omit<TApplicationFormData, 'success' | 'error'>) {
  try {
    // ad a company
    const company = await db.company.create({
      data: {
        name: data.company,
        contacts: {
          connect: data.contacts
        }
      }
    })

    // create an application
    const application = await db.application.create({
      data: {
        userId: '1', /* TODO: Make this dynamic */
        statusId: data.statusId,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        dateApplied: data.dateApplied,
        jobTitle: data.jobTitle,
        jobDescription: data.jobDescription,
        postingUrl: data.url,
        companyId: company.id,
      }
    })

    return {
      success: true,
      error: null,
      application
    }
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
