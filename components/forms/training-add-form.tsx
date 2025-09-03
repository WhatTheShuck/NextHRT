"use client";

import { useEmployee } from "@/app/employees/[id]/components/employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Category, Training } from "@/generated/prisma_client";
import { TrainingSelector } from "@/app/bulk-training/components/training-selector";
import { DateSelector } from "@/components/date-selector";
import api from "@/lib/axios";
import { X, Upload, FileImage, AlertCircle } from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";

interface TrainingAddFormProps {
  onSuccess?: () => void;
  categoryHint: Category;
}

export function TrainingAddForm({
  onSuccess,
  categoryHint,
}: TrainingAddFormProps) {
  const { employee } = useEmployee();

  // Form state
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [completionDate, setCompletionDate] = useState<Date>(new Date());

  // Data fetching state
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Error handling state
  const [submitError, setSubmitError] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: trainingsRes } = await api.get(
          `/api/training?activeOnly=true&category=${categoryHint}`,
        );
        setTrainings(trainingsRes);
      } catch (err) {
        console.error("API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const addTraining = (newTraining: Training) => {
    setTrainings([...trainings, newTraining]);
    setTrainingId(newTraining.id.toString());
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
    setSubmitError(""); // Clear any previous errors

    try {
      // Create FormData instead of JSON
      const formData = new FormData();
      formData.append("employeeId", employee.id.toString());
      formData.append("trainingId", trainingId);
      formData.append("trainer", provider);
      formData.append("dateCompleted", completionDate.toISOString());

      // Add file if selected
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      // Send FormData (axios will automatically set the correct Content-Type)
      await api.post("/api/training-records", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Reset form on success
      setTrainingId("");
      setProvider("");
      setCompletionDate(new Date());
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
    } catch (err: any) {
      console.error("API error:", err);

      // Handle different error types
      if (err.response?.status === 409) {
        // Duplicate record error
        setSubmitError(
          err.response.data?.details ||
            "A training record with the same training course and completion date already exists for this employee.",
        );
      } else if (err.response?.data?.error) {
        // Other API errors with error messages
        setSubmitError(err.response.data.error);
      } else if (err.message) {
        // Network or other errors
        setSubmitError(`Error saving training record: ${err.message}`);
      } else {
        // Fallback error message
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      {/* Error Message Display */}
      {submitError && (
        <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">
              {submitError}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSubmitError("")}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <TrainingSelector
          trainings={trainings}
          selectedTrainingId={trainingId}
          onTrainingSelect={setTrainingId}
          onNewTraining={addTraining}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">Training Provider</Label>
        <Input
          id="provider"
          placeholder="Enter provider name"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="completion-date">Completion Date</Label>
        <DateSelector
          selectedDate={completionDate}
          onDateSelect={setCompletionDate}
        />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image-upload">
          Training Certificate/Image (Optional)
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
        disabled={isLoading || isSubmitting || !trainingId || !provider}
      >
        {isSubmitting ? "Saving..." : "Save Training Record"}
      </Button>
    </form>
  );
}
