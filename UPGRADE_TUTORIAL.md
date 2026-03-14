# Branch Self — Step-by-Step Upgrade Tutorial

Staged implementation guide. Follow steps in order. Each step lists only the dependencies needed for that step.

---

## Step 1 — Request validation foundation

**Goal:**
- Validate API request bodies for `POST /api/profile`, `POST /api/ask`, and `POST /api/chat` using Zod.
- Reject invalid or malformed payloads with a clear 400 response.
- Optionally validate critical env vars only if you have a concrete need (e.g. failing fast on missing `GEMINI_API_KEY` in production). For MVP, env checks in route handlers are usually enough.

**Why this step comes now:**
- Backend correctness and security come first. Validation prevents bad data from reaching Supabase or Gemini and gives predictable error messages before you add multi-profile and more flows.

**Files to inspect:**
- `src/app/api/profile/route.ts` — current POST body handling.
- `src/app/api/ask/route.ts` — current POST body handling.
- `src/app/api/chat/route.ts` — current POST body handling.
- `src/types/index.ts` — `LifeStage`, `CurrentSelfProfile`, and related types so schemas stay in sync.

**Files to change:**
- `package.json` — add `zod` (if not already present).
- **New:** `src/lib/validations/schemas.ts` — Zod schemas for profile POST, ask POST, chat POST.
- `src/app/api/profile/route.ts` — parse body, run profile schema, return 400 on failure, then use parsed data.
- `src/app/api/ask/route.ts` — parse body, run ask schema, return 400 on failure, then use parsed data.
- `src/app/api/chat/route.ts` — parse body, run chat schema, return 400 on failure, then use parsed data.

**Dependencies needed in this step:**  
- `zod` only.

**Install command for this step:**  
- If `zod` is not in `package.json`:  
  `npm install zod`  
- If `zod` is already installed and the three routes already use schemas from `src/lib/validations/schemas.ts`: **No install needed.**

**Implementation details:**
1. **Schemas (in `src/lib/validations/schemas.ts`):**
   - **Profile POST:** Object with `age` (number, optional default 30, e.g. 16–120), `lifeStage` (enum of existing `LifeStage` values, default `"exploring"`), `personalityTraits` (array of strings, optional default `[]`), `goals`, `fears`, `currentStruggles` (strings, optional default `""`), `additionalContext` (optional string). Add reasonable max lengths (e.g. 10_000 for text, 50 for array length) to avoid abuse.
   - **Ask POST:** Object with `question` (non-empty string, max length e.g. 2000).
   - **Chat POST:** Object with `messages` (array of `{ role: "user" | "assistant", content: string }`, min 1, max e.g. 50), `yearsAhead` (optional number, e.g. 1–60, default 10). Use `z.coerce.number()` for `yearsAhead` if the client might send a string.
2. **In each of the three route files:**
   - Wrap `await request.json()` in try/catch; on throw return `NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })`.
   - Run the corresponding schema with `.safeParse(body)`.
   - If `!parsed.success`, return 400 with a single error message (e.g. first entry from `parsed.error.flatten().formErrors` or a generic "Validation failed").
   - Use `parsed.data` for the rest of the handler (no raw `body`).
3. **Env validation:** Skip for this step unless you explicitly want the app to fail fast at startup when keys are missing. Route-level checks (e.g. `USE_MOCK`, `USE_SUPABASE`) are enough for MVP.

**What to test after this step:**
- POST to `/api/profile` with invalid body (e.g. `age: "not a number"`, or missing required fields if you made any required) → 400 and error message.
- POST to `/api/ask` with `{}` or `{ question: "" }` → 400.
- POST to `/api/chat` with `{ messages: [] }` or invalid `messages` → 400.
- Valid payloads for all three still succeed and behave as before.

**Definition of done:**
- `zod` is in dependencies (if you added it).
- `src/lib/validations/schemas.ts` exists and exports profile, ask, and chat schemas aligned with `src/types`.
- All three API routes parse JSON, validate with the correct schema, return 400 on invalid input, and use the parsed result for business logic.

---

## Step 2 — Multi-profile database support

**Goal:**
- Allow multiple profiles per user (remove one-profile-per-user constraint).
- Add profile naming so users can distinguish profiles (e.g. "Work", "Personal").
- Update schema, RLS, and any types so the rest of the app can work with multiple profiles per user.

**Why this step comes now:**
- Validation is in place (Step 1). Multi-profile is a schema and data-layer change; doing it before refactoring /profile and /ask keeps those refactors consistent with the final data model.

**Files to inspect:**
- `supabase/migrations/001_initial_schema.sql` — current `profiles` table and RLS.
- `supabase/migrations/002_handle_new_user_profile.sql` — trigger that creates a profile on signup.
- `src/services/profile.ts` — `getProfileByUserId`, `upsertProfile`, `ensureProfileForUser`; note they assume one profile per user today.
- `src/types/index.ts` — `CurrentSelfProfile` (has `userId`; you may add `name` or `slug`).

**Files to change:**
- **New migration:** e.g. `supabase/migrations/003_multi_profile.sql` — alter `profiles` and RLS; optionally adjust trigger.
- `src/types/index.ts` — add optional `name` (or `slug`) to profile type if not present.
- `src/services/profile.ts` — add functions: list profiles by user, get profile by id (with user check), create profile, update profile; adjust upsert/ensure semantics for multi-profile (e.g. ensure at least one default profile per user instead of exactly one row per user).

**Dependencies needed in this step:**  
No new dependencies. Use existing Supabase client and SQL.

**Install command for this step:**  
No install needed.

**Implementation details:**
1. **Migration 003 (multi-profile):**
   - Remove `UNIQUE(user_id)` from `profiles` so one user can have many profiles.
   - Add columns as needed, e.g. `name TEXT`, `is_default BOOLEAN DEFAULT false`, and optionally `slug` or similar. Ensure every user has at most one default (e.g. unique partial index on `(user_id)` where `is_default = true`).
   - Keep RLS: users can only access their own rows (`auth.uid() = user_id`). Adjust any policy that assumed a single row per user.
   - Optionally: in `handle_new_user`, insert one default profile (e.g. "Default" or "My profile") so new users have one profile to start with.
2. **Types:** Extend `CurrentSelfProfile` (or equivalent) with `name?: string` and `isDefault?: boolean` if you use them in the app.
3. **Profile service:** Implement `listProfilesByUserId(supabase, userId)`, `getProfileById(supabase, profileId, userId)` (or rely on RLS and fetch by id), `createProfile`, `updateProfile`. Decide how `ensureProfileForUser` works: e.g. create a default profile if the user has none. Keep `getProfileByUserId` for “default” profile only if you have `is_default`, or deprecate it in favor of “get default profile for user” and “get profile by id”.

**What to test after this step:**
- Run migration in Supabase (SQL Editor or CLI). Confirm no errors.
- From app or SQL: create a second profile for a user; list profiles for that user; confirm RLS blocks access to other users’ profiles.

**Definition of done:**
- Migration applied; multiple profiles per user are possible; profile naming (and optionally default) is in place.
- Types and profile service support listing and selecting profiles by id and user.

---

## Step 3 — Refactor /profile flow

**Goal:**
- Allow creating and editing **named** profiles (using the new multi-profile schema).
- After “Save and continue”, redirect to `/ask?profileId=<id>` so the next step can use the selected (or newly created) profile.

**Why this step comes now:**
- Step 2 gives the DB and service layer for multiple profiles. This step wires the profile UI to that layer and sets the transition to /ask with a chosen profile.

**Files to inspect:**
- `src/app/profile/page.tsx` — current single-profile form and submit.
- `src/app/api/profile/route.ts` — GET (current user’s profile) and POST (upsert). You may need GET to return a list or a default, and POST to create or update by profile id.
- `src/services/profile.ts` — list/create/update APIs you added in Step 2.

**Files to change:**
- `src/app/api/profile/route.ts` — extend GET to return either a list of profiles or the default profile; extend POST to accept optional `profileId` and `name`, and create or update accordingly; validate body with existing (or updated) Zod schema.
- `src/app/profile/page.tsx` — add UI to choose “New profile” vs existing profile (e.g. dropdown or list); for new profile, collect name; on submit call API to create or update; on success redirect to `router.push(\`/ask?profileId=${profileId}\`)` (or similar). Keep UI minimal (e.g. name field, list of existing profiles).

**Dependencies needed in this step:**  
No new dependencies.

**Install command for this step:**  
No install needed.

**Implementation details:**
1. **API:**  
   - GET: Return `{ profiles: Profile[] }` or `{ profile: Profile }` for default, depending on whether you need a list on /profile. Ensure only the current user’s profiles are returned (RLS or filter by `auth.uid()`).  
   - POST: Accept `profileId` (optional), `name` (optional), plus existing profile fields. If `profileId` is provided and belongs to the user, update; otherwise create. Validate with Zod (extend profile schema with optional `profileId`, `name`). Return the saved profile including `id`.  
2. **Page:**  
   - Load existing profiles (e.g. from GET /api/profile or a new GET /api/profiles).  
   - If editing, prefill form with that profile’s data.  
   - On submit, POST with profile id (if editing) or without (if creating); include `name` if present.  
   - On success, redirect to `/ask?profileId=<id>` (use the id returned from POST).

**What to test after this step:**
- Create a new named profile; confirm it appears in the list and redirect to /ask with its `profileId` in the URL.
- Edit an existing profile; save; confirm redirect to /ask with that profile’s id.

**Definition of done:**
- User can create and edit named profiles; after save they are redirected to `/ask?profileId=...` with the correct id.

---

## Step 4 — Refactor /ask flow

**Goal:**
- Read `profileId` from the URL (e.g. `searchParams.profileId`).
- Load the selected profile (and its branches if needed); if `profileId` is missing or invalid, fall back to default profile or show a message.
- Allow switching between profiles (e.g. dropdown) without leaving /ask.
- Ensure the selected profile (and its id) is passed to the backend when calling the ask/chat API.

**Why this step comes now:**
- Step 3 sends users to `/ask?profileId=...`. This step makes /ask consume that param, load the right profile, and send it to the API so Step 5 can use it server-side.

**Files to inspect:**
- `src/app/ask/page.tsx` — current state and submit flow; no profileId in URL today.
- `src/app/api/ask/route.ts` — currently gets profile by current user (single profile). Will be updated in Step 5 to accept profileId.
- `src/app/api/profile/route.ts` or GET endpoint that returns profile(s) — to load profile by id for the selected user.

**Files to change:**
- `src/app/ask/page.tsx` — read `profileId` from `useSearchParams()`; fetch profile (and branches if needed) for that id; show a profile selector (dropdown or list) that updates the URL or state with the chosen profile id; when calling the ask API, send the selected `profileId` in the request body (or use it in the URL if you change the API to a query param). Handle “no profile” / invalid id by redirecting to /profile or showing “Please select or create a profile”.

**Dependencies needed in this step:**  
No new dependencies.

**Install command for this step:**  
No install needed.

**Implementation details:**
1. On load, read `searchParams.get("profileId")`. If present, fetch that profile (e.g. GET `/api/profile?profileId=...` or GET `/api/profiles/<id>`). If not present, fetch default profile or first profile for the user.
2. Store selected profile id in state (and optionally sync to URL with `router.replace` or link so refreshing keeps the selection).
3. Profile switcher: dropdown or buttons that set the selected profile id (and optionally update the URL). Re-fetch branches for the new profile if needed for display.
4. When the user submits a question, call the ask API with the selected `profileId` (e.g. in the request body: `{ question, profileId }`). The API will be updated in Step 5 to use this.

**What to test after this step:**
- Open `/ask?profileId=<valid-id>`; confirm the correct profile and its branches load; submitting a question sends that `profileId` in the request.
- Change profile in the UI; confirm the next request uses the new profile id.
- Open `/ask` without profileId; confirm fallback to default or redirect to profile selection.

**Definition of done:**
- /ask reads profileId from URL and loads that profile; user can switch profiles; selected profileId is sent to the ask API.

---

## Step 5 — Replace /api/ask mock with Gemini

**Goal:**
- Make `POST /api/ask` use the **selected profile** (by profileId) and call **Gemini** server-side to generate answers for each branch, instead of using mock responses from `services/ai.ts`.
- Keep Gemini as the only AI path; no OpenAI.

**Why this step comes now:**
- Steps 2–4 give multi-profile and profile selection; /ask already sends profileId. This step wires the ask API to Gemini and the selected profile so “ask” is real AI, not mock.

**Files to inspect:**
- `src/app/api/ask/route.ts` — currently uses `generateAnswerForBranch` from `services/ai.ts` (mock).
- `src/app/api/chat/route.ts` — reference implementation for calling Gemini (model, system prompt, etc.).
- `src/lib/gemini/client.ts` — Gemini client and model name.
- `src/lib/gemini/prompts.ts` — how system prompts are built from profile (for chat). You may reuse or adapt for “future self” per branch.
- `src/services/ai.ts` — mock logic to replace with Gemini calls.

**Files to change:**
- `src/app/api/ask/route.ts` — accept `profileId` in the validated body (add to ask schema in `src/lib/validations/schemas.ts`). Resolve profile by id (and ensure it belongs to the current user via RLS or explicit check). Load branches for that profile. For each branch, call Gemini (or a new helper in `src/lib/gemini/` or `src/services/`) to generate the answer for that branch + question; collect answers and save session as today. Remove dependency on mock `generateAnswerForBranch`.
- `src/lib/validations/schemas.ts` — add optional `profileId` to ask schema if you pass it from the client.
- New or existing Gemini helper: e.g. a function that takes profile, branch, question and returns one answer string using the same Gemini client and a per-branch prompt (can be similar to chat’s “future me” but scoped to that branch). Use `src/lib/gemini/client.ts` and keep prompts in `src/lib/gemini/prompts.ts` or a new file under `lib/gemini/`.
- Optionally refactor `src/services/ai.ts`: remove or replace mock implementation with a thin wrapper that calls the Gemini helper, so existing call sites that expect `generateAnswerForBranch(question, branch, profile)` can stay or be updated to the new flow.

**Dependencies needed in this step:**  
No new dependencies. Use existing `@google/generative-ai` (do not reinstall).

**Install command for this step:**  
No install needed.

**Implementation details:**
1. In `/api/ask`: After auth, parse body (Zod) including `profileId`. Get profile by id; verify ownership (user’s profile). Load branches for that profile. If no branches, return 400 (user must generate branches first or you create them on first ask).
2. For each branch, call Gemini with: profile + branch + question → one answer string. Reuse or duplicate the “future me” prompt logic from chat so each branch’s answer is in character. Use the same API key and client as `/api/chat`.
3. Create session and save answers as today (dialogue_sessions, branch_answers). Return session id.
4. Remove or bypass mock in `services/ai.ts` for the ask flow so that all answers come from Gemini when `GEMINI_API_KEY` is set; if you still want a mock for development, gate it on missing key and call Gemini when key is present.

**What to test after this step:**
- With `GEMINI_API_KEY` set, submit a question from /ask with a selected profile; confirm answers are from Gemini and saved; no mock text.
- Without key (if you kept a mock fallback), confirm graceful fallback.

**Definition of done:**
- /api/ask uses Gemini and the profile identified by profileId; mock is no longer used for the real ask flow; Gemini is the only AI path for ask.

---

## Step 6 — Baseline security

**Goal:**
- Enforce ownership: profileId and session id must belong to the current user (via Supabase auth and RLS or explicit checks).
- Verify auth on all relevant API routes (profile, ask, chat, sessions, branches).
- Apply prompt/content safety rules (e.g. max lengths, no arbitrary system prompt injection from client).
- Return safe, generic error messages to the client (no stack traces or internal details).

**Why this step comes now:**
- Multi-profile and Gemini are in place. Locking down ownership and errors reduces risk before adding rate limiting or more features.

**Files to inspect:**
- All `src/app/api/**/route.ts` — auth and ownership patterns.
- `src/lib/gemini/prompts.ts` — what is sent to Gemini (profile data, user content).
- `supabase/migrations/*.sql` — RLS policies on profiles, dialogue_sessions, branch_answers, future_branches.

**Files to change:**
- Each API route that uses profileId or sessionId: after resolving the entity, ensure it belongs to the current user (e.g. profile’s user_id === auth.uid(); session’s user_id === auth.uid()). Return 403 or 404 if not.
- Ensure no client-supplied text is used as system prompt; only server-built prompts (from profile/branch data and fixed templates) are sent to Gemini.
- Centralize error handling: in catch blocks, log the real error server-side, return `NextResponse.json({ error: "..." }, { status: 500 })` with a generic message (e.g. “Something went wrong”). Do not send `e.message` or stack to the client.

**Dependencies needed in this step:**  
No new dependencies.

**Install command for this step:**  
No install needed.

**Implementation details:**
1. **Ownership:** In profile GET/POST, ask POST, chat POST, sessions GET, branches GET: after fetching profile/session, check that `profile.userId === user.id` or `session.userId === user.id`. If using Supabase with RLS, reads will already be scoped; still validate any id coming from the client (e.g. profileId in ask) so the row exists and belongs to the user.
2. **Auth:** Every protected route should call `supabase.auth.getUser()` (or equivalent) and return 401 when there is no user (already in place in many routes; ensure consistency).
3. **Prompts:** Only build system instructions from server-side profile/branch data and fixed strings. Do not pass client-provided “system” or “instruction” fields to Gemini.
4. **Errors:** Use try/catch; in catch, `console.error` (or similar) with the real error; respond with a single generic message and appropriate status (400 for validation, 401 for auth, 403 for forbidden, 500 for server errors).

**What to test after this step:**
- Call ask/chat with another user’s profileId (if you can simulate); expect 403 or 404.
- Trigger a server error (e.g. invalid Gemini response); expect 500 with a generic message and no stack trace in the response.

**Definition of done:**
- All relevant routes enforce ownership and auth; prompts are server-only; errors are logged server-side and returned safely to the client.

---

## Step 7 — Basic rate limiting

**Goal:**
- Protect API routes from abuse with simple rate limiting.
- Prefer a no-dependency in-memory approach for MVP (single instance); recommend @upstash/ratelimit only if you need distributed limits (e.g. serverless/multi-instance).

**Why this step comes now:**
- Security baseline is done (Step 6). Rate limiting is the next hardening step and can be minimal for MVP.

**Files to inspect:**
- `src/app/api/chat/route.ts`, `src/app/api/ask/route.ts`, `src/app/api/profile/route.ts` — where to apply limits (e.g. per IP or per user id).
- Next.js middleware or route-level checks — decide whether to limit in middleware (one place) or inside each route.

**Files to change:**
- Either: a small in-memory store (e.g. Map or a simple module) keyed by IP or user id, with a window (e.g. 1 minute) and max requests (e.g. 10 per minute for chat/ask). Call this at the start of each protected route and return 429 when over limit.
- Or: if you need distributed rate limiting (e.g. Vercel serverless with multiple instances), add `@upstash/ratelimit` and `@upstash/redis` and implement the same window/limit per user or IP using Redis. Only add these deps if the in-memory approach is insufficient for your deployment.

**Dependencies needed in this step:**  
- For MVP (single instance): **No new dependencies.** Use a simple in-memory store (e.g. `Map`, with a cleanup for old entries if desired).  
- For distributed (multi-instance): `@upstash/ratelimit`, `@upstash/redis`.

**Install command for this step:**  
- In-memory: **No install needed.**  
- If you choose Upstash:  
  `npm install @upstash/ratelimit @upstash/redis`

**Implementation details:**
1. **In-memory (MVP):** Create a small module (e.g. `src/lib/rate-limit.ts`) that exports a function `checkRateLimit(key: string, limit: number, windowMs: number): boolean`. Use a Map keyed by `key` (e.g. `userId` or `ip`), store timestamps of requests, and prune older than `windowMs`; if count in window >= limit, return false. In each route, call this before processing; if false, return `NextResponse.json({ error: "Too many requests" }, { status: 429 })`.
2. **Upstash (if needed):** Use Upstash docs to create a limiter per route or a shared one with different limits per endpoint; call it at the start of the route and return 429 when limited.

**What to test after this step:**
- Send many requests in a short time; confirm 429 after the limit and that the counter resets after the window.

**Definition of done:**
- Chat, ask, and optionally profile POST are rate-limited; either in-memory (MVP) or via Upstash with no new deps beyond those two if you chose that path.

---

## Step 8 — Optional cleanup

**Goal:**
- Remove unused dependencies (e.g. openai, @radix-ui/react-dialog, @radix-ui/react-tabs, lucide-react if unused).
- Optionally align `@types/react` and `@types/react-dom` to ^18 to match React 18 and avoid peer warnings (and possibly drop `--legacy-peer-deps`).
- Update README and .env.example to describe Gemini (not OpenAI) and the current stack.

**Why this step comes now:**
- All feature and security steps are done. Cleanup avoids confusion and keeps the repo accurate for future work.

**Files to inspect:**
- `package.json` — list of dependencies.
- `README.md` — tech stack and env vars.
- `.env.example` — variable names and comments.

**Files to change:**
- `package.json` — remove unused packages; optionally change `@types/react` and `@types/react-dom` to `^18`.
- `README.md` — replace OpenAI with Gemini; document `GEMINI_API_KEY`; mention `npm install` (and `--legacy-peer-deps` only if still needed after type downgrade).
- `.env.example` — use `GEMINI_API_KEY` and remove or rename `OPENAI_API_KEY` if present.

**Dependencies needed in this step:**  
None (this step removes or adjusts existing deps).

**Install command for this step:**  
- To remove unused:  
  `npm uninstall openai @radix-ui/react-dialog @radix-ui/react-tabs lucide-react`  
  (only if you confirmed they are unused across the repo.)  
- To fix React types:  
  `npm install -D @types/react@^18 @types/react-dom@^18`

**Implementation details:**
1. Search the codebase for `openai`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `lucide-react`. If no imports remain, uninstall them.
2. If you want to align with React 18, install `@types/react@^18` and `@types/react-dom@^18`, then run `npm install` (without `--legacy-peer-deps`) to see if it succeeds.
3. In README, update the tech stack table and env section to Gemini and `GEMINI_API_KEY`. In .env.example, add `GEMINI_API_KEY` and remove or comment out `OPENAI_API_KEY`.

**What to test after this step:**
- `npm run build` and `npm run dev` succeed; no missing module errors; README and .env.example match the app.

**Definition of done:**
- Unused deps removed; types and README/env docs reflect the current stack (Next 14, React 18, Gemini, Supabase, Zod, etc.).

---

# Summary

## A. Full ordered step list

1. Request validation foundation (Zod for profile, ask, chat).
2. Multi-profile database support (migration, types, profile service).
3. Refactor /profile flow (create/edit named profiles, redirect to /ask?profileId=...).
4. Refactor /ask flow (read profileId from URL, load profile, switch profiles, pass profileId to API).
5. Replace /api/ask mock with Gemini (use selected profile, call Gemini, no OpenAI).
6. Baseline security (ownership, auth, prompt safety, safe errors).
7. Basic rate limiting (in-memory MVP or Upstash if needed).
8. Optional cleanup (remove unused deps, fix React types, update README and .env.example).

## B. Steps that require new dependencies

- **Step 1:** `zod` (only if not already in the project).
- **Step 7:** Optional — `@upstash/ratelimit` and `@upstash/redis` only if you choose distributed rate limiting; in-memory needs no new deps.
- **Step 8:** No new deps (only removals or version changes).

## C. Steps that require no new dependencies

- Step 2 (multi-profile DB).
- Step 3 (refactor /profile).
- Step 4 (refactor /ask).
- Step 5 (Gemini for /api/ask).
- Step 6 (baseline security).
- Step 7 if you use in-memory rate limiting.
- Step 8 (cleanup).

## D. Minimal install plan for MVP

- **Once, at the start:**  
  `npm install zod`  
  (skip if zod is already installed.)
- **Optional, only if you need distributed rate limiting:**  
  `npm install @upstash/ratelimit @upstash/redis`
- **Optional, during cleanup:**  
  `npm install -D @types/react@^18 @types/react-dom@^18`  
  and  
  `npm uninstall openai @radix-ui/react-dialog @radix-ui/react-tabs lucide-react`  
  (after confirming they are unused).

## E. Recommended safest starting step

- **Step 1 — Request validation foundation.**  
  It does not change product behavior (only rejects invalid input), adds a single dependency (zod) only if needed, and gives a stable base for all later steps. If zod and the three route validations are already in place, verify they match this step’s “Definition of done” and then move to Step 2.
