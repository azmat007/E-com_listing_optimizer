import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import AutoRefresh from "@/components/AutoRefresh";
import InboxTable from "@/components/InboxTable";

const PAGE_SIZE = 25;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const cookieStore = await cookies();
  const orgId = cookieStore.get("org_id")?.value;
  const branchId = cookieStore.get("branch_id")?.value;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [{ data: conversations }, { count: totalCount }] = await Promise.all([
    db
      .from("conversations")
      .select(
        "id, channel, status, unread_count, last_message_at, ai_paused, tags, customers ( id, full_name, phone )",
      )
      .eq("org_id", orgId!)
      .eq("branch_id", branchId!)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(from, to),

    db
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId!)
      .eq("branch_id", branchId!),
  ]);

  const total = totalCount ?? 0;
  const totalUnread = (conversations ?? []).reduce(
    (s, c: any) => s + (c.unread_count ?? 0),
    0,
  );

  const channelCounts: Record<string, number> = {};
  for (const c of conversations ?? []) {
    const ch = (c as any).channel ?? "unknown";
    channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0C12",
        color: "#F0F5F9",
        padding: "32px 32px 110px",
        fontFamily: "'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif",
      }}
    >
      <AutoRefresh intervalMs={4000} />
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <header>
          <p
            style={{
              color: "#F7C948",
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            ● UNIFIED INBOX
          </p>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 900,
              color: "#F0F5F9",
              margin: "6px 0 12px",
              letterSpacing: "0.02em",
            }}
          >
            Conversations
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#B9CACB",
                background: "rgba(255,255,255,0.04)",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {total.toLocaleString()} THREADS
            </span>
            {totalUnread > 0 && (
              <span
                style={{
                  border: "1px solid rgba(247,201,72,0.45)",
                  color: "#F7C948",
                  background: "rgba(247,201,72,0.08)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {totalUnread.toLocaleString()} UNREAD
              </span>
            )}
            {Object.entries(channelCounts).map(([ch, n]) => (
              <span
                key={ch}
                style={{
                  border: "1px solid rgba(160,220,160,0.35)",
                  color: "#A0DCA0",
                  background: "rgba(160,220,160,0.06)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {ch.toUpperCase()} · {n}
              </span>
            ))}
          </div>
        </header>

        <div
          style={{
            border: "1px solid rgba(111,246,255,0.22)",
            background: "rgba(10,12,18,0.72)",
            backdropFilter: "blur(24px)",
            borderRadius: 16,
            boxShadow: "0 24px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8 }}>
            <InboxTable
              rows={(conversations ?? []) as any}
              totalCount={total}
              page={page}
              pageSize={PAGE_SIZE}
            />
          </div>
        </div>

        <p
          style={{
            color: "#B9CACB",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 700,
            margin: 0,
            textAlign: "center",
          }}
        >
          WhatsApp · Instagram · Voice · SMS · Email — one queue
        </p>
      </div>
    </main>
  );
}
