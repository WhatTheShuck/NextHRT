"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Training } from "@/generated/prisma_client";
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
import { TrainingCombobox } from "../combobox/training-combobox";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);

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
        const { data: trainingsRes } = await api.get(
          "/api/training?activeOnly=true",
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
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleRemoveExistingImage = (imageId: number) => {
    setRemovedImageIds((prev) => [...prev, imageId]);
  };

  const handleRestoreExistingImage = (imageId: number) => {
    setRemovedImageIds((prev) => prev.filter((id) => id !== imageId));
  };

  const handleRemoveAllExistingImages = () => {
    if (trainingRecord.images) {
      const allImageIds = trainingRecord.images.map((img) => img.id);
      setRemovedImageIds((prev) => [...new Set([...prev, ...allImageIds])]);
    }
    setSelectedFiles([]);
    setFileErrors([]);
    const fileInput = document.getElementById(
      "image-upload-edit",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const isPDF = (filename: string) => filename.toLowerCase().endsWith(".pdf");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("employeeId", trainingRecord.employeeId.toString());
      formData.append("trainingId", trainingId);
      formData.append("dateCompleted", completionDate.toISOString());
      formData.append("trainer", provider);

      if (removedImageIds.length > 0) {
        formData.append("removedImageIds", JSON.stringify(removedImageIds));
      }

      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });

      await api.put(`/api/training-records/${trainingRecord.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

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

  const existingImages = trainingRecord.images ?? [];
  const visibleImages = existingImages.filter(
    (img) => !removedImageIds.includes(img.id),
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
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
        <Label htmlFor="completion-date-edit">Completion Date</Label>
        <DateSelector
          selectedDate={completionDate}
          onDateSelect={setCompletionDate}
        />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <Label htmlFor="image-upload-edit">Training Certificate/Image</Label>

        {/* Current Images */}
        {existingImages.length > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <FileImage className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Current Images ({visibleImages.length})
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Click to view individual files
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveAllExistingImages}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove All
              </Button>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-3 gap-2">
              {visibleImages.slice(0, 6).map((image, index) => (
                <div key={image.id} className="relative group">
                  <button
                    type="button"
                    onClick={() =>
                      window.open(`/api/images/${image.imagePath}`, "_blank")
                    }
                    className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full"
                  >
                    {isPDF(image.originalName) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20">
                        <div className="text-red-600 dark:text-red-400 text-2xl mb-1">
                          📄
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium px-1 text-center">
                          PDF
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1 text-center truncate w-full">
                          {image.originalName.replace(".pdf", "")}
                        </div>
                      </div>
                    ) : (
                      <img
                        src={`/api/images/${image.imagePath}`}
                        alt={image.originalName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
                                <div class="text-gray-400 text-xl mb-1">📄</div>
                                <div class="text-xs text-gray-500 px-1 text-center">
                                  ${image.originalName}
                                </div>
                              </div>
                            `;
                          }
                        }}
                      />
                    )}
                    {index === 5 && visibleImages.length > 6 && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-xs font-medium">
                        +{visibleImages.length - 6}
                      </div>
                    )}
                  </button>

                  {/* Individual remove button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveExistingImage(image.id);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Remove this file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Images marked for removal with restore option */}
            {removedImageIds.length > 0 && (
              <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Files marked for removal ({removedImageIds.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemovedImageIds([])}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Restore all
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {existingImages
                    .filter((img) => removedImageIds.includes(img.id))
                    .map((image) => (
                      <div
                        key={`removed-${image.id}`}
                        className="relative group"
                      >
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden opacity-50 relative">
                          {isPDF(image.originalName) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20">
                              <div className="text-red-600 dark:text-red-400 text-lg">
                                📄
                              </div>
                              <div className="text-xs text-red-600 dark:text-red-400">
                                PDF
                              </div>
                            </div>
                          ) : (
                            <img
                              src={`/api/images/${image.imagePath}`}
                              alt={image.originalName}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center">
                            <X className="w-4 h-4 text-red-600" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreExistingImage(image.id)}
                          className="absolute -top-2 -right-2 bg-green-500 hover:bg-green-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          title="Restore this file"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* New File Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="image-upload-edit"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:hover:border-gray-500"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">
                    {existingImages.length > 0
                      ? "Add more images"
                      : "Click to upload images"}
                  </span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} (MAX.{" "}
                  {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY} each)
                </p>
              </div>
            </label>
            <input
              id="image-upload-edit"
              type="file"
              className="hidden"
              accept={FILE_UPLOAD_CONFIG.ALLOWED_TYPES.join(",")}
              onChange={handleFileChange}
              multiple
            />
          </div>

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

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Images ({selectedFiles.length})
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
        {isSubmitting ? "Saving..." : "Update Training Record"}
      </Button>
    </form>
  );
}
