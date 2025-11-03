# CRITICAL: Fix Root Directory Issue

## The Problem

Render is looking for `/opt/render/project/src/package.json` but our `package.json` is in `Backend/package.json`.

## The Solution

In Render Dashboard:

### 1. Go to Your Service Settings

1. Click on `nexpro-backend` service
2. Go to **Settings** tab
3. Scroll to **Build & Deploy** section

### 2. Set Root Directory

Find the **"Root Directory"** field and set it to:

```
Backend
```

**Important:** 
- Capital B!
- No trailing slash
- No quotes
- Just: `Backend`

### 3. Verify Build Commands

Should be:
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 4. Save & Redeploy

1. Click **"Save Changes"**
2. Go to **"Manual Deploy"** tab
3. Click **"Deploy latest commit"**

### 5. Watch Logs

Should now show:
```
==> Cloning from https://github.com/eamankyim/Nexpro
==> Checking out commit...
==> Running build command from directory /opt/render/project/src/Backend...
==> npm install
```

Notice: **from directory /opt/render/project/src/Backend**

---

## Visual Guide

Render Settings should look like this:

```
─────────────────────────────────────────────
Build & Deploy
─────────────────────────────────────────────

Language
├─ Node

Branch
├─ main

Root Directory
├─ Backend          ← THIS IS CRITICAL!

Build Command
├─ npm install

Start Command  
├─ npm start

─────────────────────────────────────────────
```

---

## Still Not Working?

### Verify in Logs

Look for this line in deployment logs:
```
==> Running build command from directory /opt/render/project/src/Backend
```

If you see:
```
==> Running build command from directory /opt/render/project/src
```

Then Root Directory is NOT set correctly!

### Alternative Check

In the logs, look for the checkout directory:
```
==> Checking out commit... in /opt/render/project/src
```

Then look for where it runs the build - it should be `Backend`.

---

## Screenshot What to Check

In Render Dashboard:
1. Settings → Root Directory field
2. Should say: `Backend`
3. Save
4. Manual Deploy

---

**This is THE fix you need!** 🎯


