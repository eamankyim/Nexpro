# NEXPro → Sabito SSO Implementation Guide

This document explains how Sabito can implement auto-login for users coming from NEXPro.

## Overview

When a user clicks "Sabito" in NEXPro, they are redirected to:
```
http://localhost:5175?nexproToken=<jwt_token>
```

Sabito needs to:
1. Extract the `nexproToken` from the URL
2. Verify it with NEXPro's API
3. Get user info from NEXPro
4. Auto-login the user in Sabito

---

## NEXPro Endpoint: Verify Token

### Endpoint
```
GET /api/auth/verify-token
```

### Request Options

**Option 1: Query Parameter**
```
GET http://localhost:5000/api/auth/verify-token?token=<nexproToken>
Headers:
  X-API-Key: <SABITO_API_KEY>
```

**Option 2: Authorization Header**
```
GET http://localhost:5000/api/auth/verify-token
Headers:
  Authorization: Bearer <nexproToken>
  X-API-Key: <SABITO_API_KEY>
```

### Response (Success)
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "sabitoUserId": "sabito_user_id_if_linked",
    "nexproUserId": "nexpro_user_uuid"
  }
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

## Sabito Implementation Steps

### 1. Frontend: Handle SSO Token

In your Sabito frontend (e.g., `App.jsx` or router), add code to handle the `nexproToken`:

```javascript
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const SSOHandler = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const nexproToken = searchParams.get('nexproToken');
    
    if (nexproToken) {
      // Remove token from URL
      searchParams.delete('nexproToken');
      setSearchParams(searchParams, { replace: true });

      // Verify token and auto-login
      verifyAndLoginWithNexpro(nexproToken);
    }
  }, [searchParams]);

  const verifyAndLoginWithNexpro = async (token) => {
    try {
      // Verify token with NEXPro API
      const response = await fetch('http://localhost:5000/api/auth/verify-token', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Key': process.env.VITE_SABITO_API_KEY // Or your API key
        }
      });

      const data = await response.json();

      if (data.success && data.user) {
        const { email, sabitoUserId, nexproUserId } = data.user;

        // Option A: If user has sabitoUserId, find by that
        // Option B: Find by email
        // Option C: Find by nexproUserId (if you store it)
        
        // Find user in Sabito
        let sabitoUser = await findUserByEmail(email);
        
        // If user exists, log them in
        if (sabitoUser) {
          // Link NEXPro user ID if not already linked
          if (!sabitoUser.nexproUserId) {
            await updateUser(sabitoUser.id, { nexproUserId });
          }
          
          // Auto-login: Set auth token/session
          loginUser(sabitoUser);
          
          // Redirect to dashboard/home
          navigate('/dashboard');
        } else {
          // User doesn't exist in Sabito - create account or show registration
          // Option 1: Auto-create account
          // Option 2: Redirect to registration with pre-filled email
          navigate(`/register?email=${encodeURIComponent(email)}`);
        }
      } else {
        // Invalid token - redirect to login
        navigate('/login?error=invalid_token');
      }
    } catch (error) {
      console.error('SSO verification failed:', error);
      navigate('/login?error=sso_failed');
    }
  };

  return null;
};
```

### 2. Backend: Store NEXPro User ID (Optional)

If you want to link Sabito users with NEXPro users, add a field to your users table:

```sql
ALTER TABLE users ADD COLUMN nexpro_user_id VARCHAR(255);
CREATE INDEX idx_users_nexpro_user_id ON users(nexpro_user_id);
```

### 3. Backend: Helper Function

```javascript
// In your Sabito backend
async function verifyNexproToken(token) {
  const response = await axios.get('http://localhost:5000/api/auth/verify-token', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-API-Key': process.env.SABITO_API_KEY
    }
  });

  if (response.data.success) {
    return response.data.user;
  }
  
  throw new Error(response.data.message || 'Token verification failed');
}
```

---

## Complete Flow

```
1. User clicks "Sabito" in NEXPro
   ↓
2. NEXPro redirects to: http://localhost:5175?nexproToken=xxx
   ↓
3. Sabito frontend extracts token from URL
   ↓
4. Sabito calls: GET http://localhost:5000/api/auth/verify-token
   Authorization: Bearer xxx
   ↓
5. NEXPro verifies token and returns user info
   ↓
6. Sabito finds/creates user by email or sabitoUserId
   ↓
7. Sabito logs user in automatically
   ↓
8. User redirected to Sabito dashboard
```

---

## Environment Variables

### Sabito Backend `.env`
```env
# NEXPro API URL
NEXPRO_API_URL=http://localhost:5000

# API Key (same as configured in NEXPro's SABITO_API_KEY)
SABITO_API_KEY=96f39d4b9514addf4c8f08fc38a88db869bd382e16337edbfe46197859ba1e73
```

### Sabito Frontend `.env`
```env
# NEXPro API URL (for token verification)
VITE_NEXPRO_API_URL=http://localhost:5000
VITE_SABITO_API_KEY=96f39d4b9514addf4c8f08fc38a88db869bd382e16337edbfe46197859ba1e73
```

---

## Security Notes

1. **API Key**: The endpoint requires `X-API-Key` header matching `SABITO_API_KEY` in NEXPro's `.env`
2. **Token Expiry**: NEXPro JWT tokens expire (default: 7 days), so old tokens will be rejected
3. **HTTPS**: In production, always use HTTPS for token transmission
4. **Token Storage**: Don't store the NEXPro token in Sabito - only use it once for verification

---

## Testing

1. Log into NEXPro at `http://localhost:3000`
2. Click "Sabito" in the sidebar under "My Apps"
3. Should automatically open `http://localhost:5175?nexproToken=xxx`
4. Sabito should verify the token and auto-login the user
5. User should land on Sabito dashboard without entering credentials

---

**Last Updated**: 2025-12-14





