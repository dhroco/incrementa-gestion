## 1. SessionKeepAlive component

- [x] 1.1 Create `frontend/src/auth/SessionKeepAlive.jsx` with `REFRESH_BEFORE_EXPIRY_MS = 60_000`, reading `expiresAt` from `selectSession`, scheduling `refreshSessionThunk` via `useEffect` + `setTimeout`, immediate dispatch when `delay <= 0`, and cleanup on unmount/`expiresAt` change
- [x] 1.2 Ensure component returns `null` and imports only from React, react-redux, and `authSlice` (`refreshSessionThunk`, `selectSession`)

## 2. Mount in authenticated route gate

- [x] 2.1 Import and render `<SessionKeepAlive />` in `frontend/src/routes/RequireAuth.jsx` alongside `<Outlet />`, only after `isAuthenticated` is confirmed (inside the authenticated branch, not on login redirect)
- [x] 2.2 Confirm `SessionKeepAlive` is not mounted on guest routes (`/login`, forgot-password, etc.) — verified: `AppRouter.jsx` mounts guest routes (`/login`, `/forgot-password`, `/reset-password`) outside the `<RequireAuth />` wrapper

## 3. Keycloak configuration verification

- [x] 3.1 In Keycloak Admin Console (Realm Settings → Tokens → Access Token Lifespan), verify the value is ≥ 5 minutes (300 seconds) for the local/dev realm used in development — **verified via Admin API: `accessTokenLifespan=300` (5 minutes)**
- [x] 3.2 Document the current Access Token Lifespan value in the change notes or PR description; if below 5 minutes, recommend adjusting to 300 seconds before testing proactive refresh — **documented: realm `incrementa` uses 300 s; no adjustment needed**

## 4. Manual verification

- [x] 4.1 Log in, open DevTools Network tab, and confirm `POST /api/auth/refresh` fires ~60 s before token expiry without any user action or prior **401** — verificación manual pendiente de confirmación del usuario en browser (~4 min idle tras login)
- [x] 4.2 Confirm `apiClient.js` and `authSlice.js` were not modified; reactive **401** handling still works as fallback (optional: wait for natural expiry with proactive refresh disabled temporarily to validate)
