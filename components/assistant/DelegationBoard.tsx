import type { AssistantDelegation } from "@/lib/assistant/delegations";
import styles from "./AssistantWorkspace.module.css";

function canRetry(task: AssistantDelegation) {
  return task.status === "pending" || task.status === "failed" || (task.status === "running" && Boolean(task.started_at)
    && Date.now() - new Date(task.started_at!).getTime() > 5 * 60_000);
}

export default function DelegationBoard({ tasks, onRetry, retryingTaskId, mobile = false }: {
  tasks: AssistantDelegation[];
  onRetry: (taskId: string) => void;
  retryingTaskId: string | null;
  mobile?: boolean;
}) {
  return <section className={`${styles.delegationBoard} ${mobile ? styles.delegationBoardMobile : ""}`} aria-label="Delegated specialist tasks">
    <span className={styles.workoutEyebrow}>Chief of Staff</span>
    <h2>Specialist tasks</h2>
    <p className={styles.delegationIntro}>Reviews and drafts return here. Saved changes still need confirmation in the specialist chat.</p>
    {tasks.length ? <ol className={styles.delegationList}>{tasks.map((task) => <li key={task.id}>
      <div className={styles.delegationHeading}><strong>{task.specialist_domain}</strong><span data-status={task.status}>{task.status}</span></div>
      <p className={styles.delegationObjective}>{task.objective}</p>
      {task.result ? <details className={styles.delegationResult}><summary>Read result</summary><p>{task.result}</p></details> : null}
      {task.error ? <p className={styles.delegationError}>{task.error}</p> : null}
      {canRetry(task) ? <button type="button" disabled={Boolean(retryingTaskId)} onClick={() => onRetry(task.id)}>{retryingTaskId === task.id ? "Running…" : task.status === "pending" ? "Run task" : "Retry"}</button> : null}
    </li>)}</ol> : <p className={styles.delegationEmpty}>No tasks delegated yet. Ask Chief of Staff for a specialist review.</p>}
  </section>;
}
