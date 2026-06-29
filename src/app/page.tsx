"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

type CategoryOption = { value: string; label: string };

const CATEGORIES: CategoryOption[] = [
  { value: "Electronics", label: "Electronics" },
  { value: "Home & Kitchen", label: "Home & Kitchen" },
  { value: "Fashion", label: "Fashion" },
  { value: "Beauty", label: "Beauty & Personal Care" },
  { value: "Sports", label: "Sports & Outdoors" },
  { value: "Toys", label: "Toys & Games" },
  { value: "Automotive", label: "Automotive" },
  { value: "Health", label: "Health & Household" },
  { value: "Other", label: "Other" },
];

function cn(...args: Array<string | false | undefined | null>) {
  return args.filter(Boolean).join(" ");
}

export default function Home() {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [features, setFeatures] = useState("");

  const { _result, loading, error, setResult, setLoading, setError } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult({ title: "", bullets: [], description: "" });
    setError(null);

    try {
      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, category, features }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed.");
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">
          AI Listing Optimizer
        </h1>
        <p className="mt-2 text-zinc-600">
          Generate Amazon & Noon ready titles, bullets, and descriptions.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Product Name</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
              placeholder="e.g., UltraSlim Wireless Charger"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              {CATEGORIES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Key Features</label>
            <textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              required
              rows={4}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
              placeholder="15W fast charging, leather finish, LED indicator, universal device compatibility..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md px-5 py-2 text-sm font-medium text-white",
              loading ? "bg-zinc-500" : "bg-black hover:bg-zinc-800"
            )}
          >
            {loading ? "Generating..." : "Generate Listing"}
          </button>
        </form>
      </section>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {_result && _result.title && (
        <section className="mt-8 space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Optimized Title</h2>
            <p className="mt-2 text-sm text-zinc-800">{_result.title}</p>
            <button
              onClick={() => copyText(_result.title)}
              className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs"
            >
              Copy title
            </button>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Bullet Points</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
              {_result.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
            <button
              onClick={() => copyText(_result.bullets.join("\n"))}
              className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs"
            >
              Copy bullets
            </button>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">{_result.description}</p>
            <button
              onClick={() => copyText(_result.description)}
              className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs"
            >
              Copy description
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
