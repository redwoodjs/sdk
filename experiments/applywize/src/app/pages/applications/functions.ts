"use server";

import { db } from "@/db";
import { TApplicationFormData } from "./components/AddApplicationForm";
import { type Context } from "app/worker";

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

export async function deleteContact(id: string) {
  try {
    await db.contact.delete({
      where: { id }
    })

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function createApplication({ data, ctx }: { data: Omit<TApplicationFormData, 'success' | 'error'>, ctx: Context }) {
  console.log({ ctx })

  try {
    // add a company
    const company = await db.company.upsert({
      where: {
        name: data.company
      },
      update: {
        contacts: {
          connect: data.contacts
        }
      },
      create: {
        name: data.company,
        contacts: {
          connect: data.contacts
        }
      }
    })

    // create an application
    const application = await db.application.create({
      data: {
        statusId: 1, // TODO: Make this dynamic
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        dateApplied: data.dateApplied,
        jobTitle: data.jobTitle,
        jobDescription: data.jobDescription,
        postingUrl: data.url,
        company: {
          connect: {
            id: company.id
          }
        },
        user: {
          connect: {
            id: "1" // TODO: Make this dynamic
          }
        }
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
