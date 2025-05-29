export const FILE_UPLOAD_CONFIG = {
  // Allowed MIME types
  ALLOWED_TYPES: (
    process.env.ALLOWED_FILE_TYPES ||
    "image/jpeg,image/jpg,image/png,image/webp,application/pdf"
  ).split(","),

  // Max file size in bytes (default 5MB)
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5 * 1024 * 1024

  // Human readable file size for display
  MAX_FILE_SIZE_DISPLAY: process.env.MAX_FILE_SIZE_DISPLAY || "5MB",

  // File type display names for user messages
  ALLOWED_TYPES_DISPLAY:
    process.env.ALLOWED_TYPES_DISPLAY || "JPEG, PNG, WebP, PDF",
} as const;

// Helper function to validate file
export const validateFile = (file: File): string => {
  if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    return `Invalid file type. Please select a ${FILE_UPLOAD_CONFIG.ALLOWED_TYPES_DISPLAY} file.`;
  }
  if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_DISPLAY}.`;
  }
  return "";
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
