import { create } from "zustand";
import type { Dataset } from "../types/dataset";

interface DataStore {
  datasets: Dataset[];
  setDatasets: (datasets: Dataset[]) => void;
  addDataset: (dataset: Dataset) => void;
  updateDataset: (dataset_id: string, updates: Partial<Dataset>) => void;
}

export const useDataStore = create<DataStore>((set) => ({
  datasets: [],

  setDatasets: (datasets) => set({ datasets }),

  addDataset: (dataset) =>
    set((state) => ({ datasets: [dataset, ...state.datasets] })),

  updateDataset: (dataset_id, updates) =>
    set((state) => ({
      datasets: state.datasets.map((d) =>
        d.dataset_id === dataset_id ? { ...d, ...updates } : d
      ),
    })),
}));
