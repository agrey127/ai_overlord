import Link from "next/link";
import { requireUserId } from "@/lib/supabase/server";
import { garminConfigured } from "@/lib/garmin/import";
import { GarminImport } from "./GarminImport";

export default async function GarminPage() {
  const userId = await requireUserId();
  const configured = garminConfigured() && userId === process.env.GARMIN_PERSONAL_USER_ID?.trim();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIME_ZONE ?? "America/Indiana/Indianapolis",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 30);
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      <Link href="/baseline/more">← Back to More</Link>
      <h1>Garmin Connect</h1>
      <p className="card-muted">Import completed runs after your watch syncs with Garmin Connect. The scheduled feed also refreshes sleep score, resting heart rate, and steps hourly.</p>
      <section className="card"><div className="card-inner">
        <h2 style={{ marginTop: 0 }}>Personal connection</h2>
        {configured ? <p>Personal access configured for your Baseline account. Preview runs to check the connection.</p> : <>
          <p>Your Personal API key still needs to be added to the protected server configuration.</p>
          <p><a href="https://connect.garmin.com/app/settings/personalApiToken" target="_blank" rel="noreferrer">Open Garmin Personal API settings ↗</a></p>
          <p className="card-muted">Create a key in Garmin Connect and save it in your password manager. Keep it out of chat.</p>
        </>}
        <p className="card-muted">Scheduled syncing can pick up new runs after its activation cutoff. Use this page to review manual imports. Previously imported runs and possible matches to existing entries are excluded. Strength sets and planned workouts are not included.</p>
        <GarminImport configured={configured} initialStart={start.toISOString().slice(0, 10)} today={today} />
      </div></section>
    </main>
  );
}
