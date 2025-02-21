import { InteriorLayout } from "app/layouts/InteriorLayout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "app/components/ui/breadcrumb"


export function NewPage() {
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
    </InteriorLayout>
  );
}
