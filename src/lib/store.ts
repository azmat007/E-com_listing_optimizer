import { create } from 'zustand';

type ListingResult = {
  title: string;
  titleAr: string;
  bullets: string[];
  description: string;
  descriptionAr: string;
  keywords: string[];
  keywordsAr: string[];
  imageUrls?: string[];
  imagePrompt?: string;
  recommendedPrices?: Record<string, number>;
};

type HistoryItem = ListingResult & {
  id: number;
  productName: string;
  features: string;
  category: string;
  platform: string;
  createdAt: string;
};

type AppState = {
  productName: string;
  category: string;
  features: string;
  platform: string;
  loading: boolean;
  error: string | null;
  _result: ListingResult | null;
  history: HistoryItem[];
  setProductName: (v: string) => void;
  setCategory: (v: string) => void;
  setFeatures: (v: string) => void;
  setPlatform: (v: string) => void;
  setResult: (v: ListingResult | null) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setHistory: (v: HistoryItem[]) => void;
  reset: () => void;
};

const initialState = {
  productName: '',
  category: 'Electronics',
  features: '',
  platform: 'amazon',
  loading: false,
  error: null,
  _result: null,
  history: [],
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setProductName: (v) => set({ productName: v }),
  setCategory: (v) => set({ category: v }),
  setFeatures: (v) => set({ features: v }),
  setPlatform: (v) => set({ platform: v }),
  setResult: (v) => set({ _result: v }),
  setLoading: (v) => set({ loading: v }),
  setError: (v) => set({ error: v }),
  setHistory: (v) => set({ history: v }),
  reset: () => set(initialState),
}));
