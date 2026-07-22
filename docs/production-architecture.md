# Azure Production Architecture

I would deploy the frontend as static assets behind Azure Front Door and run the Node API on Azure Container Apps with autoscaling on concurrent requests and CPU. Infrastructure would be managed with Terraform modules for the container app, managed identity, Key Vault, Azure Database for PostgreSQL, Log Analytics, Front Door, and private networking.

The audit log would move from JSONL to PostgreSQL with indexed columns for tenant, user, provider mode, status, created time, agent list, latency, and redacted error codes. Gemini or a chosen model gateway key would live in Key Vault and be accessed through managed identity, never app settings copied by hand.

Enterprise authentication would use Microsoft Entra ID with OIDC. The API would validate JWTs, map groups or app roles into product roles, and enforce access at the route and record level. Admin or reviewer views would require separate roles from normal trip-planning users.

For 500+ concurrent users I would add request limits, queue or shed long model calls, tune provider timeouts, and cache safe destination context where possible. Monitoring would include Application Insights traces, structured logs, dashboarded latency/error/model-fallback rates, budget overage counts, and alerts for provider failures, high p95 latency, and audit-write errors.
