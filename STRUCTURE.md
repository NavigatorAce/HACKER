# Future Me — Project Structure

## Folder Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/login/           # Sign in / Sign up page
│   ├── api/                    # API routes
│   │   ├── auth/login/         # Supabase auth endpoint
│   │   ├── profile/            # GET load profile / POST save profile
│   │   ├── chat/               # POST send message → Gemini AI response
│   │   ├── sessions/           # GET list past sessions
│   │   └── sessions/[sessionId]/ # GET single session with answers
│   ├── profile/                # Current self profile builder
│   ├── ask/                    # Chat interface with Future Me
│   ├── history/                # Past conversation sessions
│   ├── layout.tsx              # Root layout with nav
│   ├── page.tsx                # Landing page
│   └── globals.css
├── components/
│   ├── layout/
│   │   └── AppNav.tsx          # Top navigation bar
│   └── ui/                     # Reusable UI components (shadcn-style)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── textarea.tsx
├── hooks/
│   └── useAuth.ts              # Auth state hook (user, session, profile)
├── lib/
│   ├── gemini/                 # Gemini AI integration
│   │   ├── client.ts           # GoogleGenerativeAI client + model config
│   │   └── prompts.ts          # Future Me system prompt (profile-aware, personality-driven)
│   ├── supabase/               # Supabase clients
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client (cookies-based)
│   │   └── middleware.ts       # Auth middleware helper
│   ├── validations/
│   │   └── schemas.ts          # Zod schemas for API input validation
│   ├── utils/                  # Utility functions (cn(), etc.)
│   └── mock-store.ts           # In-memory store when Supabase not configured
├── services/                   # Business logic / DB operations
│   ├── profile.ts              # Profile CRUD (getProfileByUserId, upsertProfile)
│   ├── branches.ts             # Branches CRUD (legacy, kept for compat)
│   ├── dialogue.ts             # Sessions + answers CRUD
│   └── ai.ts                   # Legacy AI service (mock-only, kept for compat)
├── middleware.ts                # Next.js middleware (auth redirect)
└── types/
    ├── index.ts                # Domain types (CurrentSelfProfile, LifeStage, etc.)
    └── database.types.ts       # Supabase DB types (hand-written)

supabase/
└── migrations/                 # SQL migrations (run in order)
    ├── 001_initial_schema.sql
    ├── 002_handle_new_user_profile.sql
    ├── 003_fix_profiles_table.sql
    ├── 005_profile_name_status_study_work.sql
    ├── 006_current_self_profiles.sql
    └── 007_rename_profile_name_to_gender.sql
```

## Key Data Flow

```
User signs up → Supabase auth → auto-creates profile row (trigger)
User fills profile → POST /api/profile → upsert to DB → redirect to /ask
User opens /ask → GET /api/profile → load profile into system prompt
User sends message → POST /api/chat → build Gemini prompt with profile → Gemini API → response
```

## What Is Mocked vs Wired

| Feature | Without env keys | With Supabase + Gemini |
|---------|-----------------|------------------------|
| Auth | Login simulates success, redirects to /profile | Supabase sign in / sign up |
| Profile | Stored in memory (lost on restart) | Stored in `profiles` table |
| Chat | Mock reply (fixed text) | Gemini 3 Flash generates personality-driven response |
| History | In-memory sessions | Fetched from DB |

- **Mock mode**: No `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → all data in `mockStore` (server memory).
- **Gemini**: No `GEMINI_API_KEY` → chat returns fixed mock responses.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL. Without it, app uses in-memory mock store. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon/public key. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key. Without it, chat uses mock responses. |

## Run Locally

```bash
cp .env.example .env.local
# Edit .env.local if you have Supabase / Gemini keys
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Without any keys, you can still complete the flow with mock data and mock AI responses.
