"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "app/lib/utils"
import { Button } from "app/components/ui/button"
import { Calendar } from "app/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "app/components/ui/popover"

export function DatePicker({ name }: { name: string }) {
  const [date, setDate] = React.useState<Date>()

  return (
    <>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={date ? date.toISOString() : ""} />
    </>
  )
}
