# Dashboard Data Validation (servio.solutions)

## What was checked
- Attempted to open `https://servio.solutions/dashboard` in a browser automation session.
- Observed redirect behavior for unauthenticated users.
- Reviewed dashboard frontend data sources in code.

## Findings
1. The dashboard route requires authentication.
2. When unauthenticated, the app redirects to `/login`.
3. Data requests that power dashboard cards (`/api/orders`, `/api/orders/stats/summary`, `/api/restaurant/profile`) return `401` without a valid session.
4. Because of that, dashboard KPI correctness cannot be confirmed from an anonymous session.

## Next step to fully validate correctness
- Sign in with a valid account for the target restaurant and then compare shown KPIs against backend/API values for the same account and date window.
