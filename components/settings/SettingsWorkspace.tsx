"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { ProfileSettings, RunningRace, SettingsResponse } from "@/lib/settings/types";
import styles from "./SettingsWorkspace.module.css";

const emptyRace = { race_name: "", race_date: "", distance_miles: "", location: "", goal_time_minutes: "", notes: "", status: "scheduled" as RunningRace["status"] };

async function headers(json = false) {
  const { data } = await getBrowserSupabase().auth.getSession();
  if (!data.session) throw new Error("Sign in to edit your private profile.");
  return { Authorization: `Bearer ${data.session.access_token}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

function value(value: number | null) { return value ?? ""; }
function minutesLabel(minutes: number | null) {
  if (!minutes) return "No goal time";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m goal` : `${rest}m goal`;
}

export default function SettingsWorkspace() {
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [races, setRaces] = useState<RunningRace[]>([]);
  const [race, setRace] = useState(emptyRace);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/settings", { headers: await headers() });
    const data = await response.json() as SettingsResponse & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load settings.");
    setProfile(data.profile); setRaces(data.races); setEmail(data.email);
  }

  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabase();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.session));
      if (data.session) try { await load(); } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Unable to load settings."); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(Boolean(session));
      if (session) void load();
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  function update<K extends keyof ProfileSettings>(key: K, next: ProfileSettings[K]) {
    setProfile((current) => current ? { ...current, [key]: next } : current);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!profile || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: await headers(true), body: JSON.stringify({ profile }) });
      const data = await response.json() as { profile?: ProfileSettings; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save settings.");
      if (data.profile) setProfile(data.profile);
      setNotice("Profile and goals saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save settings."); }
    finally { setBusy(false); }
  }

  async function saveRace(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/settings/races", { method: editingRaceId ? "PATCH" : "POST", headers: await headers(true), body: JSON.stringify({ id: editingRaceId, race: { ...race, distance_miles: Number(race.distance_miles), goal_time_minutes: race.goal_time_minutes === "" ? null : Number(race.goal_time_minutes) } }) });
      const data = await response.json() as { race?: RunningRace; error?: string };
      if (!response.ok || !data.race) throw new Error(data.error ?? "Unable to save race.");
      setRaces((current) => [...current.filter((item) => item.id !== data.race!.id), data.race!].sort((a, b) => a.race_date.localeCompare(b.race_date)));
      setRace(emptyRace); setEditingRaceId(null); setNotice(editingRaceId ? "Race updated." : "Race scheduled.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save race."); }
    finally { setBusy(false); }
  }

  function editRace(item: RunningRace) {
    setEditingRaceId(item.id);
    setRace({ race_name: item.race_name, race_date: item.race_date, distance_miles: String(item.distance_miles), location: item.location ?? "", goal_time_minutes: item.goal_time_minutes == null ? "" : String(item.goal_time_minutes), notes: item.notes ?? "", status: item.status });
    document.getElementById("race-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteRace(id: string) {
    if (busy || !window.confirm("Remove this race from your schedule?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/settings/races?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: await headers() });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to remove race.");
      setRaces((current) => current.filter((item) => item.id !== id));
      if (editingRaceId === id) { setEditingRaceId(null); setRace(emptyRace); }
      setNotice("Race removed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove race."); }
    finally { setBusy(false); }
  }

  if (signedIn === null) return <section className={styles.stateCard}>Loading your settings…</section>;
  if (!signedIn) return <section className={styles.stateCard}><h2>Sign in to edit</h2><p>Your profile, goals, and races are private to your Baseline account.</p><Link href="/baseline/assistant">Go to Assistant to sign in →</Link></section>;
  if (!profile) return <section className={styles.stateCard}>{error || "Loading your settings…"}</section>;

  return <div className={styles.workspace}>
    {(notice || error) && <div className={error ? styles.error : styles.notice} role="status">{error || notice}</div>}
    <form onSubmit={saveProfile} className={styles.stack}>
      <section className={`card ${styles.section}`}>
        <div className={styles.heading}><div><span>Profile</span><h2>Your details</h2></div><small>{email}</small></div>
        <div className={styles.grid}>
          <Field label="Full name"><input value={profile.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Your name" /></Field>
          <Field label="Timezone"><input value={profile.timezone} onChange={(e) => update("timezone", e.target.value)} placeholder="America/Indiana/Indianapolis" /></Field>
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.heading}><div><span>Training goals</span><h2>Your weekly targets</h2></div></div>
        <div className={styles.grid}>
          <NumberField label="Runs per week" value={profile.weekly_run_goal} min={0} max={14} step={1} onChange={(next) => update("weekly_run_goal", Number(next))} />
          <NumberField label="Strength sessions per week" value={profile.weekly_strength_goal} min={0} max={14} step={1} onChange={(next) => update("weekly_strength_goal", Number(next))} />
          <NumberField label="Weekly mileage" value={value(profile.weekly_mileage_goal)} min={0} max={500} step={0.1} suffix="mi" onChange={(next) => update("weekly_mileage_goal", next === "" ? null : Number(next))} />
          <NumberField label="Target weight" value={value(profile.target_weight_lbs)} min={50} max={1000} step={0.1} suffix="lb" onChange={(next) => update("target_weight_lbs", next === "" ? null : Number(next))} />
          <Field label="Weight direction"><select value={profile.weight_goal_mode} onChange={(e) => update("weight_goal_mode", e.target.value as ProfileSettings["weight_goal_mode"])}><option value="cut">Lose</option><option value="maintain">Maintain</option><option value="bulk">Gain</option></select></Field>
          {profile.weight_goal_mode !== "maintain" && <NumberField label="Target rate per week" value={value(profile.target_rate_lbs_per_week)} min={0.1} max={10} step={0.1} suffix="lb" onChange={(next) => update("target_rate_lbs_per_week", next === "" ? null : Number(next))} />}
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.heading}><div><span>Nutrition & baselines</span><h2>Daily targets</h2></div></div>
        <div className={styles.grid}>
          <NumberField label="BMR" value={value(profile.bmr_calories)} min={500} max={10000} step={1} suffix="cal" onChange={(next) => update("bmr_calories", next === "" ? null : Number(next))} />
          <NumberField label="TDEE" value={value(profile.tdee_calories)} min={500} max={15000} step={1} suffix="cal" onChange={(next) => update("tdee_calories", next === "" ? null : Number(next))} />
          <NumberField label="Daily calorie deficit" value={value(profile.calorie_deficit_goal)} min={-5000} max={5000} step={1} suffix="cal" onChange={(next) => update("calorie_deficit_goal", next === "" ? null : Number(next))} />
          <NumberField label="Protein" value={value(profile.protein_goal_g)} min={0} max={1000} step={1} suffix="g" onChange={(next) => update("protein_goal_g", next === "" ? null : Number(next))} />
          <NumberField label="Fiber" value={value(profile.fiber_goal_g)} min={0} max={500} step={1} suffix="g" onChange={(next) => update("fiber_goal_g", next === "" ? null : Number(next))} />
          <NumberField label="Sodium" value={value(profile.sodium_goal_mg)} min={0} max={50000} step={1} suffix="mg" onChange={(next) => update("sodium_goal_mg", next === "" ? null : Number(next))} />
        </div>
      </section>
      <div className={styles.saveRow}><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save profile & goals"}</button></div>
    </form>

    <section className={`card ${styles.section}`} id="race-editor">
      <div className={styles.heading}><div><span>Race calendar</span><h2>{editingRaceId ? "Edit race" : "Schedule a race"}</h2></div></div>
      <form onSubmit={saveRace} className={styles.stack}>
        <div className={styles.grid}>
          <Field label="Race name"><input required value={race.race_name} onChange={(e) => setRace({ ...race, race_name: e.target.value })} placeholder="Indianapolis Monumental" /></Field>
          <Field label="Race date"><input required type="date" value={race.race_date} onChange={(e) => setRace({ ...race, race_date: e.target.value })} /></Field>
          <NumberField required label="Distance" value={race.distance_miles} min={0.01} max={1000} step={0.01} suffix="mi" onChange={(next) => setRace({ ...race, distance_miles: next })} />
          <Field label="Location"><input value={race.location} onChange={(e) => setRace({ ...race, location: e.target.value })} placeholder="Indianapolis, IN" /></Field>
          <NumberField label="Goal time" value={race.goal_time_minutes} min={1} max={100000} step={1} suffix="min" onChange={(next) => setRace({ ...race, goal_time_minutes: next })} />
          <Field label="Status"><select value={race.status} onChange={(e) => setRace({ ...race, status: e.target.value as RunningRace["status"] })}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field>
        </div>
        <Field label="Notes"><textarea value={race.notes} onChange={(e) => setRace({ ...race, notes: e.target.value })} placeholder="Course notes, pacing plan, lodging…" rows={3} /></Field>
        <div className={styles.formActions}>{editingRaceId && <button type="button" className={styles.secondary} onClick={() => { setEditingRaceId(null); setRace(emptyRace); }}>Cancel edit</button>}<button className={styles.primary} disabled={busy}>{editingRaceId ? "Update race" : "Add race"}</button></div>
      </form>
    </section>

    <section className={styles.raceList} aria-label="Scheduled races">
      <div className={styles.listHeading}><h2>Scheduled races</h2><span>{races.filter((item) => item.status === "scheduled").length} upcoming</span></div>
      {races.length ? races.map((item) => <article className={`card ${styles.raceCard}`} key={item.id}>
        <time dateTime={item.race_date}><strong>{new Date(`${item.race_date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</strong><span>{new Date(`${item.race_date}T12:00:00`).getDate()}</span></time>
        <div><h3>{item.race_name}</h3><p>{item.distance_miles} mi · {item.location || "Location TBD"} · {minutesLabel(item.goal_time_minutes)}</p><span className={styles.status}>{item.status}</span></div>
        <div className={styles.raceActions}><button onClick={() => editRace(item)}>Edit</button><button onClick={() => void deleteRace(item.id)}>Remove</button></div>
      </article>) : <div className={styles.empty}>No races scheduled yet.</div>}
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className={styles.field}><span>{label}</span>{children}</label>; }
function NumberField({ label, value, onChange, suffix, required, ...input }: { label: string; value: string | number; onChange: (value: string) => void; suffix?: string; required?: boolean; min: number; max: number; step: number }) {
  return <Field label={label}><div className={styles.numberInput}><input {...input} required={required} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />{suffix && <span>{suffix}</span>}</div></Field>;
}
