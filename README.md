# FEELING FIND - https://feeling-fine.vercel.app/ (website-link)

A TripAdvisor-style finder for adaptive clothing. People describe what they need in a chat, Claude searches the clothing catalogue, and the results show up as numbered pins on a map with a detail card for each item.

**It runs straight away in demo mode.** Without any keys you get sample shops in Berlin, a keyword search instead of Claude, and a sketch map instead of Google Maps. Each key you add (steps 3–5) switches on the real feature.

| Page | Address | File |
|---|---|---|
| 1. Homepage (chat) | `/` | `app/page.js` |
| 2. Results map | `/search?q=...` | `components/SearchView.js`, `components/MapPanel.js` |
| 3. About | `/about` | `app/about/page.js` |
| 4. My Profile | `/profile` | `app/profile/page.js`, `components/ProfileForm.js`, `components/FileManager.js` |
| Sign In / Create an Account | `/login`, `/signup` | `components/AuthForm.js` |
| Header (logo + profile button) | every page | `components/Header.js` |

---

## 1. Install the tools (one time)

1. Install **Node.js** (the LTS version, 20 or newer) from <https://nodejs.org>.
2. Install **VS Code** from <https://code.visualstudio.com>.
3. Unzip this project, open the folder in VS Code, then open a terminal: **Terminal → New Terminal**.

## 2. Run the app

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The page updates when you save a file. Press `Ctrl + C` in the terminal to stop.

Before adding keys, copy `.env.example` to a new file named **`.env.local`**. All your keys go in there. After changing `.env.local`, stop the app and run `npm run dev` again.

## 3. Switch on Claude (the chat assistant)

1. Create an account at <https://console.anthropic.com>, add a little credit, and go to **API Keys → Create Key**.
2. Paste it into `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Optional: set `ANTHROPIC_MODEL=claude-haiku-5-5` for cheaper, faster replies during testing.

The key is only used on the server (`app/api/chat/route.js`), so visitors can never see it.

**How the chat works:** Claude gets a tool called `search_clothing_items`. When someone asks for clothes, Claude calls the tool with keywords, our code searches the database (`lib/items.js`), and Claude writes a friendly answer that refers to items as #1, #2… — the same numbers as the map pins. To change Claude's tone or rules, edit `systemPrompt()` in `app/api/chat/route.js`.

## 4. Switch on accounts, the database and file uploads (Supabase, free)

1. Create a free account at <https://supabase.com> and click **New project**.
2. Open **SQL Editor → New query**, paste everything from `supabase/schema.sql` and click **Run**. Then do the same with `supabase/seed.sql` to add the sample clothing items.
3. Open **Project Settings → API** (or **API Keys**). Copy the **Project URL** and the **publishable** key (older projects call it the **anon** key) into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000`.

> **Hackathon tip:** new accounts must confirm their email. To skip that while testing, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**.

### What the database contains

- `profiles` — name, gender, age, city, country, needs, "in your own words" notes, and a consent switch for personalising chat. Created automatically when someone signs up.
- `user_files` — file metadata: name, type, size and upload date.
- Storage bucket `user-files` (private) — the files themselves, stored as `<user id>/<file name>`.
- `clothing_items` — the catalogue shown on the map. **This is a placeholder design.** When you know what your data looks like, change this table (and `data/sample-items.js`). The map only needs `name`, `lat` and `lng`; everything else is optional.

### Security rules

Row Level Security is turned on for every table. Each user can only read and change **their own** profile, file records and storage folder. The clothing catalogue can be read by everyone but not edited from the website, so you manage it in the Supabase **Table Editor**. The publishable key is safe to put in a website because these rules protect the data.

## 5. Switch on the real map (Google Maps)

1. Go to <https://console.cloud.google.com>, create a project, and enable the **Maps JavaScript API**.
2. Google asks for a billing account, but there's a free monthly allowance that a hackathon demo won't come close to. Set a **budget alert** anyway (**Billing → Budgets & alerts**).
3. Go to **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict the key. Under *Application restrictions*, choose **Websites** and add `http://localhost:3000/*` (add your live site later). Under *API restrictions*, choose **Maps JavaScript API**.
5. Add it to `.env.local`:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
   ```

## 6. Put it online (free, with Vercel)

1. Push the project to GitHub. `.env.local` is already ignored, so your keys stay private.
2. At <https://vercel.com>, click **Add New → Project** and choose the repo.
3. Under **Environment Variables**, add every value from `.env.local`, and set `NEXT_PUBLIC_SITE_URL` to your Vercel address. Click **Deploy**.
4. Add the Vercel address to your Google Maps key restrictions and to Supabase under **Authentication → URL Configuration** (Site URL and Redirect URLs).

---

## Changing things

- **Colours:** the papyrus palette is at the top of `app/globals.css`.
- **Logo:** `public/logo.svg`.
- **Example searches on the homepage:** the `SUGGESTIONS` list in `app/page.js`.
- **Profile options:** the `GENDERS` and `NEEDS` lists in `components/ProfileForm.js`.
- **Sample items:** `data/sample-items.js`. Then run `node scripts/make-seed-sql.mjs` to regenerate `supabase/seed.sql`.

## A note on privacy

Disability information is sensitive personal data under GDPR. That's why the profile keeps it private, and Claude only sees it when the user ticks **"Use my needs to personalise my search results"**. If FEELING FIND grows beyond a hackathon, add a privacy policy and a "delete my account" option.
