# Deploying Nexpro to Vercel

This guide covers deploying the **Backend**, **Frontend**, and **Marketing Site** as **three separate Vercel projects** from this monorepo.

---

## Prerequisites

- [Vercel account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/docs/cli) (optional): `npm i -g vercel`
- Git repo pushed to **GitHub**, **GitLab**, or **Bitbucket**
- **PostgreSQL** database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app))

---

## 1. Deploy order

1. **Backend** first → note the deployment URL (e.g. `https://nexpro-api-xxx.vercel.app`).
2. **Frontend** second → set `VITE_API_URL` to the Backend URL.
3. **Marketing Site** last (optional) → set `NEXT_PUBLIC_APP_URL` to the Frontend URL if you use `/login` and `/signup` redirects.

---

## 2. Backend (API)

### 2.1 Create Vercel project

1. [Vercel Dashboard](https://vercel.com/new) → **Add New…** → **Project**.
2. Import your Git repository.
3. **Before** deploying, open **Settings** → **General**:
   - **Root Directory**: set to `Backend` (click **Edit**, then **Browse** and choose `Backend`).
4. **Framework Preset**: **Other** (no framework).

### 2.2 Build & output

- **Build Command**: leave empty (handled by `vercel.json`).
- **Output Directory**: leave empty.
- **Install Command**: `npm install` (default).

### 2.3 Environment variables

In **Settings** → **Environment Variables**, add:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Secret for JWT signing | `openssl rand -base64 32` |
| `JWT_EXPIRE` | Token expiry | `7d` |
| `CORS_ORIGIN` | Allowed frontend origins (comma‑separated) | `https://nexpro-app.vercel.app,https://nexpro.vercel.app` |
| `FRONTEND_URL` | Main app URL (invites, etc.) | `https://nexpro-app.vercel.app` |

Optional (see `Backend/env.example`):

- `NODE_ENV` = `production`
- Sabito, WhatsApp, OpenAI, Mobile Money, etc.

Add these for **Production** (and **Preview** if you use branch deploys).

### 2.4 Deploy

- Trigger a deploy (e.g. **Redeploy** or push to `main`).
- Copy the **Production** URL, e.g. `https://nexpro-api-xxx.vercel.app`.

### 2.5 Verify

- `https://<backend-url>/health` → `{"success":true,"message":"Server is running",...}`
- `https://<backend-url>/` → API info JSON.

---

## 3. Frontend (App)

### 3.1 Create Vercel project

1. **Add New…** → **Project** → same Git repo.
2. **Root Directory**: `Frontend`.
3. **Framework Preset**: **Vite** (or **Other**; `vercel.json` sets build/output).

### 3.2 Build & output

- **Build Command**: `npm run build` (or leave default).
- **Output Directory**: `dist`.

### 3.3 Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL (**required**) | `https://nexpro-api-xxx.vercel.app` |

Optional:

- `VITE_SABITO_URL` – Sabito frontend URL.
- `VITE_WS_URL` – WebSocket URL (not used on Vercel serverless; real‑time uses fallbacks).

### 3.4 Deploy

Deploy and note the Frontend URL, e.g. `https://nexpro-app.vercel.app`.

### 3.5 Wire Backend ↔ Frontend

1. **Backend** project → **Settings** → **Environment Variables**:
   - `CORS_ORIGIN`: add the Frontend URL (and any preview URLs if needed).
   - `FRONTEND_URL`: set to the Frontend URL.
2. Redeploy the Backend after changing env vars.

---

## 4. Marketing Site (Next.js)

### 4.1 Create Vercel project

1. **Add New…** → **Project** → same Git repo.
2. **Root Directory**: `marketing-site`.
3. **Framework Preset**: **Next.js** (auto‑detected).

### 4.2 Build & output

Use defaults (`npm run build`, Next.js output).

### 4.3 Environment variables (optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Main app URL for redirects | `https://nexpro-app.vercel.app` |

If set, `/signup` and `/login` on the marketing site redirect to the main app.

### 4.4 Deploy

Deploy and note the Marketing Site URL.

---

## 5. Deploying via Vercel CLI

From the **repository root**:

```bash
# Login once
vercel login

# Backend
vercel --cwd Backend link    # Link to existing Backend project, or creates new
vercel --cwd Backend --prod  # Deploy production

# Frontend (after setting VITE_API_URL in project settings)
vercel --cwd Frontend link
vercel --cwd Frontend --prod

# Marketing site
vercel --cwd marketing-site link
vercel --cwd marketing-site --prod
```

Ensure **Root Directory** is set correctly for each project in the Vercel dashboard (e.g. `Backend`, `Frontend`, `marketing-site`).

---

## 6. Summary of Vercel projects

| Project | Root Directory | Main env vars |
|--------|----------------|----------------|
| **Backend** | `Backend` | `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL` |
| **Frontend** | `Frontend` | `VITE_API_URL` |
| **Marketing Site** | `marketing-site` | `NEXT_PUBLIC_APP_URL` (optional) |

---

## 7. Important notes

### Backend (serverless)

- **WebSockets**: Not supported on Vercel serverless. Real‑time features use HTTP fallbacks where implemented.
- **File uploads**: The `/uploads` directory is not persistent. Use **Vercel Blob**, **S3**, or similar for production file storage.
- **Cron / background jobs**: `node-cron` and long‑running processes do not run on serverless. Use [Vercel Cron](https://vercel.com/docs/cron-jobs) or an external scheduler for Sabito sync, reminders, etc.
- **`maxDuration`**: `Backend/vercel.json` sets `maxDuration: 60` for the API handler. This requires a **Pro** plan; **Hobby** is limited to 10s. Adjust or remove if needed.

### Frontend

- **`VITE_API_URL`** must be set in production. The app shows an error banner if it’s missing on a Vercel deployment.

### Marketing site

- Purely optional. Deploy only if you use the marketing/landing site.

---

## 8. Custom domains

For each project:

1. **Settings** → **Domains**.
2. Add your domain and follow DNS instructions.

Use the same domains in `CORS_ORIGIN`, `FRONTEND_URL`, and `VITE_API_URL` as needed.

---

## 9. Troubleshooting

| Issue | Check |
|-------|--------|
| Backend 404 / 500 | Root Directory = `Backend`, `DATABASE_URL` set, redeploy after env changes |
| Frontend “VITE_API_URL not set” | Add `VITE_API_URL` in Frontend project env and redeploy |
| CORS errors | Add Frontend (and marketing) URLs to Backend `CORS_ORIGIN` |
| DB connection errors | `DATABASE_URL` correct, IP allowlist if required, SSL params for Neon/Supabase |

---

You now have **Backend**, **Frontend**, and **Marketing Site** deployed as three separate Vercel projects.
