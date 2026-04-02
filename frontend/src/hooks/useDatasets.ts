import { useCallback, useEffect } from "react";
import { datasetsApi } from "../api/datasets";
import { useDataStore } from "../store/dataSlice";

export function useDatasets(company_id?: string) {
  const { datasets, setDatasets } = useDataStore();

  const fetchDatasets = useCallback(async () => {
    const { data } = await datasetsApi.list({ company_id });
    setDatasets(data.items);
  }, [company_id, setDatasets]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  return { datasets, refetch: fetchDatasets };
}
