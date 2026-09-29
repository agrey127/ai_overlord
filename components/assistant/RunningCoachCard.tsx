import styles from "./AssistantWorkspace.module.css";

export type RunningCoachCardData = {
  as_of: string;
  profile: {
    goal_description: string;
    target_date: string | null;
    max_runs_per_week: number | null;
    available_days: number[];
    weekly_mileage_target: number | null;
  } | null;
  plans: Array<{
    week_start: string;
    focus: string;
    planned_miles: number;
    sessions: Array<{
      date: string;
      kind: string;
      distance_miles: number;
      description: string;
    }>;
  }>;
  weekly_history: Array<{ week_start: string; miles: number; runs: number }>;
  recent_four_complete_week_average_miles: number;
};

function dayLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00Z`));
}

export default function RunningCoachCard({
  data, onAsk, mobile = false,
}: {
  data: RunningCoachCardData | null;
  onAsk: (message: string) => void;
  mobile?: boolean;
}) {
  const today = data?.as_of ?? new Date().toISOString().slice(0, 10);
  const currentPlan = data?.plans.find((plan) => plan.week_start <= today
    && new Date(`${plan.week_start}T12:00:00Z`).getTime() + 7 * 86_400_000 > new Date(`${today}T12:00:00Z`).getTime());
  const nextSession = currentPlan?.sessions.find((session) => session.date >= today && session.kind !== "rest");
  const currentWeek = data?.weekly_history.at(-1);

  return <section className={mobile ? styles.runningCoachMobile : styles.runningCoachCard}>
    <span className={styles.workoutEyebrow}>Running coach</span>
    <h2>{data?.profile ? "Your running goal" : "Set your next goal"}</h2>
    {data?.profile ? <>
      <p className={styles.coachGoal}>{data.profile.goal_description}</p>
      <p className={styles.coachMeta}>{data.profile.target_date
        ? `Target date ${data.profile.target_date}` : "No target date saved"}</p>
      <div className={styles.coachStats}>
        <span><strong>{currentWeek?.miles.toFixed(1) ?? "0.0"}</strong> mi this week</span>
        <span><strong>{data.recent_four_complete_week_average_miles.toFixed(1)}</strong> mi recent weekly avg</span>
      </div>
      {currentPlan ? <div className={styles.coachPlan}>
        <span className={styles.coachLabel}>This week · {currentPlan.planned_miles} mi planned</span>
        <strong>{currentPlan.focus}</strong>
        {nextSession ? <p>Next: {dayLabel(nextSession.date)} · {nextSession.distance_miles} mi {nextSession.kind}</p>
          : <p>No more runs scheduled this week.</p>}
        <ul>{currentPlan.sessions.map((session) => <li key={session.date}>
          <span>{dayLabel(session.date)}</span>
          <span>{session.kind === "rest" ? "Rest" : `${session.distance_miles} mi · ${session.kind}`}</span>
        </li>)}</ul>
      </div> : <p className={styles.coachEmpty}>No weekly plan saved yet.</p>}
    </> : <p className={styles.coachEmpty}>Tell me what you want to work toward and which days you can run. I’ll use your logged training as a starting point.</p>}
    <div className={styles.coachActions}>
      <button type="button" onClick={() => onAsk(data?.profile
        ? "Review my running goal and recent training. What should I focus on now?"
        : "Help me set up my running coach goal and training schedule.")}>{data?.profile ? "Review goal" : "Set up coach"}</button>
      <button type="button" onClick={() => onAsk("Review my most recent run against my recent training and current plan.")}>Review last run</button>
      <button type="button" onClick={() => onAsk("Review this running week against my saved plan and recent history. Identify what is known, what is missing, and what to adjust next.")}>Review week</button>
      <button type="button" onClick={() => onAsk("Build a personalized running plan for this week using my saved goal, available days, recent runs, and recovery data. Preview it before saving.")}>Plan this week</button>
    </div>
  </section>;
}
