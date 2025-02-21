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

const ApplicationsTable = ({ applications }) => {
  console.log({ applications })
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
        <TableRow>
          <TableCell><Badge variant="applied">Applied</Badge></TableCell>
          <TableCell>February 5, 2025</TableCell>
          <TableCell>Design Engineer</TableCell>
          <TableCell>Vercel</TableCell>
          <TableCell className="flex gap-2 items-center">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            Carla Bergson
          </TableCell>
          <TableCell>$150k-$300k</TableCell>
            <a href={link("/applications/:id", { id: "123" })}><Icon id="eye" /></a>
          </TableRow>
          <TableRow>
          <TableCell><Badge variant="applied">Applied</Badge></TableCell>
          <TableCell>February 5, 2025</TableCell>
          <TableCell>Design Engineer</TableCell>
          <TableCell>Vercel</TableCell>
          <TableCell className="flex gap-2 items-center">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            Carla Bergson
          </TableCell>
          <TableCell>$150k-$300k</TableCell>
            <a href={link("/applications/:id", { id: "123" })}><Icon id="eye" /></a>
          </TableRow>
          <TableRow>
          <TableCell><Badge variant="applied">Applied</Badge></TableCell>
          <TableCell>February 5, 2025</TableCell>
          <TableCell>Design Engineer</TableCell>
          <TableCell>Vercel</TableCell>
          <TableCell className="flex gap-2 items-center">
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            Carla Bergson
          </TableCell>
          <TableCell>$150k-$300k</TableCell>
            <a href={link("/applications/:id", { id: "123" })}><Icon id="eye" /></a>
        </TableRow>
      </TableBody>
    </Table>
  )
}

export {  ApplicationsTable }
