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
import { SettingsForm } from "./components/SettingsForm";

export async function SettingsPage() {
  const user = await db.user.findUnique({
    select: {
      id: true,
      email: true,
    },
    where: {
      id: "1",
    },
  });
  console.log(user);

  return (
    <InteriorLayout>
      {/* breadcrumbs */}
      <div className="mb-12 -mt-7 pl-[120px]">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/applications">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Account Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="mx-page-side pb-6 mb-8 border-b-1 border-border">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account settings.</p>
      </div>

      <SettingsForm user={user} />

    </InteriorLayout>
  );
}
