# HudumaDesk

HudumaDesk is a small public-service request portal for Murang’a County Government. Citizens can register, submit and track service requests; authorised administrators can review the queue, update statuses and view basic totals. The frontend is React + Vite, with Supabase Auth, PostgreSQL and private Storage for optional photos.

## Requirements

Install Node.js 20 or newer and pnpm 11. The project pins pnpm in `package.json` and includes a lockfile.

## 1. Connect Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. In the project dashboard, open **SQL Editor**, create a query, paste all of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `profiles` and `requests` tables, a server-generated unique reference number, Row Level Security policies, a private image bucket and upload/read policies.
3. In **Project Settings → API**, copy the Project URL and the **anon/public** key. These browser values are expected to be public; never put a `service_role` key in the frontend.
4. Create a local environment file and add those values:

   ```bash
   cp .env.example .env.local
   ```

   Replace the example text in `.env.local` with the Project URL and anon key. `.env.local` is ignored by Git; do not commit it.
5. In **Authentication → URL Configuration**, add `http://localhost:3000/**` to the allowed redirect URLs. When deployed, also add the exact Vercel site URL. Email sign-up may require clicking the confirmation link, depending on the Supabase Email provider setting.

## 2. Run and build locally

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. For a production build:

```bash
pnpm build
```

The build runs TypeScript checks before producing the static site in `dist/`.

## 3. Create an administrator

First register normally with the email account that should administer the site. Then open **Supabase → SQL Editor** and promote that account (replace the email below):

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@example.com'
);
```

Sign out and sign back in to refresh the role in the app. The sign-up trigger always creates a `citizen` profile; a browser user cannot set their own role. Run the promotion only from the trusted Supabase SQL Editor. Do not expose a service-role key in frontend code.

## 4. Push source to GitHub

Create a private GitHub repository for the project. For a normal local copy, add the new repository as `origin`, then push the source:

```bash
git remote add origin https://github.com/YOUR-USERNAME/hudumadesk.git
git branch -M main
git add .
git commit -m "Build HudumaDesk service portal"
git push -u origin main
```

If `origin` is already set, check it with `git remote -v` and skip `git remote add`. Environment values in `.env.local` are excluded from commits. If you are developing inside Manus, use the project’s GitHub connection flow to connect the managed project repository; do not copy access tokens into Git commands.

## 5. Deploy on Vercel

1. Sign in at [vercel.com](https://vercel.com/) and choose **Add New → Project**, then import the HudumaDesk GitHub repository.
2. Vercel detects Vite. Use **Build Command** `pnpm build` and **Output Directory** `dist` (install command `pnpm install`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the Vercel project’s **Settings → Environment Variables** for Preview and Production. These are build-time frontend settings; redeploy after changing them.
4. Deploy. Copy the deployed URL, add it to Supabase **Authentication → URL Configuration → Redirect URLs**, and set the site URL there to the deployed site. Test a new account, a request, and sign-in after deployment.

## Access and data protection

The SQL uses RLS so citizens can read only their own requests and cannot promote their profile or set request statuses. Administrators are identified by a profile role set manually by the project owner; only administrators can read all requests and change a request to `In Progress` or `Resolved`. Reference numbers and initial `Pending` status are assigned by PostgreSQL defaults. The photo bucket is private; object paths begin with the owner's user ID, and the app displays short-lived signed links. An image is optional and limited to JPG, PNG or WebP up to 5 MB.

## Configuration still required

The app is ready to build, but it does not connect to a live database until you create a Supabase project, run the SQL, and set the two environment variables locally and in Vercel. Promoting the administrator account and configuring Supabase redirect URLs are manual owner steps. No Supabase service-role key, separate backend, or paid integration is required.


## GIS spatial feature

The request form keeps the required text location and adds an optional Leaflet map pin. When selected, the pin is stored as nullable numeric `latitude` and `longitude` values on the same request row; without a pin, both remain `NULL`, and the existing request flow continues normally. The updated `supabase/schema.sql` adds the columns safely to an earlier HudumaDesk database, checks coordinate ranges and paired nullability, and grants citizens only the ability to set coordinates when inserting their own request. Existing Row Level Security still controls which request rows each account can read.

The administrator dashboard displays a Leaflet map using those same requests, status colours, and current search/status filters. Clicking a marker shows its reference, category, status and text location. The map appears only in the existing administrator dashboard; the request table’s owner/admin policies remain the data-access boundary. Coordinates are not public, and the citizen-facing history does not display other people’s pins.

The supplied `public/geojson/muranga-admin2.geojson` is used as a subtle administrative-area outline with names from its properties. It contains seven administrative polygons, not ward boundaries, so HudumaDesk does not label it as a ward map or add a ward choropleth. The base map uses Leaflet with OpenStreetMap tiles and attribution; map tiles need an internet connection. Pinning is optional and uses a citizen click rather than device GPS or fabricated coordinates. It is a simple service-location aid, not a geocoder, routing system or production-scale tile-hosting arrangement. After updating a previously configured database, re-run the full `supabase/schema.sql` script in Supabase SQL Editor before using map pins.
