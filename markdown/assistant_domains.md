# Assistant domain boundaries

Baseline's active chats use one shared accuracy and confirmation prompt plus a separate prompt for each domain. The prompt modules live in `lib/assistant/prompts`; `lib/assistant/domain-config.ts` selects the prompt and tools from the stored conversation domain. Each assistant reply records `prompt_version` in its message metadata.

| Chat | Model tools | Server-enforced data scope |
| --- | --- | --- |
| Strength | Workout rotation, plans, sets, progress | Strength tools only |
| Running | Run totals, individual runs and recovery, goal and weekly-plan drafts, Garmin activity drafts | Running-owned records and read-only recovery signals; confirmed running writes only |
| Nutrition | Meal totals, saved meals, meal drafts | `meal_logs` totals; meal drafts and writes |
| General | Totals, current workout | Limited information-only chat; no write tools |
| Chief of Staff | Dated, bounded cross-domain brief | Read-only; Strength and Nutrition excerpts, plus a structured Running summary |

`lib/assistant/domain-policy.ts` is the server-side tool allowlist. `runAssistantTool` checks it before dispatch and confirms that a pending draft belongs to the current conversation. Adding a tool to a domain requires updating both the allowlist and the domain prompt. The model receives only the selected domain's tools, but prompt text by itself is never treated as an access control.

The current specialist chats keep separate OpenAI response chains. Existing transcripts remain in Supabase and are not copied between chats. On the first Running or Chief of Staff reply after prompt version 4, the app starts a clean model response chain while retaining the visible transcript. Subsequent replies continue that new chain.

The Running coach stores a user-owned goal profile and a dated plan for each week. `get_running_coach_context` reads up to 84 days of saved individual runs, eight weekly totals, 14 days of recovery data, current race records, and nearby saved plans. Missing logs are marked as missing evidence. Profile and plan changes use conversation-bound drafts; `confirm_running_coach_draft` checks the signed-in owner and Running conversation and saves only after explicit confirmation. A run can be imported without an invented calorie value.

The Chief of Staff has its own conversation and response chain. Its brief reads the signed-in user's saved 7-day running and nutrition totals, strength plan status, and a bounded current-week running plan focus and mileage. It can receive up to 600 characters from Strength and Nutrition's latest assistant messages. Running health limits and chat text remain in the Running conversation. It does not receive specialist write tools or whole transcripts. The brief marks calendar, tasks, email, finance, and relationships as unavailable. Its advice is planning in conversation, not a persisted task or calendar action.

On 2026-09-28, the production Supabase project accepted migrations `20260928163710_save_logged_meal_as_saved` and `20260928163717_chief_of_staff_domain`. A read-only verification confirmed the meal function and Chief of Staff domain constraint. Application rollout and chat smoke verification must be recorded after publication.
