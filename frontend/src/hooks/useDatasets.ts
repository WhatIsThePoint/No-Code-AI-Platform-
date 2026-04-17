import { useCallback, useEffect, useRef } from "react";
import { datasetsApi } from "../api/datasets";
import { useDataStore } from "../store/dataSlice";

export function useDatasets(company_id?: string) {
  const { datasets, setDatasets } = useDataStore();
  const fetchedRef = useRef(false);

  const fetchDatasets = useCallback(async () => {
    try {
      const { data } = await datasetsApi.list({ company_id });
      setDatasets(data.items);
    } catch {
      // silently swallow — dashboard/data page will show stale or empty state
    }
  }, [company_id, setDatasets]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchDatasets();
  }, [fetchDatasets]);

  return { datasets, refetch: fetchDatasets };
}
