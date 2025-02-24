import React from 'react'
import { link } from "app/shared/links";
import { Badge } from "app/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "app/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "app/components/ui/table"
import { Icon } from "app/components/Icon";
import { Application } from "@prisma/client";

interface ApplicationsTableProps {
  applications: Application[]
}

const ApplicationsTable = ({ applications }: ApplicationsTableProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead>Date Applied</TableHead>
          <TableHead>Job Title</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Salary Range</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow key={application.id}>
            <TableCell><Badge variant={application.status.status.toLowerCase()}>{application.status.status}</Badge></TableCell>
            <TableCell>{application.dateApplied.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</TableCell>
            <TableCell>{application.jobTitle}</TableCell>
            <TableCell>{application.company.name}</TableCell>
            <TableCell className="flex gap-2 items-center">
              {application.company?.contacts && application.company?.contacts?.length > 0 && (
                <>
                  {/* <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar> */}
                  {application.company.contacts[0].firstName} {application.company.contacts[0].lastName}
                </>
              )}
            </TableCell>
            <TableCell>${application.salaryMin}-${application.salaryMax}</TableCell>
            <TableCell><a href={link("/applications/:id", { id: application.id })}><Icon id="eye" /></a></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export {  ApplicationsTable }
