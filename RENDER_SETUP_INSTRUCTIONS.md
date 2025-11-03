# Render Setup - Exact Instructions

## Fill in these fields EXACTLY as shown:

### Basic Configuration

**Name:**
```
nexpro-backend
```

**Root Directory:**
```
Backend
```

**Branch:**
```
main
```

**Region:**
```
Oregon (US West)
```

### Build & Start Commands

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

### Instance Type

Select: **Free** (for now, can upgrade later to $7/month)

---

## Environment Variables

Click **"Add Environment Variable"** and add these ONE BY ONE:

### Variable 1
```
NAME: PORT
VALUE: 5000
```

### Variable 2
```
NAME: NODE_ENV
VALUE: production
```

### Variable 3
```
NAME: DATABASE_URL
VALUE: (paste your Neon database connection string)
```
**Example:** `postgresql://username:password@ep-xxx.neon.tech/database?sslmode=require`

### Variable 4
```
NAME: JWT_SECRET
VALUE: (generate with: openssl rand -base64 32)
```

To generate JWT_SECRET, open terminal/command prompt and run:
```bash
openssl rand -base64 32
```

### Variable 5
```
NAME: JWT_EXPIRE
VALUE: 7d
```

### Variable 6
```
NAME: DEFAULT_PAGE_SIZE
VALUE: 10
```

### Variable 7
```
NAME: MAX_PAGE_SIZE
VALUE: 100
```

**Note:** We'll add CORS_ORIGIN and FRONTEND_URL after frontend deploys!

---

## Important Fields Summary

| Field | Value |
|-------|-------|
| Name | `nexpro-backend` |
| Root Directory | `Backend` |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |
| Region | Oregon (US West) |

---

## After Backend Deploys

1. Note your backend URL: `https://nexpro-backend.onrender.com`
2. Deploy frontend (next step)
3. Come back and add `CORS_ORIGIN` and `FRONTEND_URL`

---

## Click "Deploy web service" Button! 🚀

Wait 3-5 minutes for first deployment.

