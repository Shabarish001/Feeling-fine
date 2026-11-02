# FEELING FIND — Full Project Documentation

> **Adaptive Clothing Discovery Platform**
> 2026 Macromedia Hackathon — Next.js 16 / React 19 / Claude AI / Supabase / Google Maps

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Frontend (FE)](#4-frontend-fe)
5. [Backend (BE)](#5-backend-be)
6. [Database (DB)](#6-database-db)
7. [Authentication Flow](#7-authentication-flow)
8. [AI Integration](#8-ai-integration)
9. [Maps Integration](#9-maps-integration)
10. [File Storage](#10-file-storage)
11. [Environment Variables](#11-environment-variables)
12. [How to Run](#12-how-to-run)
13. [Deployment](#13-deployment)

---

## 1. Project Overview

FEELING FIND helps disabled people and their carers find adaptive clothing by describing what they need in natural language. The app uses Claude AI to understand requests, searches a clothing catalogue, and displays matching shops on an interactive Google Map.

### Key Features

| Feature | Description |
|---|---|
| Conversational search | Users type what they need; Claude AI interprets and searches |
| Map visualization | Results shown as numbered pins on Google Maps |
| User profiles | Save disability/accessibility needs for personalized results |
| File storage | Upload reference photos, size charts (private, per-user) |
| Demo mode | Works without any API keys using sample data |
| Accessibility | WCAG-compliant (focus states, skip links, ARIA, keyboard nav) |

### Pages

| Page | Route | Key Files |
|---|---|---|
| Homepage (chat entry) | `/` | `app/page.js` |
| Search results + map | `/search?q=...` | `components/SearchView.js`, `components/MapPanel.js` |
| About | `/about` | `app/about/page.js` |
| My Profile | `/profile` | `app/profile/page.js`, `components/ProfileForm.js`, `components/FileManager.js` |
| Sign In | `/login` | `components/AuthForm.js` |
| Create Account | `/signup` | `components/AuthForm.js` |

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.4.4 | Full-stack React framework |
| UI | React | 19.3.1 | Component rendering |
| AI | Anthropic SDK | 0.68.0 | Claude AI chat + tool use |
| Database & Auth | Supabase (SSR) | 0.7.0 / 2.58.0 | Postgres DB, auth, file storage |
| Maps | @vis.gl/react-google-maps | 1.5.0 | Google Maps with React |
| Styling | Plain CSS (no framework) | — | Custom papyrus design system |

---

## 3. Folder Structure

```
feeling-find/
├── app/                        # Next.js App Router pages & API
│   ├── layout.js               # Root layout (header + main)
│   ├── page.js                 # Homepage — chat entry point
│   ├── globals.css             # All styles (papyrus design system)
│   ├── about/page.js           # About page
│   ├── login/page.js           # Sign-in page
│   ├── signup/page.js          # Create account page
│   ├── profile/page.js         # User profile (protected)
│   ├── auth/
│   │   ├── actions.js          # Server actions: signIn, signUp, signOut, updateProfile
│   │   └── callback/route.js   # Email confirmation redirect handler
│   └── api/
│       └── chat/route.js       # POST /api/chat — Claude AI endpoint
│
├── components/                 # Reusable React components
│   ├── Header.js               # Site header with nav + auth (server component)
│   ├── NavLink.js              # Active-state nav link
│   ├── AuthForm.js             # Login/signup form
│   ├── Composer.js             # Chat input box (auto-grow textarea)
│   ├── SearchView.js           # Chat + map layout, API communication
│   ├── MapPanel.js             # Google Maps, pins, detail card, category tabs
│   ├── MessageText.js          # Markdown-like message formatter
│   ├── ProfileForm.js          # Profile editor with needs checkboxes
│   └── FileManager.js          # File upload/view/delete manager
│
├── lib/                        # Shared utilities
│   ├── items.js                # Keyword search engine for clothing items
│   └── supabase/
│       ├── config.js           # Reads env vars, exports isSupabaseConfigured
│       ├── client.js           # Browser-side Supabase client
│       └── server.js           # Server-side Supabase client (cookie sessions)
│
├── data/
│   └── sample-items.js         # 14 fictional adaptive clothing items
│
├── scripts/
│   └── make-seed-sql.mjs       # Generates seed.sql from sample-items.js
│
├── supabase/
│   ├── schema.sql              # Database tables + RLS policies
│   └── seed.sql                # Sample data INSERT statements
│
├── public/
│   └── logo.svg                # FEELING FIND logo
│
├── proxy.js                    # Next.js middleware (session refresh + auth guard)
├── next.config.mjs             # Next.js config (strict mode)
├── jsconfig.json               # Path alias: @/ → root
├── package.json                # Dependencies & scripts
├── .env.example                # Template for environment variables
└── .gitignore                  # Ignores node_modules, .next, .env, .env.local
```

---

## 4. Frontend (FE)

### 4.1 Design System (`app/globals.css`)

The entire UI uses a custom **papyrus paper palette** defined in CSS variables:

```css
:root {
  --papyrus-50:  #fbf7ee;   /* cards, inputs */
  --papyrus-100: #f4ebd9;   /* page background */
  --papyrus-200: #eadcc2;   /* soft fills */
  --papyrus-300: #d9c39d;   /* borders */
  --papyrus-500: #a68a5b;   /* muted details */
  --ink:         #3b2f22;   /* main text */
  --ink-soft:    #66533f;   /* secondary text */
  --accent:      #8c4a2f;   /* buttons, links (sienna) */
  --accent-hover:#6f3a24;
}
```

- **Typography:** Palatino Linotype for headings, system-ui for body
- **Background:** Subtle paper grain effect using radial gradients
- **Components styled:** buttons, forms, cards, alerts, tags, chat bubbles, map pins, detail cards
- **Responsive:** Mobile-first with breakpoints for layout changes

### 4.2 Root Layout (`app/layout.js`)

```
<html>
  <body>
    <skip-link />        ← accessibility: skip to main content
    <Header />           ← server component with nav + auth
    <main>{children}</main>
  </body>
</html>
```

### 4.3 Homepage (`app/page.js`) — Client Component

- Hero section with logo and heading
- `<Composer>` chat input box — submitting navigates to `/search?q=...`
- 4 suggestion buttons for quick searches:
  - "Shirts I can close with one hand"
  - "Trousers that are comfy in a wheelchair"
  - "Shoes that fit over my leg braces"
  - "Soft, tag-free clothes for sensory needs"

### 4.4 Search Results (`components/SearchView.js`) — Client Component

Split layout: **chat on the left**, **map on the right**.

**Chat side:**
- Reads `?q=` from URL and auto-sends on mount
- Messages stored in state and sent to `POST /api/chat`
- Shows typing indicator (3 animated dots) while loading
- Auto-scrolls to latest message
- `<Composer>` at bottom for follow-up questions

**Map side:**
- `<MapPanel>` receives items array from API responses
- Updates as new items come in from conversation

### 4.5 Map Panel (`components/MapPanel.js`) — Client Component

**With Google Maps API key:**
- Full interactive Google Map with `<AdvancedMarker>` numbered pins
- `<FitToItems>` auto-zooms/pans to show all pins
- Clicking a pin opens its detail card

**Without API key (demo mode):**
- `<SketchMap>` — CSS-drawn grid with positioned pin buttons

**Shared features:**
- Category filter tabs (All, Tops, Bottoms, Footwear, etc.)
- Result strip below map with clickable item chips
- Detail card with:
  - Product image (or placeholder icon)
  - Name, brand, category, rating (stars), price
  - Adaptive features as tags
  - Description
  - Store name + address
  - "Get directions" link (Google Maps directions URL)
  - "View product" link
  - Previous/Next navigation arrows

### 4.6 Message Formatter (`components/MessageText.js`)

Parses assistant replies with safe formatting (no raw HTML):
- `**bold text**` → `<strong>`
- Lines starting with `- ` → `<ul><li>` bullet lists
- Paragraphs separated by blank lines → `<p>` tags
- Headings (`# ...`) stripped to plain text

### 4.7 Auth Form (`components/AuthForm.js`) — Client Component

Shared between `/login` and `/signup` via `mode` prop:
- **Login:** email + password
- **Signup:** name + email + password + confirm password (min 8 chars)
- Shows error/success alerts from server actions
- "Please wait..." disabled state during submission
- Links between login ↔ signup pages

### 4.8 Profile Form (`components/ProfileForm.js`) — Client Component

Fields:
- Name, Gender (dropdown), Age, City, Country
- **Disability/needs checkboxes:** Wheelchair user, Limited hand movement, Limited arm movement, Prosthesis/limb difference, Leg braces, Sensory sensitivity, Low vision, Medical device, Chronic pain, Other
- Free-text "Anything else we should know?"
- Consent checkbox: "Use my needs to personalise my search results"

### 4.9 File Manager (`components/FileManager.js`) — Client Component

- Upload button (JPG, PNG, WebP, PDF — max 10 MB)
- File list with name, date, size
- View button → opens signed URL (valid 60 seconds) in new tab
- Delete button with confirmation dialog
- Files stored in private Supabase Storage bucket at `<userId>/<filename>`

### 4.10 Header (`components/Header.js`) — Server Component

```
[Logo] FEELING FIND     [Find clothes] [About] [Create Account / Sign Out] [Avatar → My Profile / Sign In]
```

- Fetches current user session from Supabase (server-side)
- Shows user's initial in a circle avatar when signed in
- Responsive: hides some text on mobile

---

## 5. Backend (BE)

### 5.1 API Route: `POST /api/chat` (`app/api/chat/route.js`)

The core endpoint powering the conversational search.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "I need a warm coat with easy zips" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "Do you have anything in Berlin?" }
  ]
}
```

**Response:**
```json
{
  "reply": "Here are some great options...",
  "items": [
    { "id": "...", "name": "...", "lat": 52.52, "lng": 13.41, ... }
  ]
}
```

**Flow (with API key):**
1. Clean & validate messages (max 20 messages, max 2000 chars each)
2. Fetch user's consented profile data (city, needs) if logged in
3. Build system prompt with user context
4. Send to Claude API with `search_clothing_items` tool
5. If Claude calls the tool → run keyword search → return results → let Claude respond
6. Loop up to 4 times (Claude may search multiple times)
7. Return final text reply + all found items

**Flow (demo mode — no API key):**
1. Take last user message as keywords
2. Run keyword search against sample data
3. Return canned reply with item list

**Limits:**
- Max 20 messages per conversation
- Max 2000 characters per message
- Max 4 tool-use loops per request
- Max 1024 tokens in Claude's response

### 5.2 Server Actions (`app/auth/actions.js`)

| Action | Purpose | Validation |
|---|---|---|
| `signIn()` | Email/password login | Redirects to profile or custom `next` URL |
| `signUp()` | Create account | Password ≥ 8 chars, passwords must match |
| `signOut()` | End session | Clears cookies, redirects to `/` |
| `updateProfile()` | Save profile data | Age 13–120, field length limits, RLS enforced |

All actions return `{ error }` or `{ message }` for UI feedback.

### 5.3 Middleware (`proxy.js`)

Runs before every page request:
1. **Session refresh:** Keeps Supabase auth cookies alive
2. **Auth guard:** Redirects unauthenticated users from `/profile` to `/login?next=/profile`

Skips static assets (images, fonts, etc.).

### 5.4 Search Engine (`lib/items.js`)

```
searchItems({ keywords, category, city, limit })
```

1. Load items from Supabase `clothing_items` table (falls back to sample data)
2. Normalize keywords to array, split on whitespace/commas/hyphens
3. Remove stop words (common words like "the", "for", "need")
4. Score each item by counting keyword matches across: name, brand, category, description, adaptive_features
5. Filter by category and city if provided
6. Sort by score (desc), then rating (desc)
7. Return top N results (default 10)

### 5.5 Email Confirmation Callback (`app/auth/callback/route.js`)

Handles the link from Supabase's "confirm your email" message:
- Exchanges confirmation code for a session
- Redirects to `/profile` on success
- Redirects to `/login?error=confirm` on failure

---

## 6. Database (DB)

### 6.1 Tables (Supabase / PostgreSQL)

#### `profiles`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Matches `auth.users.id` |
| full_name | text | |
| gender | text | |
| age | integer | 13–120 |
| city | text | |
| country | text | |
| needs | text[] | Array of disability categories |
| disability_info | text | Free-text description |
| use_needs_in_chat | boolean | Consent flag for personalization |
| updated_at | timestamptz | |

**Auto-created** via a database trigger when a user signs up.

#### `user_files`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Auto-generated |
| user_id | uuid (FK) | References `auth.users.id` |
| file_name | text | Original filename |
| storage_path | text | Path in Storage bucket |
| mime_type | text | image/jpeg, application/pdf, etc. |
| size_bytes | bigint | |
| uploaded_at | timestamptz | Default: now() |

#### `clothing_items`

| Column | Type | Notes |
|---|---|---|
| id | text (PK) | e.g. "magnetic-oxford-shirt" |
| name | text | Product name |
| brand | text | |
| category | text | Tops, Bottoms, Footwear, Outerwear, Underwear, Accessories |
| adaptive_features | text[] | e.g. ["magnetic buttons", "seated cut"] |
| description | text | |
| price | numeric | |
| currency | text | Default: EUR |
| store_name | text | |
| address | text | Full street address |
| city | text | |
| country | text | |
| lat | numeric | Latitude |
| lng | numeric | Longitude |
| rating | numeric | 0–5 |
| image_url | text | Optional product image |
| product_url | text | Optional link to product page |

### 6.2 Row Level Security (RLS)

Every table has RLS enabled:

| Table | Policy | Rule |
|---|---|---|
| profiles | Select own | `auth.uid() = id` |
| profiles | Update own | `auth.uid() = id` |
| profiles | Insert own | `auth.uid() = id` |
| user_files | Select own | `auth.uid() = user_id` |
| user_files | Insert own | `auth.uid() = user_id` |
| user_files | Delete own | `auth.uid() = user_id` |
| clothing_items | Select all | `true` (public read) |
| clothing_items | No insert/update/delete | Managed via Supabase dashboard only |

### 6.3 Storage

- **Bucket:** `user-files` (private)
- **Structure:** `<user_id>/<timestamp>-<filename>`
- **Accepted types:** JPG, PNG, WebP, PDF
- **Max size:** 10 MB per file
- **RLS:** Users can only access files in their own `<user_id>/` folder
- **Access:** Via signed URLs (valid 60 seconds)

### 6.4 Sample Data

14 fictional adaptive clothing items across Berlin, Hamburg, and Munich. Brands include EasyWear Studio, Rollmode, StepFree, Calm Cotton, OpenLine, DryRoll, Gentle Form, LimbLine, ClearSight.

Categories: Tops (4), Bottoms (3), Footwear (3), Outerwear (2), Underwear (1), Accessories (1)

To regenerate `seed.sql` after editing `data/sample-items.js`:
```bash
node scripts/make-seed-sql.mjs
```

---

## 7. Authentication Flow

```
User clicks "Create Account"
  → /signup page (AuthForm mode="signup")
  → signUp() server action
  → Supabase creates user + sends confirmation email
  → Email link → /auth/callback → exchanges code → redirects to /profile
  → Profile auto-created by DB trigger

User clicks "Sign In"
  → /login page (AuthForm mode="login")
  → signIn() server action
  → Supabase verifies credentials
  → Session stored in cookies
  → Redirects to /profile (or custom next URL)

Every page request
  → proxy.js middleware
  → Refreshes Supabase session cookies
  → Redirects /profile to /login if not authenticated

User clicks "Sign Out"
  → signOut() server action
  → Clears session
  → Redirects to /
```

---

## 8. AI Integration

### System Prompt

Claude is instructed to:
- Use warm, simple language with short sentences
- Call `search_clothing_items` for any clothing request
- Refer to results as #1, #2 (matching map pin numbers)
- Recommend 2–4 matches with a one-line explanation each
- Ask follow-up questions if no match is found
- Never give medical advice
- Format with bullets and bold, no headings or tables

### Tool: `search_clothing_items`

```json
{
  "keywords": ["magnetic", "shirt"],
  "category": "Tops",
  "city": "Berlin"
}
```

Only `keywords` is required. Claude can call this tool multiple times in one conversation to refine results.

### Personalization

If the user is signed in AND has checked "Use my needs to personalise my search results":
- Claude sees their city, country, needs categories, and free-text disability info
- Claude prefers shops in the user's city

If signed in but consent not given:
- Claude only sees city and country (for location preference)

---

## 9. Maps Integration

### With Google Maps API Key

- Uses `@vis.gl/react-google-maps` library
- `<APIProvider>` wraps the map with the API key
- `<Map>` component centered on Berlin (default)
- `<AdvancedMarker>` for each item with numbered pins
- `<FitToItems>` custom component auto-zooms to show all pins and pans to selected pin
- Custom pin styling with active state highlighting

### Without API Key (Demo Mode)

- `<SketchMap>` component renders a paper-grid background
- Pins positioned using relative lat/lng calculations
- Clickable to select items
- Shows "add a Google Maps key to see the real map" notice

### Directions

Each detail card has a "Get directions" button linking to:
```
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

---

## 10. File Storage

### Upload Flow
1. User clicks "Upload a file" → hidden `<input type="file">` opens
2. Client validates: file type (JPG/PNG/WebP/PDF) and size (≤ 10 MB)
3. File uploaded to Supabase Storage: `user-files/<userId>/<timestamp>-<filename>`
4. Metadata row inserted into `user_files` table
5. If DB insert fails, uploaded file is cleaned up from Storage

### View Flow
1. Client requests a signed URL from Supabase (valid 60 seconds)
2. Opens in a new browser tab

### Delete Flow
1. Confirmation dialog shown
2. File removed from Storage bucket
3. Metadata row deleted from `user_files` table

---

## 11. Environment Variables

| Variable | Required | Used By | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No | Server only | Claude AI API key |
| `ANTHROPIC_MODEL` | No | Server only | Model name (default: `claude-sonnet-5-5`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Client | Google Maps JavaScript API key |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | No | Client | Google Map ID (default: `DEMO_MAP_ID`) |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Both | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Both | Supabase publishable/anon key |
| `NEXT_PUBLIC_SITE_URL` | No | Server | Site URL for email confirmation links |

**All keys are optional.** Missing keys activate demo mode for that feature.

---

## 12. How to Run

### Prerequisites
- Node.js 20+ (LTS)
- npm

### Quick Start (Demo Mode)
```bash
npm install
npm run dev
```
Open http://localhost:3000

### Full Setup
1. Copy `.env.example` to `.env.local`
2. Add your API keys (see Section 11)
3. For Supabase: run `supabase/schema.sql` then `supabase/seed.sql` in the SQL Editor
4. Restart: `npm run dev`

### Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start development server (http://localhost:3000) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `node scripts/make-seed-sql.mjs` | Regenerate seed.sql from sample data |

---

## 13. Deployment

### Vercel (Recommended)

1. Push to GitHub (`.env.local` is gitignored)
2. At vercel.com → Add New → Project → select the repo
3. Add all environment variables from `.env.local`
4. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL
5. Deploy

**Post-deploy:**
- Add Vercel URL to Google Maps key restrictions
- Add Vercel URL to Supabase Authentication → URL Configuration (Site URL + Redirect URLs)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                     │
│                                                          │
│  Homepage ──→ SearchView ──→ MapPanel                    │
│  (Composer)     (Chat)       (Google Maps / SketchMap)   │
│                   │            (DetailCard)               │
│                   │                                       │
│  ProfileForm   FileManager   AuthForm                    │
│      │              │            │                        │
└──────│──────────────│────────────│────────────────────────┘
       │              │            │
       ▼              ▼            ▼
┌──────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER                         │
│                                                          │
│  POST /api/chat ──→ Claude AI (Anthropic SDK)            │
│       │                  │                               │
│       │            search_clothing_items (tool)           │
│       │                  │                               │
│       ▼                  ▼                               │
│  lib/items.js ──→ searchItems()                          │
│                                                          │
│  Server Actions: signIn, signUp, signOut, updateProfile  │
│  Middleware: proxy.js (session refresh + auth guard)      │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                      SUPABASE                            │
│                                                          │
│  Auth ──→ Users, Sessions, Email Confirmation            │
│  Database ──→ profiles, user_files, clothing_items       │
│  Storage ──→ user-files bucket (private, per-user)       │
│  RLS ──→ Row-level security on all tables                │
└──────────────────────────────────────────────────────────┘
```
