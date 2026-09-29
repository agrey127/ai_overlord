# Assistant domain boundaries

Baseline's active chats use one shared accuracy and confirmation prompt plus a separate prompt for each domain. The prompt modules live in `lib/assistant/prompts`; `lib/assistant/domain-config.ts` selects the prompt and tools from the stored conversation domain. Each assistant reply records `prompt_version` in its message metadata.

| Chat | Model tools | Server-enforced data scope |
| --- | --- | --- |
| Strength | Coach profile, workout rotation, plans, sets, progress, shared structured goals | Strength-owned writes; read-only structured goals from other coaches |
| Running | Run totals, individual runs and recovery, goal and weekly-plan drafts, Garmin activity drafts, shared structured goals | Running-owned records and writes; read-only structured goals from other coaches |
| Nutrition | Meal totals, saved meals, meal drafts, shared structured goals | `meal_logs` totals and meal writes; read-only structured goals from other coaches |
| General | Totals, current workout | Limited information-only chat; no write tools |
| Chief of Staff | Dated, bounded cross-domain brief and shared structured goals | Read-only; Strength and Nutrition excerpts, plus a structured Running summary |

`lib/assistant/domain-policy.ts` is the server-side tool allowlist. `runAssistantTool` checks it before dispatch and confirms that a pending draft belongs to the current conversation. Adding a tool to a domain requires updating both the allowlist and the domain prompt. The model receives only the selected domain's tools, but prompt text by itself is never treated as an access control.

The specialist chats keep separate OpenAI response chains. Existing transcripts remain in Supabase and are not copied between chats. On the first reply after prompt version 5, each chat starts a clean model response chain while retaining its visible transcript. Subsequent replies continue that new chain.

Every Running, Strength, Nutrition, and Chief of Staff turn receives the same dated, read-only shared-goal summary from user-owned coaching profiles. It contains the Running goal type, race target and run frequency, plus the Strength goal type and weekly session range. Free-text descriptions, equipment, symptoms, training limits, and specialist chat messages are excluded. A missing Nutrition goal remains unknown until Nutrition coaching is built. The model can request the same structured summary with `get_shared_coaching_goals`; this does not grant any cross-domain write tool.

The Running coach stores a user-owned goal profile and a dated plan for each week. `get_running_coach_context` reads up to 84 days of saved individual runs, eight weekly totals, 14 days of recovery data, current race records, and nearby saved plans. Missing logs are marked as missing evidence. Profile and plan changes use conversation-bound drafts; `confirm_running_coach_draft` checks the signed-in owner and Running conversation and saves only after explicit confirmation. A run can be imported without an invented calorie value.

The Strength coach stores a user-owned goal profile with an objective, weekly session range, availability, preferred session length, equipment, and private limits. `get_strength_coach_context` reads that profile, the persistent rotation, current or next workout, recent sessions, 90-day role-specific exercise progress, and shared structured goals. Profile changes use conversation-bound confirmation drafts. The user's 2026-09-29 preference is to build strength cautiously, keep the existing four-workout rotation, and aim for four to five sessions a week during half-marathon training. Weekly Strength outlines are advice in chat; this phase does not add a separately saved Strength week-plan table.

The Chief of Staff has its own conversation and response chain. Its brief reads the signed-in user's saved 7-day running and nutrition totals, strength plan status, and a bounded current-week running plan focus and mileage. It can receive up to 600 characters from Strength and Nutrition's latest assistant messages. Running health limits and chat text remain in the Running conversation. It does not receive specialist write tools or whole transcripts. The brief marks calendar, tasks, email, finance, and relationships as unavailable. Its advice is planning in conversation, not a persisted task or calendar action.

On 2026-09-29, the production Supabase project accepted migration `20260929133953_strength_coach_profile`. Read-only checks confirmed RLS and owner policies on both new tables, no anon SELECT grant, and the saved four-to-five-session Strength profile. Simulated authenticated reads confirmed the owner can read the profile and another identity cannot. Application rollout and signed-in coach smoke verification must be recorded after publication.
