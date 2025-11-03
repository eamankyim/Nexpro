# 🎯 How to Access Render Shell (Super Simple!)

## The Steps:

1. **Go to:** https://dashboard.render.com
2. **Click** on your backend service name (the one that says "nexpro" or similar)
3. **Click** the **"Shell"** tab at the top
4. **Wait** for a `$` to appear
5. **Type:** `cd Backend` then press Enter
6. **Type:** `npm run migrate` then press Enter
7. **Type:** `npm run seed-admin` then press Enter
8. **Done!** ✅

---

## It Looks Like This:

```
Step 1: Render Dashboard
┌────────────────────────────────┐
│  Your Services                 │
│  ┌──────────────────────────┐ │
│  │  nexpro-backend     [→]  │ │  ← Click here!
│  └──────────────────────────┘ │
└────────────────────────────────┘

Step 2: Service Page
┌────────────────────────────────┐
│  Logs | Metrics | Shell | ... │  ← Click "Shell"
└────────────────────────────────┘

Step 3: Terminal Opens
┌────────────────────────────────┐
│  $ cd Backend                  │
│  $ npm run migrate             │
│  ✅ Migration complete!        │
│  $ npm run seed-admin          │
│  ✅ Admin created!             │
│  $                             │
└────────────────────────────────┘
```

---

## That's It!

Now you can login with:
- Email: `admin@printingpress.com`
- Password: `admin123`

---

**Need more detail?** Read `ACCESS_RENDER_SHELL.md`

