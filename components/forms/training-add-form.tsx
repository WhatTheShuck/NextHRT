"use client";

import { useEmployee } from "@/app/employees/[id]/components/employee-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Category, Training } from "@/generated/prisma_client";
import { DateSelector } from "@/components/date-selector";
import api from "@/lib/axios";
import { X, Upload, FileImage, AlertCircle } from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";
import { TrainingCombobox } from "../combobox/training-combobox";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
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
    const files = Array.from(e.target.files || []);
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setFileErrors(newErrors);

    // Clear the input to allow re-selecting the same files
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFileErrors([]);
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
    setSubmitError("");

    try {
      const formData = new FormData();
      formData.append("employeeId", employee.id.toString());
      formData.append("trainingId", trainingId);
      formData.append("trainer", provider);
      formData.append("dateCompleted", completionDate.toISOString());

      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });

      await api.post("/api/training-records", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Reset form on success
      setTrainingId("");
      setProvider("");
      setCompletionDate(new Date());
      setSelectedFiles([]);
      setFileErrors([]);

      onSuccess?.();
    } catch (err: any) {
      console.error("API error:", err);

      if (err.response?.status === 409) {
        setSubmitError(
          err.response.data?.details ||
            "A training record with the same training course and completion date already exists for this employee.",
        );
      } else if (err.response?.data?.error) {
        setSubmitError(err.response.data.error);
      } else if (err.message) {
        setSubmitError(`Error saving training record: ${err.message}`);
      } else {
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
        <TrainingCombobox
          trainings={trainings}
          selectedTrainingId={trainingId}
          onSelect={setTrainingId}
          onNewTraining={addTraining}
          showAddButton={true}
          label="Training Course"
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
                  {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY} each)
                </p>
              </div>
            </label>
            <input
              id="image-upload"
              type="file"
              className="hidden"
              accept={FILE_UPLOAD_CONFIG.ALLOWED_TYPES.join(",")}
              onChange={handleFileChange}
              multiple
            />
          </div>

          {/* File Errors */}
          {fileErrors.length > 0 && (
            <div className="space-y-1">
              {fileErrors.map((error, index) => (
                <div
                  key={index}
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {error}
                </div>
              ))}
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selected Images ({selectedFiles.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFiles}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-128 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg min-w-0"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <FileImage className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0 ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
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
