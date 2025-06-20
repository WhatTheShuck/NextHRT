"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";

// Overloaded type definitions for required vs optional dates
type DateSelectorPropsRequired = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  optional?: false;
  placeholder?: string;
  allowClear?: boolean;
};

type DateSelectorPropsOptional = {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  optional: true;
  placeholder?: string;
  allowClear?: boolean;
};

type DateSelectorProps = DateSelectorPropsRequired | DateSelectorPropsOptional;

export function DateSelector(props: DateSelectorProps) {
  const {
    selectedDate,
    onDateSelect,
    optional = false,
    placeholder = "DD/MM/YYYY or DDMMYYYY",
    allowClear = true,
  } = props;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Sync input value with selected date
  useEffect(() => {
    if (selectedDate) {
      setInputValue(format(selectedDate, "dd/MM/yyyy"));
    } else {
      setInputValue("");
    }
  }, [selectedDate]);

  const parseInputDate = (value: string): Date | null => {
    const formats = [
      { pattern: "dd/MM/yyyy", length: 10 },
      { pattern: "dd-MM-yyyy", length: 10 },
      { pattern: "ddMMyyyy", length: 8 },
    ];

    for (const { pattern, length } of formats) {
      if (value.length === length) {
        const parsedDate = parse(value, pattern, new Date());
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      }
    }
    return null;
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (optional && value === "") {
      (onDateSelect as (date: Date | null) => void)(null);
      return;
    }

    // Try to parse the input as a date
    const parsedDate = parseInputDate(value);
    if (parsedDate) {
      if (optional) {
        (onDateSelect as (date: Date | null) => void)(parsedDate);
      } else {
        (onDateSelect as (date: Date) => void)(parsedDate);
      }
    }
  };

  const handleInputBlur = () => {
    // If the input doesn't match a valid date, reset to the current selected date
    if (selectedDate) {
      const currentFormatted = format(selectedDate, "dd/MM/yyyy");
      if (inputValue !== currentFormatted) {
        const parsedDate = parseInputDate(inputValue);
        if (!parsedDate) {
          setInputValue(currentFormatted);
        }
      }
    } else if (optional && inputValue !== "") {
      // If no date selected but there's text, try to parse or clear
      const parsedDate = parseInputDate(inputValue);
      if (!parsedDate) {
        setInputValue("");
      }
    }
  };

  const handleClear = () => {
    if (optional) {
      (onDateSelect as (date: Date | null) => void)(null);
      setInputValue("");
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (optional) {
      (onDateSelect as (date: Date | null) => void)(date || null);
    } else if (date) {
      (onDateSelect as (date: Date) => void)(date);
    }
    setIsCalendarOpen(false);
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          className={optional && selectedDate && allowClear ? "pr-8" : ""}
        />
        {optional && allowClear && selectedDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
