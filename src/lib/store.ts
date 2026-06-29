import { create } from "zustand";

type AppState = {
  _result: { title: string; bullets: string[]; description: string } | null;
  loading: boolean;
  error: string | null;
  setResult: (result: { title: string; bullets: string[]; description: string }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  _result: null,
  loading: false,
  error: null,
  setResult: (result) => set({ _result: result, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
