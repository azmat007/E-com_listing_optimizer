import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import NavBarWrapper from "@/components/NavBarWrapper";
import AppointmentsTable from "@/components/AppointmentsTable";
import { PreviewShell, GlassPanel, Chip, VBtn as VelocityButton } from "@/components/preview/Shell";

const PAGE_SIZE = 20;

export default async function AppointmentsPage({
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

  const branchRows = await db
    .from("branches")
    .select("id, name, timezone, open_time, close_time")
    .eq("org_id", orgId!)
    .eq("is_active", true)
    .order("name");

  const branchRow = (branchRows.data ?? [])[0] ?? {
    timezone: "Asia/Dubai",
    open_time: "09:00",
    close_time: "21:00",
  };

  let resolvedBranchId = branchId;
  const { data: branchIdRow } = await db
    .from("branches")
    .select("id")
    .eq("org_id", orgId!)
    .limit(1)
    .maybeSingle();

  if (branchIdRow) resolvedBranchId = branchIdRow.id;

  const tz = branchRow.timezone ?? "Asia/Dubai";
  const todayStart = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [{ data: appointments, count }, { count: totalCount }] = await Promise.all([
    db
      .from("appointments")
      .select(
        `
        id, status, notes, created_at, source, created_by_ai,
        customers ( full_name, phone ),
        appointment_items (
          start_time, end_time, price, total_price,
          services ( name, duration_minutes ),
          staff ( full_name, display_name )
        )
      `,
        { count: "exact" },
      )
      .eq("org_id", orgId!)
      .eq("branch_id", resolvedBranchId!)
      .order("created_at", { ascending: false })
      .range(from, to),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("org_id", orgId!).eq("branch_id", resolvedBranchId!),
  ]);

  const todaysAppts = (appointments ?? []).filter(
    (a: any) => a.appointment_items?.[0]?.start_time
      ? new Date(a.appointment_items[0].start_time) >= todayStart && new Date(a.appointment_items[0].start_time) < todayEnd
      : false,
  );

  const confirmedCount = (appointments ?? []).filter((a: any) => a.status === "confirmed").length;
  const pendingCount = (appointments ?? []).filter((a: any) => a.status === "pending").length;
  const totalRevenue = (appointments ?? []).reduce(
    (sum: number, a: any) =>
      sum + (a.appointment_items ?? []).reduce((s: number, i: any) => s + Number(i.total_price ?? 0), 0),
    0,
  );

  const today = new Date();
  const branchName = branchRow.name ?? "Main";

  return (
    <PreviewShell activeTab="appointments">
      <main
        style={{
          minHeight: "100vh",
          background: "#08090C",
          color: "#F0F5F9",
          padding: "32px 32px 110px",
          fontFamily: "'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1920,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  color: "#6FF6FF",
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                }}
              >
                CALENDAR
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
                Appointments
              </h1>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Chip tone="mute">{totalCount?.toLocaleString() ?? 0} TOTAL</Chip>
                <Chip tone="cyan">{confirmedCount} CONFIRMED</Chip>
                <Chip tone="magenta">{pendingCount} PENDING</Chip>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#B9CACB" }}>{branchName}</span>
              <Link
                href="/appointments/new"
                style={{
                  padding: "12px 22px",
                  background: "linear-gradient(135deg, #22D3EE 0%, #FF5167 100%)",
                  color: "#050608",
                  fontWeight: 900,
                  fontSize: 12,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                + New Booking
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            <GlassPanel>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>TODAY</p>
                <p
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: "#F0F5F9",
                    margin: "8px 0 4px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {todaysAppts.length}
                </p>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>Appointments</p>
              </div>
            </GlassPanel>
            <GlassPanel>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>REVENUE TODAY</p>
                <p
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: "#6FF6FF",
                    margin: "8px 0 4px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  AED {totalRevenue.toLocaleString("en-US")}
                </p>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  Payments
                </p>
              </div>
            </GlassPanel>
            <GlassPanel>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>CONFLICTS</p>
                <p
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: "#FF5167",
                    margin: "8px 0 4px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  0
                </p>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  Double bookings
                </p>
              </div>
            </GlassPanel>
            <GlassPanel>
              <div style={{ padding: 20 }}>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>WORKING HOURS</p>
                <p
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: "#6FF6FF",
                    margin: "8px 0 4px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {branchRow.open_time ?? "9:00"} — {branchRow.close_time ?? "21:00"}
                </p>
                <p style={{ fontSize: 10, color: "#B9CACB", margin: 0, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  {branchRow.timezone ?? "Asia/Dubai"}
                </p>
              </div>
            </GlassPanel>
          </div>

          <GlassPanel style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid rgba(111,246,255,0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#F0F5F9",
                    margin: 0,
                  }}
                >
                  {today.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h2>
                <p
                  style={{
                    fontSize: 10,
                    color: "#B9CACB",
                    margin: "4px 0 0",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  {branchName} · {branchRow.timezone ?? "Asia/Dubai"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <VelocityButton variant="outline">Today</VelocityButton>
                <VelocityButton variant="outline">Week</VelocityButton>
                <VelocityButton variant="outline">Month</VelocityButton>
              </div>
            </div>

            <div style={{ padding: 20, height: "calc(100vh - 340px)", overflowY: "auto" }}>
              <CalendarGrid appointments={todaysAppts as any} now={today} tz={tz} />
            </div>
          </GlassPanel>

          <GlassPanel>
            <div style={{ padding: 18 }}>
              <p
                style={{
                  fontSize: 10,
                  color: "#B9CACB",
                  margin: 0,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                History
              </p>
              <div style={{ padding: "14px 0" }}>
                <AppointmentsTable
                  rows={(appointments ?? []) as any}
                  totalCount={totalCount ?? 0}
                  page={page}
                  pageSize={PAGE_SIZE}
                />
              </div>
            </div>
          </GlassPanel>
        </div>
      </main>
    </PreviewShell>
  );
}

function CalendarGrid({
  appointments,
  now,
  tz,
}: {
  appointments: any[];
  now: Date;
  tz: string;
}) {
  const hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 40,
          top: 40,
          background: "rgba(111,246,255,0.12)",
          borderTop: "1px dashed rgba(111,246,255,0.6)",
          borderBottom: "1px dashed rgba(111,246,255,0.6)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 8,
            top: 10,
            fontSize: 10,
            color: "#6FF6FF",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          NOW
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "70px repeat(3, 1fr)",
          gap: 8,
        }}
      >
        <div />
        {["Mariam", "Ahmad", "Sara"].map((s) => (
          <div key={s} style={{ padding: "6px 0", textAlign: "center" }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#6FF6FF",
                boxShadow: "0 0 12px #6FF6FF",
                border: "2px solid #050608",
                margin: "0 auto 6px",
              }}
            />
            <p
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#F0F5F9",
                margin: 0,
              }}
            >
              {s}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "#6FF6FF",
                margin: 0,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Stylist
            </p>
          </div>
        ))}

        {hours.map((hour) => {
          const slotDate = new Date(now);
          slotDate.setHours(Number(hour), 0, 0, 0);

          return (
            <>
              <div
                style={{
                  padding: "0 8px 0 0",
                  textAlign: "right",
                  borderTop: "1px solid rgba(111,246,255,0.1)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "#B9CACB",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  {hour}:00
                </span>
              </div>
              {["Mariam", "Ahmad", "Sara"].map((s) => {
                const matches = (appointments ?? []).filter((a) => {
                  const item = a.appointment_items?.[0];
                  if (!item?.start_time) return false;
                  const start = new Date(item.start_time);
                  return start.getHours() === slotDate.getHours() && ((item.staff as any)?.full_name ?? "").startsWith(s);
                });

                return (
                  <div
                    key={`${s}-${hour}`}
                    style={{
                      height: 58,
                      position: "relative",
                      padding: 2,
                      borderTop: "1px solid rgba(111,246,255,0.1)",
                    }}
                  >
                    {matches.map((a) => {
                      const item = a.appointment_items?.[0];
                      const duration = item?.services?.duration_minutes ?? 60;
                      const height = Math.min(Math.max(duration, 30), 120);

                      return (
                        <div
                          key={a.id}
                          style={{
                            position: "absolute",
                            inset: 0,
                            height: `${height}px`,
                            background: "linear-gradient(180deg, rgba(111,246,255,0.18) 0%, rgba(111,246,255,0.08) 100%)",
                            border: "1px solid rgba(111,246,255,0.6)",
                            clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                            padding: "8px 10px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            zIndex: 2,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                color: "#6FF6FF",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                              }}
                            >
                              {item?.services?.name ?? "Service"} · {a.status}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                color: "#B9CACB",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                              }}
                            >
                              {item?.start_time ? new Date(item.start_time).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                                timeZone: tz,
                              }) : "—"}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: 10,
                              color: "#F0F5F9",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {a.customers?.full_name ?? "Guest"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          );
        })}
      </div>
    </div>
  );
}
