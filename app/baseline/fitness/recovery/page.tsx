import RecoveryDashboard from "@/components/fitness/RecoveryDashboard";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { dayOffset, recoveryColumns, type RecoveryDay } from "@/lib/recovery";
export const dynamic = "force-dynamic";
export default async function RecoveryPage() {
  const db = await createServerSupabase();
  const user = await requireUser(db);
  const timeZone = process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data, error } = await db.from("fitness_daily").select(recoveryColumns)
    .eq("user_id", user.email ?? user.id).gte("day", dayOffset(today, -34)).lte("day", today).order("day");
  return <RecoveryDashboard rows={error ? [] : (data ?? []) as unknown as RecoveryDay[]} today={today} timeZone={timeZone} failed={!!error} />;
}
