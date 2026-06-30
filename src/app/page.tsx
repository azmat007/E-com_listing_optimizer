"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";

type HistoryItem = {
  id: number;
  product_name: string;
  features: string;
  category: string;
  platform: string;
  title: string;
  bullets: string[];
  description: string;
  image_urls: string[];
  recommended_prices: Record<string, number>;
  created_at: string;
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, items: HistoryItem[]) {
  const escape = (v: string) => {
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const header = ["id", "platform", "product_name", "title", "created_at"];
  const rows = items.map((item) => [
    String(item.id),
    escape(item.platform),
    escape(item.product_name),
    escape(item.title),
    escape(item.created_at),
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadText(filename, csv);
}

function downloadHtml(filename: string, items: HistoryItem[]) {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td>${item.id}</td>
        <td>${item.platform}</td>
        <td>${item.product_name}</td>
        <td>${item.title}</td>
        <td>${item.created_at}</td>
      </tr>`
    )
    .join("\n");
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Listing Exports</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; font-size: 14px; vertical-align: top; }
    th { background: #f9fafb; text-align: left; }
  </style>
</head>
<body>
  <h1>Exported Listings</h1>
  <table>
    <thead>
      <tr><th>ID</th><th>Platform</th><th>Product</th><th>Title</th><th>Created At</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
  downloadText(filename, html);
}

export default function Home() {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [features, setFeatures] = useState("");
  const [platform, setPlatform] = useState("amazon");
  const [generateImage, setGenerateImage] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const {
    _result,
    loading,
    error,
    setResult,
    setLoading,
    setError,
    reset,
  } = useAppStore();

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [recommendedPrices, setRecommendedPrices] = useState<Record<string, number>>({});

  const categories = [
    "Electronics",
    "Home & Kitchen",
    "Fashion",
    "Beauty & Personal Care",
    "Sports & Outdoors",
    "Toys & Games",
    "Automotive",
    "Health & Household",
    "Other",
  ];

  const platforms = [
    { id: "amazon", label: "Amazon" },
    { id: "noon", label: "Noon" },
    { id: "carrefour", label: "Carrefour" },
    { id: "microless", label: "MicroLess" },
  ];

  const refreshHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load history.");
      setHistory(data.items as HistoryItem[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!showHistory) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load history.");
        if (!cancelled) setHistory(data.items as HistoryItem[]);
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showHistory]);

  const [sourceUrl, setSourceUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setImageUrls([]);
    setRecommendedPrices({});
    setCopied(null);

    try {
      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, category, features, platform, sourceUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed.");
      setResult(data);

      const entry = await saveListing(data);
      if (showHistory) refreshHistory();

      if (generateImage && entry?.id) {
        const imgRes = await fetch(
          `/api/listings/${entry.id}/image?prompt=${encodeURIComponent(
            `${productName} ${category} ${features}`
          )}`
        );
        const imgData = await imgRes.json();
        if (!imgRes.ok) throw new Error(imgData?.error || "Image generation failed.");
        setImageUrls(imgData.urls as string[]);

        const priceRes = await fetch(`/api/listings/${entry.id}/prices`);
        const priceData = await priceRes.json();
        if (!priceRes.ok) throw new Error(priceData?.error || "Pricing failed.");
        setRecommendedPrices(priceData.prices as Record<string, number>);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const saveListing = async (data: {
    title: string;
    bullets: string[];
    description: string;
  }) => {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          features,
          category,
          platform,
          title: data.title,
          bullets: data.bullets,
          description: data.description,
          imageUrls,
          imagePrompt: `${productName} ${category} ${features}`,
          recommendedPrices,
          source: "generated",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Save failed.");
      }
      return (await res.json()) as { id: number };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const exportCurrent = () => {
    if (!_result?.title) return;
    const keywords = Array.isArray((_result as any).keywords) ? ( _result as any ).keywords : [];
    const keywordsAr = Array.isArray((_result as any).keywordsAr) ? ( _result as any ).keywordsAr : [];
    const payload = {
      productName,
      category,
      features,
      platform,
      ..._result,
      keywords,
      keywordsAr,
      imageUrls,
      recommendedPrices,
      created_at: new Date().toISOString(),
    };
    downloadJson("listing.json", payload);
    downloadText("listing.txt", [
      _result.title,
      "",
      ...(_result.bullets || []),
      "",
      _result.description,
      "",
      "Keywords EN:",
      ...keywords,
      "",
      "Keywords AR:",
      ...keywordsAr,
    ].join("\n"));
  };

  const exportHistoryCsv = () => downloadCsv("listings.csv", history);
  const exportHistoryJson = () => downloadJson("listings.json", history);
  const exportHistoryHtml = () => downloadHtml("listings.html", history);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          AI Listing Optimizer
        </h1>
        <p className="mt-3 text-zinc-600">
          Generate market-ready listings for Amazon, Noon, Carrefour and MicroLess.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Product Name</label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                placeholder="e.g., UltraSlim Wireless Charger"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              >
                {categories.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              {platforms.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Product Page URL (optional)</label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="https://www.amazon.ae/dp/..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Key Features</label>
            <textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="15W fast charging, leather finish, LED indicator..."
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={generateImage}
              onChange={(e) => setGenerateImage(e.target.checked)}
            />
            Generate product images
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
            >
              {loading ? "Generating..." : "Generate Listing"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setImageUrls([]);
                setRecommendedPrices({});
                setCopied(null);
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-5 py-2 text-sm"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-5 py-2 text-sm"
            >
              {showHistory ? "Hide History" : "Show History"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {_result && _result.title && (
        <section className="mt-8 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Optimized Title (EN)</h2>
              <span className="text-xs text-zinc-500">
                {(_result.title || '').length}/200
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-800">{_result.title}</p>
            <button
              onClick={() => copyText(_result.title, 'title')}
              className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
            >
              {copied === 'title' ? 'Copied' : 'Copy title'}
            </button>
          </div>

          {(_result as any).titleAr && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Optimized Title (AR)</h2>
                <span className="text-xs text-zinc-500">
                  {((_result as any).titleAr || '').length}/200
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-800" dir="rtl">
                {(_result as any).titleAr}
              </p>
              <button
                onClick={() => copyText((_result as any).titleAr, 'titleAr')}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                {copied === 'titleAr' ? 'Copied' : 'Copy title AR'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Bullet Points (EN)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800">
              {(_result.bullets || []).map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
            <button
              onClick={() => copyText((_result.bullets || []).join('\n'), 'bullets')}
              className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
            >
              {copied === 'bullets' ? 'Copied' : 'Copy bullets'}
            </button>
          </div>

          {(_result as any).descriptionAr && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Description (AR)</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-800" dir="rtl">
                {(_result as any).descriptionAr}
              </p>
              <button
                onClick={() => copyText((_result as any).descriptionAr, 'descriptionAr')}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                {copied === 'descriptionAr' ? 'Copied' : 'Copy description AR'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Description (EN)</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">
              {_result.description}
            </p>
            <button
              onClick={() => copyText(_result.description, 'description')}
              className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
            >
              {copied === 'description' ? 'Copied' : 'Copy description'}
            </button>
          </div>

          {Array.isArray((_result as any).keywords) && (_result as any).keywords.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">GEO Keywords (EN)</h2>
              <p className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-800">
                {((_result as any).keywords || []).map((k: string, idx: number) => (
                  <span key={idx} className="rounded-full border border-zinc-200 px-3 py-1">
                    {k}
                  </span>
                ))}
              </p>
              <button
                onClick={() => copyText(((_result as any).keywords || []).join(', '), 'keywords')}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                {copied === 'keywords' ? 'Copied' : 'Copy keywords'}
              </button>
            </div>
          )}

          {Array.isArray((_result as any).keywordsAr) && (_result as any).keywordsAr.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">GEO Keywords (AR)</h2>
              <p className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-800" dir="rtl">
                {((_result as any).keywordsAr || []).map((k: string, idx: number) => (
                  <span key={idx} className="rounded-full border border-zinc-200 px-3 py-1">
                    {k}
                  </span>
                ))}
              </p>
              <button
                onClick={() => copyText(((_result as any).keywordsAr || []).join(', '), 'keywordsAr')}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                {copied === 'keywordsAr' ? 'Copied' : 'Copy keywords AR'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">
              {_result.description}
            </p>
            <button
              onClick={() => copyText(_result.description, "description")}
              className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs"
            >
              {copied === "description" ? "Copied" : "Copy description"}
            </button>
          </div>

          {imageUrls.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Generated Images</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Main image: pure white background. Secondary images: lifestyle/detail shots.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
                {imageUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={i === 0 ? 'Main product image white background' : 'Generated listing image'}
                    className="rounded-lg border border-zinc-200"
                  />
                ))}
              </div>
            </div>
          )}

          {Object.keys(recommendedPrices).length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Recommended Prices</h2>
              <p className="mt-2 text-xs text-zinc-500">
                Estimates after typical fees for the selected platform.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(recommendedPrices).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-center"
                  >
                    <div className="text-xs text-zinc-500">{key}</div>
                    <div className="mt-1 text-lg font-semibold">
                      AED {Number(value).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportCurrent}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Export Current (JSON/TXT)
            </button>
          </div>
        </section>
      )}

      {showHistory && (
        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">History</h2>
            <div className="flex gap-2">
              <button
                onClick={exportHistoryCsv}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                Export CSV
              </button>
              <button
                onClick={exportHistoryJson}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                Export JSON
              </button>
              <button
                onClick={exportHistoryHtml}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs"
              >
                Export HTML
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Created At</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-zinc-500">
                      No history yet.
                    </td>
                  </tr>
                )}
                {history.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{item.id}</td>
                    <td className="px-4 py-3">{item.platform}</td>
                    <td className="px-4 py-3">{item.product_name}</td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
