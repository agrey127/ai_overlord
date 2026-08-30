"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import styles from "./FitnessUpcoming.module.css";

export type UpcomingResponse = {
  race: {
    id: string;
    race_name: string;
    race_date: string;
    distance_miles: number;
    location: string | null;
    goal_time_minutes: number | null;
    days_until: number;
  } | null;
  workout: {
    id: string;
    name: string;
    estimated_minutes: number;
    status: "next" | "scheduled" | "in_progress";
    scheduled_for: string | null;
    rotation_position: number | null;
    exercise_count: number;
    exercise_names: string[];
  } | null;
  workout_error?: string | null;
  error?: string;
};

function raceDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function raceCountdown(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function goalPace(minutes: number | null, miles: number) {
  if (!minutes || !miles) return null;
  const totalSeconds = Math.round((minutes * 60) / miles);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}/mi`;
}

export default function FitnessUpcoming() {
  const [data, setData] = useState<UpcomingResponse | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabase();

    async function load(session: Session | null) {
      if (!active) return;
      setSignedIn(Boolean(session));
      if (!session) return;

      try {
        const response = await fetch("/api/fitness/upcoming", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload = (await response.json()) as UpcomingResponse;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load what is next.");
        if (active) setData(payload);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load what is next.");
      }
    }

    void supabase.auth.getSession().then(({ data: sessionData }) => load(sessionData.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void load(session));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (signedIn === null) {
    return <section className={styles.loading}>Loading your next race and workout…</section>;
  }

  if (!signedIn) {
    return (
      <section className={styles.signInCard}>
        <span>Next up</span>
        <p>Sign in to show your saved race and workout rotation.</p>
        <Link href="/baseline/assistant">Sign in through Assistant →</Link>
      </section>
    );
  }

  if (error) {
    return <section className={styles.error} role="status">{error}</section>;
  }

  if (!data) {
    return <section className={styles.loading}>Loading your next race and workout…</section>;
  }

  return <FitnessUpcomingContent data={data} />;
}

export function FitnessUpcomingContent({ data }: { data: UpcomingResponse }) {

  const pace = data.race ? goalPace(data.race.goal_time_minutes, data.race.distance_miles) : null;
  const workoutSummary = data.workout?.exercise_names.join(" · ");

  return (
    <section className={styles.stack} aria-label="Upcoming training">
      <div className={styles.raceBar}>
        <div className={styles.raceLabel}>Next scheduled race</div>
        {data.race ? (
          <>
            <div className={styles.raceMain}>
              <strong>{data.race.race_name}</strong>
              <span>{raceCountdown(data.race.days_until)}</span>
            </div>
            <div className={styles.raceMeta}>
              <span>{raceDate(data.race.race_date)}</span>
              <span>{Number(data.race.distance_miles.toFixed(2))} mi</span>
              {pace && <span>{pace} goal pace</span>}
            </div>
          </>
        ) : (
          <div className={styles.emptyRow}>
            <strong>No race scheduled</strong>
            <Link href="/baseline/more/settings">Add one in Settings →</Link>
          </div>
        )}
      </div>

      <div className={`card ${styles.workoutCard}`}>
        <div className={styles.workoutHeader}>
          <div>
            <div className={styles.sectionLabel}>Next workout in rotation</div>
            <h2>{data.workout?.name ?? "No workout waiting"}</h2>
          </div>
          {data.workout && (
            <div className={styles.duration}>{data.workout.estimated_minutes} min</div>
          )}
        </div>
        {data.workout ? (
          <div className={styles.workoutDetails}>
            <p>{workoutSummary || "Exercise details have not been added yet."}</p>
            <span>
              {data.workout.exercise_count} {data.workout.exercise_count === 1 ? "exercise" : "exercises"}
              {data.workout.status === "in_progress" ? " · in progress" : " · ready when you are"}
            </span>
          </div>
        ) : data.workout_error ? (
          <p className={styles.workoutError} role="status">
            Workout rotation is temporarily unavailable. Your race details are still up to date.
          </p>
        ) : (
          <p className={styles.emptyText}>Create the next plan with the Assistant and it will appear here.</p>
        )}
      </div>
    </section>
  );
}
