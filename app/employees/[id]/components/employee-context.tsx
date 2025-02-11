"use client";

import React, { createContext, useContext, useState } from "react";
import { Employee, Training, TrainingRecords } from "@prisma/client";
import api from "@/lib/axios";

type EmployeeContextType = {
  employee: Employee | null;
  trainingRecords: (TrainingRecords & { training: Training })[];
  setEmployee: (employee: Employee | null) => void;
  setTrainingRecords: (
    records: (TrainingRecords & { training: Training })[],
  ) => void;
  refreshData: () => Promise<void>;
  employeeId: number;
};

const EmployeeContext = createContext<EmployeeContextType | null>(null);

export function EmployeeProvider({
  children,
  initialEmployee,
  initialTrainingRecords,
  employeeId,
}: {
  children: React.ReactNode;
  initialEmployee: Employee;
  initialTrainingRecords: (TrainingRecords & { training: Training })[];
  employeeId: number;
}) {
  const [employee, setEmployee] = useState<Employee | null>(initialEmployee);
  const [trainingRecords, setTrainingRecords] = useState(
    initialTrainingRecords,
  );

  const refreshData = async () => {
    try {
      const { data: employeeData } = await api.get(
        `/api/employees/${employeeId}`,
      );
      const { data: trainingData } = await api.get("/api/training-records");

      setEmployee(employeeData);
      setTrainingRecords(
        trainingData.filter(
          (record: TrainingRecords) => record.employeeId === employeeId,
        ),
      );
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  };

  return (
    <EmployeeContext.Provider
      value={{
        employee,
        trainingRecords,
        setEmployee,
        setTrainingRecords,
        refreshData,
        employeeId,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
}

export const useEmployee = () => {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error("useEmployee must be used within an EmployeeProvider");
  }
  return context;
};
