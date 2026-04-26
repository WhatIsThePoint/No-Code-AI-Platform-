import { useEffect, useState } from "react";
import { companiesApi, type MyCompany } from "../api/companies";
import { useAuthStore } from "../store/authSlice";

/** Returns the current user's active company, or null if they don't belong to one. */
export function useMyCompany() {
  const role = useAuthStore((s) => s.user?.role);
  const [company, setCompany] = useState<MyCompany | null>(null);
  const [loading, setLoading] = useState(role !== "super_admin");

  useEffect(() => {
    if (role === "super_admin") {
      setCompany(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    companiesApi
      .getMine()
      .then((r) => {
        if (!cancelled) setCompany(r.data);
      })
      .catch(() => {
        if (!cancelled) setCompany(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  return { company, loading };
}
