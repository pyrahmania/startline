# startline365 (beta)

Race-season planner. Pin the races you are targeting this year, then invite your crew.

**Live:** https://pyrahmania.github.io/startline/

Feedback: scottrichards4@gmail.com

## Enable sign-in (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. SQL editor: paste and run `supabase/schema.sql`.
3. Authentication → URL configuration:
   - Site URL: `https://pyrahmania.github.io/startline`
   - Redirect URLs: that URL, plus `http://localhost:5173` and `http://localhost:5173/`
4. Copy Project URL and anon key into `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

5. `npm run dev` locally, or `npm run build:pages` and redeploy.

Without those keys the app still runs as the local-only alpha.
