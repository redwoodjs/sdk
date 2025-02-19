import { link } from "app/shared/links";
import { InteriorLayout } from "app/layouts/InteriorLayout";
import { Button } from "app/components/ui/button";
import { Icon } from "app/components/Icon";
import { ApplicationsTable } from "app/components/ApplicationsTable";
import { db } from "@/db";

export async function ListPage() {
  const applications = await db.application.findMany({
    select: {
      dateApplied: true,
      jobTitle: true,
      company: {
        select: {
          id: true,
          name: true,
          contacts: true
        }
      },
      status: {
        select: {
          id: true,
          status: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });
  console.log({ applications });

  return (
    <InteriorLayout>
      <>
      <div className="px-page-side flex justify-between items-center mb-6">
        <h1 className="page-title">All Applications</h1>
        <div>
          <Button><a href={link("/applications/new")} className="flex items-center gap-2"><Icon id="plus" size={16} /> New Application</a></Button>
        </div>
      </div>

        {/* TODO: Design a blank state */}
        <div className="px-page-side">
          {applications && applications > 0 ? (
            <ApplicationsTable applications={applications} />
          ) : (
            <div><em>No applications found</em></div>
          )}
        </div>

      <footer className="grid grid-cols-3 px-page-side py-10">
        <div>
          <Button variant="secondary">
            <a href={link("/applications")} className="flex items-center gap-2">
              <Icon id="archive" size={16} />
              Archived
            </a>
          </Button>
        </div>

        <div>
         {/* TODO: Pagination - currently breaking the page */}
        </div>

        <div className="flex justify-end">
            <Button><a href={link("/applications/new")} className="flex items-center gap-2"><Icon id="plus" size={16} /> New Application</a></Button>
        </div>
      </footer>

    </>
    </InteriorLayout>
  );
}
