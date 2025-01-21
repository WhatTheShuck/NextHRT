import { useState, useEffect } from "react";

const ADMIN_MODE_KEY = "app_admin_mode";

export const useAdminMode = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_MODE_KEY);
    setIsAdmin(stored ? JSON.parse(stored) : false);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(ADMIN_MODE_KEY, JSON.stringify(isAdmin));
    }
  }, [isAdmin, isHydrated]);

  return {
    isAdmin: isHydrated ? isAdmin : false,
    setIsAdmin,
    isHydrated,
  };
};
