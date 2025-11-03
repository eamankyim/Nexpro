# Remove "Backend/" Prefix from Commands!

## The Problem

Your Build Command shows:
```
Backend/ $ npm install
```

But since you set **Root Directory** to `Backend`, Render already changes to that directory!

## The Fix

### Change These Fields:

**Current (WRONG):**
```
Root Directory: Backend
Build Command: Backend/ $ npm install
Start Command: Backend/ $ npm start
```

**Should Be (CORRECT):**
```
Root Directory: Backend
Build Command: npm install
Start Command: npm start
```

---

## Visual Guide

In the Settings modal:

```
─────────────────────────────────────────
Build & Deploy

Root Directory
└─ Backend                    ← Correct!

Build Command
└─ npm install                ← Remove "Backend/ $"
   ❌ NOT: Backend/ $ npm install

Start Command
└─ npm start                  ← Remove "Backend/ $"
   ❌ NOT: Backend/ $ npm start

─────────────────────────────────────────
```

---

## Why This Works

When you set **Root Directory** to `Backend`:
1. Render clones your repo
2. Render **automatically changes** to the `Backend` directory
3. Render runs your build/start commands FROM that directory
4. So you don't need to specify the path again!

---

## After Fixing

Click **"Update Fields"** button, then:
1. Go to **Manual Deploy**
2. Deploy latest commit
3. Should work! 🎉

---

**Remove `Backend/ $` from both commands!** 🚀


