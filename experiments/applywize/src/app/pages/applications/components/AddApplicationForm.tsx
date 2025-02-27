"use client"

import React, { useActionState } from 'react'
import { Button } from "app/components/ui/button"
import { Icon } from "app/components/Icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "app/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "app/components/ui/select"
import { ClientForm } from "app/components/ContactForm";
import { createApplication } from "../functions";
import { DatePicker } from "app/components/ui/datepicker";

// TODO: form validation with Zod
export interface TApplicationFormData {
  success?: boolean;
  error?: string | null;
  company?: string;
  jobTitle?: string;
  jobDescription?: string;
  salaryMin?: string;
  salaryMax?: string;
  url?: string;
  dateApplied?: string;
  statusId?: number | null;
  contacts?: { id: string }[]; // contact ids
}

const AddApplicationForm = ({ contacts, applicationStatuses }:
  {
    // TODO: get the types from Prisma
    contacts: { id: string; firstName: string; lastName: string; email: string }[],
    applicationStatuses: { id: string; status: string }[]
  }) => {

  const handleSubmit = async (prevState: TApplicationFormData, formData: FormData): Promise<TApplicationFormData> => {
    const data = {
      company: formData.get("company") as string,
      jobTitle: formData.get("jobTitle") as string,
      jobDescription: formData.get("jobDescription") as string,
      salaryMin: formData.get("salaryMin") as string,
      salaryMax: formData.get("salaryMax") as string,
      url: formData.get("url") as string,
      dateApplied: formData.get("dateApplied") as string,
      statusId: Number(formData.get('statusId')) || null,
      contacts: state.contacts,
    }

    const result = await createApplication(data)
    return { ...state, ...result };
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, {
    success: false,
    error: null,
    company: "",
    jobTitle: "",
    jobDescription: "",
    salaryMin: "",
    salaryMax: "",
    url: "",
    statusId: null,
    contacts: contacts.map((contact) => ({ id: contact.id })),
  } as TApplicationFormData);


  return (
    <form action={formAction}>
      <fieldset disabled={isPending}>
      <div className="grid grid-cols-2 gap-[200px] px-page-side mb-[75px]">
        <div>
          <h2>Company Information</h2>
          <div className="field">
            <label htmlFor="company">Company Name</label>
            <input type="text" id="company" name="company" />
            <p className="input-description">You can manage verified email addresses in your email settings.</p>
          </div>
          <div className="field">
            <label htmlFor="jobTitle">Job Title</label>
            <input type="text" id="jobTitle" name="jobTitle" />
            <p className="input-description">You can manage verified email addresses in your email settings.</p>
          </div>
          <div className="field">
            <label htmlFor="jobDescription">Job Description / Requirements</label>
            <textarea id="jobDescription" name="jobDescription" />
            <p className="input-description">You can @mention other users and organizations to link to them.</p>
          </div>
          <div className="field">
            <div className="label">Salary Range</div>
            <div className="flex gap-4">
              <div className="flex-1 label-inside">
                <label htmlFor="salaryMin">Min</label>
                <input type="text" id="salaryMin" name="salaryMin" />
              </div>
              <div className="flex-1 label-inside">
                <label htmlFor="salaryMax">Max</label>
                <input type="text" id="salaryMax" name="salaryMax" />
              </div>
            </div>
            <p className="input-description">You can manage verified email addresses in your email settings.</p>
          </div>
          <div className="field">
            <label htmlFor="url">Application URL</label>
            <input type="text" id="url" name="url" />
            <p className="input-description">You can manage verified email addresses in your email settings.</p>
          </div>
          <div className="field">
              <Button role="submit">
                {isPending ? "Creating..." : "Create"}
              </Button>
          </div>
        </div>
        <div>
          <div className="box">
            <label htmlFor="application-date">Application submission date</label>
            <DatePicker name="dateApplied" />
          </div>
          <div className="box">
            <label htmlFor="application-status">Application Status</label>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {applicationStatuses.map((status: { id: string; status: string }) => (
                  <SelectItem key={status.id} value={status.id}>{status.status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="box">
            <h3>Contacts</h3>
            <p className="input-description">Invite your team members to collaborate.</p>
            <div className="pt-8">
              {contacts.map((contact: { id: string; firstName: string; lastName: string; email: string }) => (
                <div key={contact.id}>
                  <p>{contact.firstName} {contact.lastName} {contact.email}</p>
                </div>
              ))}
              <Sheet>
                <SheetTrigger className="flex items-center gap-2 font-poppins text-sm font-bold bg-secondary py-3 px-6 rounded-md cursor-pointer">
                  <Icon id="plus" size={16} />Add a Contact
                </SheetTrigger>
                <SheetContent className="pt-[100px] px-12">
                  <SheetHeader>
                    <SheetTitle>Add a Contact</SheetTitle>
                    <SheetDescription>
                      Add a Contact to this application.
                    </SheetDescription>
                    <ClientForm />
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
      </fieldset>
      </form>
  )
}

export { AddApplicationForm }
