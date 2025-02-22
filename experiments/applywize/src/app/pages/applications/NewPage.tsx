import { InteriorLayout } from "app/layouts/InteriorLayout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "app/components/ui/breadcrumb"
import { db } from "@/db";
import { AddApplicationForm } from "./component/AddApplicationForm";

export async function NewPage() {
  // get all the application statuses
  const applicationStatuses = await db.applicationStatus.findMany({
    select: {
      id: true,
      status: true
    }
  })

  // get all the contacts that don't have a company
  const contacts = await db.contact.findMany({
    where: {
      companyId: null
    }
  })

  return (
    <InteriorLayout>
      {/* breadcrumbs */}
      <div className="mb-12 -mt-7 pl-[120px]">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/applications">Applications</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Add an Application</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="mx-page-side pb-6 mb-8 border-b-1 border-border">
        <h1 className="page-title">New Application</h1>
        <p className="page-description">Create a new application</p>
      </div>

      <AddApplicationForm contacts={contacts} applicationStatuses={applicationStatuses} />

    </InteriorLayout>
  );
}
