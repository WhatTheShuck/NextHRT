import React from "react";

type AlertBoxProps = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

export function AlertBox({ type, message }: AlertBoxProps) {
  const styles = {
    success:
      "mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-md",
    error: "mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md",
    warning:
      "mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-600 rounded-md",
    info: "mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-600 rounded-md",
  };

  return <div className={styles[type]}>{message}</div>;
}
