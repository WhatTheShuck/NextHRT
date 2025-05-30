"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Training } from "@/generated/prisma_client";
import { TrainingSelector } from "@/app/bulk-training/components/training-selector";
import api from "@/lib/axios";
import { X, Upload, FileImage, Trash2, Eye } from "lucide-react";
import {
  FILE_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "@/lib/file-config";
import { TrainingRecordsWithRelations } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { DateSelector } from "@/components/date-selector";

interface TrainingEditFormProps {
  trainingRecord: TrainingRecordsWithRelations;
  onSuccess?: () => void;
}

export function TrainingEditForm({
  trainingRecord,
  onSuccess,
}: TrainingEditFormProps) {
  // Form state
  const [trainingId, setTrainingId] = useState("");
  const [provider, setProvider] = useState("");
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  // Data fetching state
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize form with existing training record data
  useEffect(() => {
    if (trainingRecord) {
      setTrainingId(trainingRecord.trainingId.toString());
      setProvider(trainingRecord.trainer);
      setCompletionDate(new Date(trainingRecord.dateCompleted));
    }
  }, [trainingRecord]);

  // Fetch available trainings
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: trainingsRes } = await api.get("/api/training");
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
    // If selecting a new file, don't remove existing image flag
    setRemoveExistingImage(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError("");
    // Clear the file input
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleRemoveExistingImage = () => {
    setRemoveExistingImage(true);
    setSelectedFile(null);
    setFileError("");
    // Clear the file input
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create FormData for multipart form submission
      const formData = new FormData();
      formData.append("employeeId", trainingRecord.employeeId.toString());
      formData.append("trainingId", trainingId);
      formData.append("dateCompleted", completionDate.toISOString());
      formData.append("trainer", provider);

      // Handle image operations
      if (removeExistingImage) {
        formData.append("removeImage", "true");
      }

      // Add new file if selected
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      // Send PUT request to update the training record
      await api.put(`/api/training-records/${trainingRecord.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Call success callback
      onSuccess?.();
    } catch (err) {
      console.error("API error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading form...</span>
      </div>
    );
  }

  const hasExistingImage = trainingRecord.imagePath && !removeExistingImage;
  const willShowNewImage = selectedFile && !fileError;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="space-y-2">
        <TrainingSelector
          trainings={trainings}
          selectedTrainingId={trainingId}
          onTrainingSelect={setTrainingId}
          onNewTraining={addTraining}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider-edit">Training Provider</Label>
        <Input
          id="provider-edit"
          placeholder="Enter provider name"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <DateSelector
          selectedDate={completionDate}
          onDateSelect={setCompletionDate}
        />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image-upload-edit">Training Certificate/Image</Label>

        {/* Current Image Display */}
        {hasExistingImage && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileImage className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Current Image Attached
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {trainingRecord.imageType === "application/pdf"
                        ? "PDF Document"
                        : "Image File"}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/api/images/${trainingRecord.imagePath}`,
                        "_blank",
                      )
                    }
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveExistingImage}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Area */}
        {(!hasExistingImage || willShowNewImage) && (
          <div className="space-y-3">
            {/* File Input */}
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="image-upload-edit"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-gray-500"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">
                      {hasExistingImage ? "Replace image" : "Click to upload"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} (MAX.{" "}
                    {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY})
                  </p>
                </div>
              </label>
              <input
                id="image-upload-edit"
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
            {willShowNewImage && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileImage className="w-5 h-5 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {selectedFile!.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedFile!.size)}
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
        )}

        {/* Removed Image Notice */}
        {removeExistingImage && !selectedFile && (
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              Current image will be removed when you save.{" "}
              <button
                type="button"
                onClick={() => setRemoveExistingImage(false)}
                className="underline hover:no-underline"
              >
                Undo
              </button>
            </p>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isSubmitting || !trainingId || !provider}
      >
        {isSubmitting ? "Saving..." : "Update Training Record"}
      </Button>
    </form>
  );
}
