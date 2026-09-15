# startline365 (beta)

Race-season planner. Pin the races you are targeting this year, then invite your crew.

**Live:** https://pyrahmania.github.io/startline/

Feedback: scottrichards4@gmail.com

## Enable sign-in (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. SQL editor: paste and run `supabase/schema.sql`, then `supabase/races.sql` (the live catalog).
3. Authentication → URL configuration:
   - Site URL: `https://pyrahmania.github.io/startline`
   - Redirect URLs: `https://pyrahmania.github.io/startline/**`, `http://localhost:5173`, `http://localhost:5173/**`
4. Copy Project URL and anon key into `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

5. `npm run dev` locally, or `npm run build:pages` and redeploy.

Without those keys the app still runs as the local-only alpha.

## Invite crew

On **Friends**, tap **Invite friends**. Copy or share the link. It works for one person for 14 days.

They open it, sign in, and land in your crew. Tap their name to see their season. Race cards also show who in the crew has that race.

If the magic-link email drops the `?join=` query, they can paste the code on Friends → **Have an invite code?**
