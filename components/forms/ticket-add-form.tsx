"use client";

import { useEmployee } from "@/app/employees/[id]/components/employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Ticket } from "@/generated/prisma_client";
import { TicketSelector } from "@/components/ticket-selector";
import api from "@/lib/axios";
import { X, Upload, FileImage } from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";
import { DateSelector } from "../date-selector";

interface TicketAddFormProps {
  onSuccess?: () => void;
}

export function TicketAddForm({ onSuccess }: TicketAddFormProps) {
  const { employee } = useEmployee();

  // Form state
  const [ticketId, setTicketId] = useState("");
  const [licenceNum, setLicenceNum] = useState("");
  const [dateIssued, setDateIssued] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");

  // Data fetching state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: ticketsRes } = await api.get("/api/tickets");
        setTickets(ticketsRes);
      } catch (err) {
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const addTicket = (newTicket: Ticket) => {
    setTickets([...tickets, newTicket]);
    setTicketId(newTicket.id.toString());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
      // Clear the input
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError("");
    // Clear the file input
    const fileInput = document.getElementById(
      "image-upload",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create FormData instead of JSON
      const formData = new FormData();
      formData.append("employeeId", employee.id.toString());
      formData.append("ticketId", ticketId);
      formData.append("licenseNumber", licenceNum);
      formData.append("dateIssued", dateIssued.toISOString());

      // Add file if selected
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      // Send FormData (axios will automatically set the correct Content-Type)
      await api.post("/api/ticket-records", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Reset form on success
      setTicketId("");
      setLicenceNum("");
      setDateIssued(new Date());
      setSelectedFile(null);
      setFileError("");

      // Clear file input
      const fileInput = document.getElementById(
        "image-upload",
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      // Call success callback
      onSuccess?.();
    } catch (err) {
      console.error("API error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="space-y-2">
        <TicketSelector
          tickets={tickets}
          selectedTicketId={ticketId}
          onTicketSelect={setTicketId}
          onNewTicket={addTicket}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="licenceNumber">Licence Number (Optional)</Label>
        <Input
          id="licenceNumber"
          placeholder="123456789"
          value={licenceNum}
          onChange={(e) => setLicenceNum(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dateIssued">Date Issued</Label>
        <DateSelector selectedDate={dateIssued} onDateSelect={setDateIssued} />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image-upload">
          Ticket Certificate/Image (Optional)
        </Label>
        <div className="space-y-3">
          {/* File Input */}
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-gray-500"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} (MAX.{" "}
                  {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY})
                </p>
              </div>
            </label>
            <input
              id="image-upload"
              type="file"
              className="hidden"
              accept={FILE_UPLOAD_CONFIG.ALLOWED_TYPES.join(",")}
              onChange={handleFileChange}
            />
          </div>

          {/* File Error */}
          {fileError && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {fileError}
            </div>
          )}

          {/* Selected File Display */}
          {selectedFile && !fileError && (
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileImage className="w-5 h-5 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isSubmitting || !ticketId}
      >
        {isSubmitting ? "Saving..." : "Save Ticket Record"}
      </Button>
    </form>
  );
}
