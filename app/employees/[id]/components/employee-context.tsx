"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import api from "@/lib/axios";
import { EmployeeWithRelations } from "@/lib/types";
import { AxiosError } from "axios";

type EmployeeContextType = {
  employee: EmployeeWithRelations | null;
  setEmployee: (employee: EmployeeWithRelations | null) => void;
  refreshData: () => Promise<void>;
  employeeId: number;
  isLoading: boolean;
  error: string | null;
};

const EmployeeContext = createContext<EmployeeContextType | null>(null);

export function EmployeeProvider({
  children,
  employeeId,
}: {
  children: React.ReactNode;
  employeeId: number;
}) {
  const [employee, setEmployee] = useState<EmployeeWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployeeData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get(`/api/employees/${employeeId}`);
      setEmployee(response.data);
    } catch (error) {
      console.error("Error fetching employee:", error);

      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          setError("You are not authenticated. Please log in.");
        } else if (error.response?.status === 403) {
          setError("You do not have permission to view this employee.");
        } else if (error.response?.status === 404) {
          setError("Employee not found.");
        } else {
          setError("Failed to fetch employee data. Please try again later.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  const refreshData = useCallback(async () => {
    await fetchEmployeeData();
  }, [fetchEmployeeData]);

  // Fetch data on mount and when employeeId changes
  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  return (
    <EmployeeContext.Provider
      value={{
        employee,
        setEmployee,
        refreshData,
        employeeId,
        isLoading,
        error,
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

// Convenience hooks for specific data
export const useEmployeeTrainingRecords = () => {
  const { employee } = useEmployee();
  return employee?.trainingRecords || [];
};

export const useEmployeeTicketRecords = () => {
  const { employee } = useEmployee();
  return employee?.ticketRecords || [];
};
