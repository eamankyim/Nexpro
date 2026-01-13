# 🔗 Sabito Integration - Planning Phase

## Current State Analysis

### NEXPro (Business Management App)

**Tech Stack:**
- **Frontend**: React + Vite + Ant Design
- **Backend**: Node.js + Express + PostgreSQL (Sequelize ORM)
- **Authentication**: JWT-based auth with multi-tenant support
- **Deployment**: Currently configured for Vercel (based on vercel.json files)

**Key Features:**
- Multi-tenant architecture (Tenants, UserTenant relationships)
- Role-based access control (admin, manager, staff, platform admin)
- Business management modules (Customers, Jobs, Invoices, Quotes, Expenses, etc.)
- Subscription/plan management system
- Feature-gated access control

**Current Auth Setup:**
- JWT tokens stored in localStorage
- Token expiration: 7 days (configurable)
- Auth endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- CORS configured for multiple origins (supports comma-separated domains)

**Database:**
- PostgreSQL database
- Shared tables: `users`, `tenants`, `user_tenants`
- App-specific tables for business operations

---

## What We Need to Know About Sabito

### Critical Questions:

#### 1. **Tech Stack**
- [ ] What frontend framework? (React, Vue, Next.js, etc.)
- [ ] What backend framework? (Node.js, Python/Django, PHP, etc.)
- [ ] Current authentication system? (JWT, sessions, OAuth?)

#### 2. **Current Deployment**
- [ ] Where is Sabito currently deployed?
- [ ] What domain(s)?
- [ ] Is it on Vercel, AWS, custom hosting?

#### 3. **Database**
- [ ] Does Sabito have its own database?
- [ ] Can it share NEXPro's database?
- [ ] What database does it use? (PostgreSQL, MySQL, MongoDB?)

#### 4. **Domain Strategy**
- [ ] Preferred domain structure:
  - Option A: `sabito.com` (main) + `business.sabito.com` (NEXPro)
  - Option B: Separate domains (`sabito.com` + `business-app.com`)
  - Option C: Path-based (`sabito.com` + `sabito.com/business`)

#### 5. **User Model Overlap**
- [ ] Does Sabito have users that should match NEXPro users?
- [ ] Same email addresses across both apps?
- [ ] Different user models that need syncing?

#### 6. **API Strategy**
- [ ] Should both apps use the same backend API?
- [ ] Or separate APIs that share authentication?
- [ ] API base URL preference: `api.sabito.com`?

---

## Integration Approach Comparison

### Option 1: Shared Auth with Subdomain (Recommended) ⭐

**Pros:**
- ✅ Seamless SSO experience
- ✅ Shared user database (single source of truth)
- ✅ Simple token passing via URL
- ✅ Clean domain separation
- ✅ Easy to maintain

**Cons:**
- ⚠️ Requires subdomain setup
- ⚠️ Both apps must share JWT_SECRET
- ⚠️ CORS configuration needed

**Best For:**
- When both apps should feel like one platform
- When users are the same across apps
- When you want the simplest integration

---

### Option 2: Embedded Iframe

**Pros:**
- ✅ Quick to implement
- ✅ No domain setup needed
- ✅ Can share auth via postMessage

**Cons:**
- ❌ Limited flexibility
- ❌ SEO concerns
- ❌ Navigation feels clunky
- ❌ Security considerations (iframe sandboxing)

**Best For:**
- Temporary/quick integration
- When NEXPro is just a small feature within Sabito

---

### Option 3: Monorepo with Shared Packages

**Pros:**
- ✅ Code sharing (components, utilities)
- ✅ Type safety across apps
- ✅ Single codebase to maintain
- ✅ Shared design system

**Cons:**
- ❌ Requires restructuring both apps
- ❌ More complex build/deploy
- ❌ Larger initial effort

**Best For:**
- When starting fresh or major refactor
- When code reuse is high priority
- Long-term architecture goals

---

## Recommended Approach: Option 1

Based on current NEXPro setup, **Option 1 (Shared Auth with Subdomain)** makes the most sense:

### Implementation Phases:

#### **Phase 1: Shared Authentication** 🔐
- Configure shared JWT_SECRET
- Update CORS to allow both domains
- Create token validation endpoint
- Test cross-domain token passing

#### **Phase 2: Navigation Bridge** 🔗
- Add "Open Business Suite" link in Sabito
- Implement deep linking with token passing
- Add "Back to Sabito" navigation in NEXPro
- Handle auto-login from URL token

#### **Phase 3: Data Integration** 📊
- Verify shared database access
- Test cross-app data access
- Implement any needed data sync
- Set up proper tenant isolation

#### **Phase 4: Deployment** 🚀
- Deploy NEXPro to `business.sabito.com`
- Configure DNS
- Update environment variables
- Test production integration

#### **Phase 5: Polish** ✨
- Unified branding
- Consistent navigation
- Shared design tokens (if desired)
- User documentation

---

## Next Steps - Information Needed

To proceed with implementation, please provide:

1. **Sabito Tech Stack**: What technologies is Sabito built with?
2. **Deployment Info**: Where/how is Sabito currently deployed?
3. **Database Decision**: Can Sabito share NEXPro's database, or separate?
4. **Domain Preference**: Preferred domain structure?
5. **User Model**: Do Sabito users overlap with NEXPro users?

Once we have these details, we can create a detailed implementation plan with specific code examples and deployment steps.

---

## Quick Reference: Current NEXPro Setup

### Environment Variables Needed:
```env
# Backend (.env)
JWT_SECRET=<shared-secret-between-apps>
CORS_ORIGIN=https://sabito.com,https://www.sabito.com,https://business.sabito.com
DATABASE_URL=<postgres-connection-string>

# Frontend (.env)
VITE_API_URL=https://api.sabito.com  # or wherever API is hosted
```

### Key Files:
- `Backend/config/config.js` - CORS and JWT config
- `Backend/middleware/auth.js` - JWT validation
- `Backend/controllers/authController.js` - Auth endpoints
- `Frontend/src/services/authService.js` - Frontend auth logic
- `Frontend/src/context/AuthContext.jsx` - Auth state management

---

## Questions for You:

1. **What tech stack is Sabito using?**
2. **Where is Sabito currently deployed?**
3. **Does Sabito have its own database or can it share NEXPro's?**
4. **What's the preferred domain structure?** (business.sabito.com or separate domain?)
5. **Are the users the same across both apps, or different?**






