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

const CATEGORIES = [
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

const PLATFORMS = [
  { id: "amazon", label: "Amazon" },
  { id: "noon", label: "Noon" },
  { id: "carrefour", label: "Carrefour" },
  { id: "microless", label: "MicroLess" },
];

export default function Home() {
  const [view, setView] = useState<"generate" | "history">("generate");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [features, setFeatures] = useState("");
  const [platform, setPlatform] = useState("amazon");
  const [generateImage, setGenerateImage] = useState(true);
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
    if (view !== "history") return;
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
  }, [view]);

  const [sourceUrl, setSourceUrl] = useState('');
  const [sourcePreview, setSourcePreview] = useState<{ title?: string; description?: string; points: string[]; images: string[] } | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceVerified, setSourceVerified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setImageUrls([]);
    setRecommendedPrices({});
    setCopied(null);

    let data: any = null;
    try {
      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, category, features, platform, sourceUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Generation failed.');
      }
      data = await res.json();
      setResult(data);
      if (view === "history") refreshHistory();

      if (generateImage) {
        const prompt = data.imagePrompts?.main || `${productName} ${category} ${features}`;
        const secondaryPrompts = Array.isArray(data.imagePrompts?.secondary)
          ? data.imagePrompts.secondary.slice(0, 4)
          : [];

        const imgRes = await fetch('/api/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompts: [prompt, ...secondaryPrompts] }),
        });
        const imgData = await imgRes.json();
        if (!imgRes.ok) throw new Error(imgData?.error || 'Image generation failed.');
        setImageUrls(imgData.urls);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
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
    const keywords: string[] = (_result as any).keywords || [];
    const keywordsAr: string[] = (_result as any).keywordsAr || [];
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
    downloadJson('listing.json', payload);
    downloadText(
      'listing.txt',
      [
        _result.title,
        '',
        ...(_result.bullets || []),
        '',
        _result.description,
        '',
        'Keywords EN:',
        ...keywords,
        '',
        'Keywords AR:',
        ...keywordsAr,
      ].join('\n')
    );
    copyText("", "export");
  };

  const exportHistoryCsv = () => downloadCsv('listings.csv', history);
  const exportHistoryJson = () => downloadJson('listings.json', history);
  const exportHistoryHtml = () => downloadHtml('listings.html', history);

  const verifySource = async () => {
    if (!sourceUrl) return;
    setLoadingSource(true);
    setSourceVerified(false);
    setSourcePreview(null);
    try {
      const res = await fetch('/api/source/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await res.json();
      if (data.status === 'inaccessible') {
        throw new Error(data.reachableError || data.error || data.note || 'Unable to verify link.');
      }
      setSourcePreview({
        title: data.title,
        description: data.description,
        points: Array.isArray(data.points) ? data.points : ['No details available.'],
        images: Array.isArray(data.images) ? data.images : [],
      });
      setSourceVerified(true);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setSourceVerified(false);
      setSourcePreview(null);
    } finally {
      setLoadingSource(false);
    }
  };

  const submitDisabled = !productName.trim() || !features.trim() || loading;
  const cl = (label: string) => (copied === label ? "▸ COPIED" : "COPY ⧉");
  const keywords: string[] = (_result as any)?.keywords || [];
  const keywordsAr: string[] = (_result as any)?.keywordsAr || [];
  const descriptionAr: string | undefined = (_result as any)?.descriptionAr;
  const imageSlots = ["MAIN · WHITE BG", "LIFESTYLE 01", "LIFESTYLE 02", "DETAIL", "IN-HAND"];

  return (
    <div className="min-h-screen">
      <header className="relative flex items-center justify-between px-9 py-5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-[9px] border grid place-items-center" style={{ borderColor: "var(--acc-line)", background: "var(--acc-dim)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="var(--acc)" strokeWidth="1.6" />
              <path d="M12 22V12M3 7l9 5 9-5" stroke="var(--acc)" strokeWidth="1.6" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-base tracking-[.06em]">
              LISTFORGE<span style={{ color: "var(--acc)" }}>_AI</span>
            </div>
            <div className="lf-mono text-[10px] tracking-[.14em]" style={{ color: "var(--muted)" }}>
              LISTING OPTIMIZER · V2.6
            </div>
          </div>
        </div>
        <nav className="flex gap-2 items-center">
          <button
            onClick={() => setView("generate")}
            className="lf-tab-btn"
            style={{
              border: `1px solid ${view === "generate" ? "var(--acc-line)" : "rgba(140,170,200,.18)"}`,
              background: view === "generate" ? "var(--acc-dim)" : "transparent",
              color: view === "generate" ? "var(--acc)" : "var(--text-dim)",
            }}
          >
            Generate
          </button>
          <button
            onClick={() => setView("history")}
            className="lf-tab-btn"
            style={{
              border: `1px solid ${view === "history" ? "var(--acc-line)" : "rgba(140,170,200,.18)"}`,
              background: view === "history" ? "var(--acc-dim)" : "transparent",
              color: view === "history" ? "var(--acc)" : "var(--text-dim)",
            }}
          >
            History
          </button>
          <div className="hidden md:flex items-center gap-2 ml-4 lf-mono text-[10.5px] tracking-[.1em]" style={{ color: "var(--muted-2)" }}>
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: "var(--acc)", boxShadow: "0 0 8px var(--acc)", animation: "pulse 2.4s infinite" }}
            />
            AI ONLINE
          </div>
        </nav>
      </header>

      {view === "generate" && (
        <main className="relative grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-7 px-9 py-8 max-w-[1440px] mx-auto items-start">
          <section className="lf-card p-6 lg:sticky lg:top-6">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="lf-section-title">INPUT CONSOLE</h2>
              <span className="lf-mono text-[10px]" style={{ color: "#4a5568" }}>01</span>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="lf-label">Product Name</label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  className="lf-input"
                  placeholder="e.g., UltraSlim Wireless Charger"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="lf-label">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="lf-input"
                  >
                    {CATEGORIES.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="lf-label">Images</label>
                  <button
                    type="button"
                    onClick={() => setGenerateImage((v) => !v)}
                    className="lf-toggle-btn"
                    style={{
                      borderColor: generateImage ? "var(--acc-line)" : "var(--input-border)",
                      background: generateImage ? "var(--acc-dim)" : "var(--input-bg)",
                      color: generateImage ? "var(--acc)" : "var(--text-dim)",
                    }}
                  >
                    {generateImage ? "◉ ON" : "○ OFF"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="lf-label">Target Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => {
                    const on = platform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlatform(p.id)}
                        className="lf-toggle-btn"
                        style={{
                          borderColor: on ? "var(--acc-line)" : "var(--input-border)",
                          background: on ? "var(--acc-dim)" : "var(--input-bg)",
                          color: on ? "var(--acc)" : "var(--text-dim)",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="lf-label">
                  Product Page URL <span style={{ color: "var(--muted)", fontWeight: 400 }}>— optional</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={sourceUrl}
                    onChange={(e) => {
                      setSourceUrl(e.target.value);
                      setSourceVerified(false);
                      setSourcePreview(null);
                    }}
                    className="lf-input lf-mono flex-1 min-w-0"
                    placeholder="https://www.amazon.ae/dp/..."
                  />
                  <button
                    type="button"
                    onClick={verifySource}
                    disabled={loadingSource || !sourceUrl.trim()}
                    className="lf-toggle-btn px-4 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: sourceVerified ? "var(--acc-line)" : "rgba(140,170,200,.2)",
                      background: sourceVerified ? "var(--acc-dim)" : "transparent",
                      color: sourceVerified ? "var(--acc)" : "var(--text-soft)",
                    }}
                  >
                    {loadingSource ? "SCANNING…" : sourceVerified ? "✓ VERIFIED" : "VERIFY"}
                  </button>
                </div>
                {sourceVerified && sourcePreview && (
                  <div className="mt-1.5 rounded-[10px] border p-3" style={{ borderColor: "var(--acc-line)", background: "var(--acc-dim)" }}>
                    <div className="lf-mono text-[10px] tracking-[.14em] mb-2" style={{ color: "var(--acc)" }}>
                      SOURCE POINTERS EXTRACTED
                    </div>
                    <ul className="m-0 pl-4 text-xs flex flex-col gap-1" style={{ color: "var(--text-soft)" }}>
                      {(sourcePreview.points || []).map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                    {Array.isArray(sourcePreview.images) && sourcePreview.images.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sourcePreview.images.slice(0, 4).map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Source image ${idx + 1}`}
                            className="h-16 w-16 rounded-md border object-cover"
                            style={{ borderColor: "var(--panel-border)" }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="lf-label">Key Features</label>
                <textarea
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  required
                  rows={4}
                  className="lf-textarea"
                  placeholder="15W fast charging, leather finish, LED indicator..."
                />
              </div>

              <div className="flex gap-2.5 mt-1">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="lf-btn-primary flex-1 h-[46px] text-sm"
                >
                  {loading ? "GENERATING…" : submitDisabled && loadingSource ? "VERIFYING LINK…" : "⟡ GENERATE LISTING"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setImageUrls([]);
                    setRecommendedPrices({});
                    setCopied(null);
                    setSourceUrl('');
                    setSourceVerified(false);
                    setSourcePreview(null);
                    setProductName('');
                    setFeatures('');
                  }}
                  className="lf-btn-ghost h-[46px] px-4 text-sm"
                >
                  Reset
                </button>
              </div>
            </form>
          </section>

          <section className="min-h-[70vh]">
            {error && (
              <p className="mb-4 rounded-lg border p-3 text-sm" style={{ borderColor: "rgba(255,90,90,.3)", background: "rgba(255,90,90,.08)", color: "#ff9a9a" }}>
                {error}
              </p>
            )}

            {!loading && !_result && (
              <div className="h-[70vh] rounded-2xl border border-dashed grid place-items-center" style={{ borderColor: "rgba(140,170,200,.16)" }}>
                <div className="text-center max-w-[340px]">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl border grid place-items-center" style={{ borderColor: "rgba(140,170,200,.16)", background: "var(--panel)" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="#5d6b80" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="3.2" stroke="var(--acc)" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div className="text-base font-semibold" style={{ color: "var(--text-soft)" }}>Output bay empty</div>
                  <p className="text-[13px] leading-relaxed mt-2" style={{ color: "var(--muted)" }}>
                    Describe your product on the left and run the generator. Titles, bullets, keywords and pricing will materialize here — in English and Arabic.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="h-[70vh] rounded-2xl border grid place-items-center relative overflow-hidden" style={{ borderColor: "var(--acc-line)", background: "rgba(13,18,30,.5)" }}>
                <div
                  className="absolute top-0 left-0 w-[30%] h-0.5"
                  style={{ background: "linear-gradient(90deg,transparent,var(--acc),transparent)", animation: "scan 1.6s linear infinite" }}
                />
                <div className="text-center">
                  <div
                    className="w-[54px] h-[54px] mx-auto mb-5 rounded-full border-2"
                    style={{ borderColor: "var(--acc-dim)", borderTopColor: "var(--acc)", animation: "spin .9s linear infinite" }}
                  />
                  <div className="lf-mono text-xs tracking-[.16em]" style={{ color: "var(--acc)" }}>
                    GENERATING LISTING…
                  </div>
                </div>
              </div>
            )}

            {!loading && _result && (_result.title || '').trim() && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="lf-badge">{platform.toUpperCase()}</span>
                    <span className="lf-mono text-[10.5px] tracking-[.1em]" style={{ color: "var(--muted)" }}>
                      GENERATED JUST NOW
                    </span>
                  </div>
                  <button onClick={exportCurrent} className="lf-btn-ghost h-[34px] px-4 text-xs">
                    {copied === "export" ? "▸ EXPORTED" : "EXPORT JSON / TXT"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="lf-card p-5">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="lf-section-title text-[11px]">TITLE · EN</span>
                      <span className="lf-mono text-[10px]" style={{ color: "var(--muted)" }}>{(_result.title || '').length}/200</span>
                    </div>
                    <p className="m-0 text-sm leading-relaxed">{_result.title}</p>
                    <button onClick={() => copyText(_result.title, 'title')} className="lf-copy-btn mt-3">{cl('title')}</button>
                  </div>

                  {_result.titleAr && (
                    <div className="lf-card p-5" dir="rtl">
                      <div className="flex justify-between items-center mb-2.5" dir="ltr">
                        <span className="lf-section-title text-[11px]">TITLE · AR</span>
                        <span className="lf-mono text-[10px]" style={{ color: "var(--muted)" }}>{(_result.titleAr || '').length}/200</span>
                      </div>
                      <p className="m-0 text-sm leading-loose">{_result.titleAr}</p>
                      <button onClick={() => copyText(_result.titleAr, 'titleAr')} className="lf-copy-btn mt-3">{cl('titleAr')}</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="lf-card p-5">
                    <span className="lf-section-title text-[11px]">BULLETS · EN</span>
                    <ul className="mt-3 pl-4.5 flex flex-col gap-2 text-[13px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
                      {(_result.bullets || []).map((bullet, i) => (
                        <li key={i}>{bullet}</li>
                      ))}
                    </ul>
                    <button onClick={() => copyText((_result.bullets || []).join('\n'), 'bullets')} className="lf-copy-btn mt-3.5">{cl('bullets')}</button>
                  </div>

                  {(_result as any).bulletsAr && (
                    <div className="lf-card p-5" dir="rtl">
                      <span className="lf-section-title text-[11px]" dir="ltr">BULLETS · AR</span>
                      <ul className="mt-3 pr-4.5 flex flex-col gap-2 text-[13px] leading-loose" style={{ color: "var(--text-soft)" }}>
                        {((_result as any).bulletsAr || []).map((bullet: string, i: number) => (
                          <li key={`ar-${i}`}>{bullet}</li>
                        ))}
                      </ul>
                      <button onClick={() => copyText(((_result as any).bulletsAr || []).join('\n'), 'bulletsAr')} className="lf-copy-btn mt-3.5">{cl('bulletsAr')}</button>
                    </div>
                  )}
                </div>

                <div className="lf-card p-5">
                  <span className="lf-section-title text-[11px]">DESCRIPTION · EN</span>
                  <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: "var(--text-soft)" }}>
                    {_result.description}
                  </p>
                  <button onClick={() => copyText(_result.description, "description")} className="lf-copy-btn mt-3.5">{cl('description')}</button>
                </div>

                {descriptionAr && (
                  <div className="lf-card p-5" dir="rtl">
                    <span className="lf-section-title text-[11px]" dir="ltr">DESCRIPTION · AR</span>
                    <p className="mt-3 text-[13.5px] leading-loose whitespace-pre-line">{descriptionAr}</p>
                    <button onClick={() => copyText(descriptionAr, 'descriptionAr')} className="lf-copy-btn mt-3.5">{cl('descriptionAr')}</button>
                  </div>
                )}

                {(keywords.length > 0 || keywordsAr.length > 0) && (
                  <div className="lf-card p-5">
                    <div className="flex justify-between items-center">
                      <span className="lf-section-title text-[11px]">GEO KEYWORDS · EN + AR</span>
                      <button
                        onClick={() => copyText([...keywords, ...keywordsAr].join(', '), 'keywords')}
                        className="lf-copy-btn"
                      >
                        {cl('keywords')}
                      </button>
                    </div>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {keywords.map((k, idx) => (
                        <span key={`en-${idx}`} className="lf-pill">{k}</span>
                      ))}
                      {keywordsAr.map((k, idx) => (
                        <span key={`ar-${idx}`} className="lf-pill" dir="rtl">{k}</span>
                      ))}
                    </div>
                  </div>
                )}

                {generateImage && (
                  <div className="lf-card p-5">
                    <div className="flex justify-between items-baseline">
                      <span className="lf-section-title text-[11px]">GENERATED IMAGES</span>
                      <span className="lf-mono text-[10px]" style={{ color: "var(--muted)" }}>
                        {imageUrls.length > 0 ? "MAIN: WHITE BG · 4 LIFESTYLE" : "PENDING"}
                      </span>
                    </div>
                    {imageUrls.length > 0 ? (
                      <div className="mt-3.5 grid grid-cols-2 md:grid-cols-5 gap-3">
                        {imageUrls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={i === 0 ? 'Main product image white background' : 'Generated listing image'}
                            className="lf-image-slot"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3.5 grid grid-cols-2 md:grid-cols-5 gap-3">
                        {imageSlots.map((label) => (
                          <div key={label} className="lf-image-slot grid place-items-center">
                            <div className="text-center">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="3" width="18" height="18" rx="3" stroke="#5d6b80" strokeWidth="1.4" />
                                <circle cx="9" cy="9" r="1.6" fill="#5d6b80" />
                                <path d="M4 17l5-5 4 4 3-3 4 4" stroke="#5d6b80" strokeWidth="1.4" />
                              </svg>
                              <div className="lf-mono text-[9px] mt-1.5 tracking-[.08em]" style={{ color: "var(--muted)" }}>{label}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {Object.keys(recommendedPrices).length > 0 && (
                  <div className="lf-card p-5">
                    <div className="flex justify-between items-baseline">
                      <span className="lf-section-title text-[11px]">RECOMMENDED PRICES</span>
                      <span className="lf-mono text-[10px]" style={{ color: "var(--muted)" }}>NET OF PLATFORM FEES</span>
                    </div>
                    <div className="mt-3.5 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(recommendedPrices).map(([key, value]) => {
                        const on = key.toLowerCase() === platform;
                        return (
                          <div
                            key={key}
                            className="rounded-[11px] p-3.5 text-center border"
                            style={{
                              borderColor: on ? "var(--acc-line)" : "rgba(140,170,200,.1)",
                              background: on ? "var(--acc-dim)" : "rgba(5,8,14,.4)",
                            }}
                          >
                            <div className="lf-mono text-[10px] tracking-[.12em]" style={{ color: "var(--muted-2)" }}>{key.toUpperCase()}</div>
                            <div className="mt-1.5 text-lg font-bold" style={{ color: on ? "var(--acc)" : "var(--foreground)" }}>
                              AED {Number(value).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {view === "history" && (
        <main className="relative px-9 py-8 max-w-[1240px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="m-0 text-xl font-bold">Generation History</h2>
              <div className="lf-mono text-[10.5px] tracking-[.12em] mt-1" style={{ color: "var(--muted)" }}>
                LOCAL SQLITE · {history.length} RECORDS
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={exportHistoryCsv} className="lf-btn-ghost h-[34px] px-3.5 lf-mono text-[11px] tracking-[.06em]">CSV ↓</button>
              <button onClick={exportHistoryJson} className="lf-btn-ghost h-[34px] px-3.5 lf-mono text-[11px] tracking-[.06em]">JSON ↓</button>
              <button onClick={exportHistoryHtml} className="lf-btn-ghost h-[34px] px-3.5 lf-mono text-[11px] tracking-[.06em]">HTML ↓</button>
            </div>
          </div>

          <div className="lf-card overflow-hidden">
            <div
              className="grid px-5 py-3 border-b lf-mono text-[10px] tracking-[.14em]"
              style={{ gridTemplateColumns: "60px 110px 1fr 2fr 170px", borderColor: "rgba(140,170,200,.1)", color: "var(--muted-2)" }}
            >
              <span>ID</span><span>PLATFORM</span><span>PRODUCT</span><span>TITLE</span><span>CREATED</span>
            </div>
            {history.length === 0 && (
              <div className="px-5 py-4 text-sm" style={{ color: "var(--muted)" }}>No history yet.</div>
            )}
            {history.map((item) => (
              <div
                key={item.id}
                className="grid px-5 py-3.5 border-b text-[12.5px] items-center"
                style={{ gridTemplateColumns: "60px 110px 1fr 2fr 170px", borderColor: "rgba(140,170,200,.06)", color: "var(--text-soft)" }}
              >
                <span className="lf-mono" style={{ color: "var(--muted)" }}>#{item.id}</span>
                <span><span className="lf-badge lf-mono text-[10px] tracking-[.1em]">{item.platform?.toUpperCase()}</span></span>
                <span>{item.product_name}</span>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-3.5" style={{ color: "var(--muted-2)" }}>{item.title}</span>
                <span className="lf-mono text-[11px]" style={{ color: "var(--muted)" }}>
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </main>
      )}

      <footer className="relative px-9 pb-10 pt-4 max-w-[1440px] mx-auto">
        <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(140,170,200,.2),transparent)" }} />
        <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between lf-mono text-[10px] tracking-[.1em]" style={{ color: "var(--muted)" }}>
          <p className="m-0">LISTFORGE_AI — built for Gulf sellers.</p>
          <p className="m-0">Optimized for Amazon AE/SA, Noon, Carrefour and MicroLess workflows.</p>
        </div>
      </footer>
    </div>
  );
}
