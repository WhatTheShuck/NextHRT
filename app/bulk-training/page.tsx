"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Dummy data - replace with API calls
const TRAINING_CATEGORIES = ["Internal", "External"];
const TRAINING_NAMES = {
  Internal: ["Health & Safety", "Company Policy", "Security Training"],
  External: ["First Aid", "Leadership Development", "Technical Certification"],
};
const EMPLOYEES = [
  { id: 1, name: "John Doe" },
  { id: 2, name: "Jane Smith" },
  { id: 3, name: "Alice Johnson" },
  { id: 4, name: "Bob Wilson" },
  { id: 5, name: "Carol Brown" },
  { id: 6, name: "David Lee" },
  { id: 7, name: "Emma Davis" },
  { id: 8, name: "Frank Miller" },
];

const BulkTrainingForm = () => {
  const [category, setCategory] = useState("");
  const [trainingName, setTrainingName] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState(new Date());
  const [openCalendar, setOpenCalendar] = useState(false);
  const [openEmployees, setOpenEmployees] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Here you would typically make an API call with the form data
    console.log({
      category,
      trainingName,
      provider,
      completionDate,
      selectedEmployees,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Bulk Training Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Training Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Training Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Training Name */}
          <div className="space-y-2">
            <Label htmlFor="trainingName">Training Name</Label>
            <Select
              value={trainingName}
              onValueChange={setTrainingName}
              disabled={!category}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select training" />
              </SelectTrigger>
              <SelectContent>
                {category &&
                  TRAINING_NAMES[category].map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Training Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Training Provider</Label>
            <Input
              id="provider"
              placeholder="Enter provider name"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>

          {/* Completion Date */}
          <div className="space-y-2">
            <Label>Completion Date</Label>
            <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {completionDate
                    ? format(completionDate, "PPP")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(date) => {
                    setCompletionDate(date);
                    setOpenCalendar(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Employees</Label>
            <Popover open={openEmployees} onOpenChange={setOpenEmployees}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedEmployees.length > 0
                    ? `${selectedEmployees.length} employees selected`
                    : "Select employees"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandEmpty>No employees found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {EMPLOYEES.map((employee) => (
                      <CommandItem
                        key={employee.id}
                        onSelect={() => {
                          setSelectedEmployees((current) =>
                            current.includes(employee.id)
                              ? current.filter((id) => id !== employee.id)
                              : [...current, employee.id],
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedEmployees.includes(employee.id)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {employee.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              !category ||
              !trainingName ||
              !provider ||
              selectedEmployees.length === 0
            }
          >
            Allocate Training
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BulkTrainingForm;
