# Assistant domain boundaries

Baseline's active chats use one shared accuracy and confirmation prompt plus a separate prompt for each domain. The prompt modules live in `lib/assistant/prompts`; `lib/assistant/domain-config.ts` selects the prompt and tools from the stored conversation domain. Each assistant reply records `prompt_version` in its message metadata.

| Chat | Model tools | Server-enforced data scope |
| --- | --- | --- |
| Strength | Workout rotation, plans, sets, progress | Strength tools only |
| Running | Run totals, Garmin activity drafts | `runs` totals; run imports only |
| Nutrition | Meal totals, saved meals, meal drafts | `meal_logs` totals; meal drafts and writes |
| General | Totals, current workout | Limited information-only chat; no write tools |
| Chief of Staff | Dated, bounded cross-domain brief | Read-only; Strength, Running, and Nutrition summaries and latest assistant excerpts |

`lib/assistant/domain-policy.ts` is the server-side tool allowlist. `runAssistantTool` checks it before dispatch and confirms that a pending draft belongs to the current conversation. Adding a tool to a domain requires updating both the allowlist and the domain prompt. The model receives only the selected domain's tools, but prompt text by itself is never treated as an access control.

The current specialist chats keep separate OpenAI response chains. Existing transcripts remain in Supabase and are not copied between chats. Older messages within an existing chat can still be part of its response chain; a future clean-history cutover would need a deliberate new chain or a domain-scoped handoff.

The Chief of Staff has its own conversation and response chain. Its brief reads the signed-in user's saved 7-day running and nutrition totals, strength plan status, and up to 600 characters from each specialist's latest assistant message. It does not receive specialist write tools or whole transcripts. The brief marks calendar, tasks, email, finance, and relationships as unavailable. Its advice is planning in conversation, not a persisted task or calendar action.

On 2026-09-28, the production Supabase project accepted migrations `20260928163710_save_logged_meal_as_saved` and `20260928163717_chief_of_staff_domain`. A read-only verification confirmed the meal function and Chief of Staff domain constraint. Application rollout and chat smoke verification must be recorded after publication.
