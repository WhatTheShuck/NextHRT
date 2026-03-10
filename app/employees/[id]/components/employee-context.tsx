"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import api from "@/lib/axios";
import {
  EmployeeWithRelations,
  TrainingRecordsWithRelations,
  TicketRecordsWithRelations,
} from "@/lib/types";
import { AxiosError } from "axios";
import { TrainingTicketExemption } from "@/generated/prisma_client/client";

type EmployeeContextType = {
  employee: EmployeeWithRelations | null;
  setEmployee: (employee: EmployeeWithRelations | null) => void;
  updateEmployee: (updates: Partial<EmployeeWithRelations>) => void;
  refreshData: () => Promise<void>;
  employeeId: number;
  isLoading: boolean;
  error: string | null;
  addTrainingRecord: (record: TrainingRecordsWithRelations) => void;
  updateTrainingRecord: (record: TrainingRecordsWithRelations) => void;
  deleteTrainingRecord: (recordId: number) => void;
  addTicketRecord: (record: TicketRecordsWithRelations) => void;
  updateTicketRecord: (record: TicketRecordsWithRelations) => void;
  deleteTicketRecord: (recordId: number) => void;
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

      const response = await api.get(
        `/api/employees/${employeeId}?includeExemptions=true`,
      );
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

  // Optimistically update employee data in context
  const updateEmployee = useCallback(
    (updates: Partial<EmployeeWithRelations>) => {
      setEmployee((current) => {
        if (!current) return current;
        return { ...current, ...updates };
      });
    },
    [],
  );

  const addTrainingRecord = useCallback(
    (record: TrainingRecordsWithRelations) => {
      setEmployee((current) => {
        if (!current) return current;
        return {
          ...current,
          trainingRecords: [...(current.trainingRecords || []), record],
        };
      });
    },
    [],
  );

  const updateTrainingRecord = useCallback(
    (record: TrainingRecordsWithRelations) => {
      setEmployee((current) => {
        if (!current) return current;
        return {
          ...current,
          trainingRecords: (current.trainingRecords || []).map((r) =>
            r.id === record.id ? record : r,
          ),
        };
      });
    },
    [],
  );

  const deleteTrainingRecord = useCallback((recordId: number) => {
    setEmployee((current) => {
      if (!current) return current;
      return {
        ...current,
        trainingRecords: (current.trainingRecords || []).filter(
          (r) => r.id !== recordId,
        ),
      };
    });
  }, []);

  const addTicketRecord = useCallback((record: TicketRecordsWithRelations) => {
    setEmployee((current) => {
      if (!current) return current;
      return {
        ...current,
        ticketRecords: [...(current.ticketRecords || []), record],
      };
    });
  }, []);

  const updateTicketRecord = useCallback(
    (record: TicketRecordsWithRelations) => {
      setEmployee((current) => {
        if (!current) return current;
        return {
          ...current,
          ticketRecords: (current.ticketRecords || []).map((r) =>
            r.id === record.id ? record : r,
          ),
        };
      });
    },
    [],
  );

  const deleteTicketRecord = useCallback((recordId: number) => {
    setEmployee((current) => {
      if (!current) return current;
      return {
        ...current,
        ticketRecords: (current.ticketRecords || []).filter(
          (r) => r.id !== recordId,
        ),
      };
    });
  }, []);

  // Fetch data on mount and when employeeId changes
  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  return (
    <EmployeeContext.Provider
      value={{
        employee,
        setEmployee,
        updateEmployee,
        refreshData,
        employeeId,
        isLoading,
        error,
        addTrainingRecord,
        updateTrainingRecord,
        deleteTrainingRecord,
        addTicketRecord,
        updateTicketRecord,
        deleteTicketRecord,
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
export const useEmployeeTrainingRecords =
  (): TrainingRecordsWithRelations[] => {
    const { employee } = useEmployee();
    return employee?.trainingRecords || ([] as TrainingRecordsWithRelations[]);
  };

export const useEmployeeTicketRecords = () => {
  const { employee } = useEmployee();
  return employee?.ticketRecords || [];
};
export const useEmployeeTrainingTicketExemptions =
  (): TrainingTicketExemption[] => {
    const { employee } = useEmployee();
    return (
      employee?.trainingTicketExemptions || ([] as TrainingTicketExemption[])
    );
  };
