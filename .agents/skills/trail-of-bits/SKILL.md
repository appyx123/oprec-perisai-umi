---
name: trail-of-bits
description: Trail of Bits security review, vulnerability assessment, cryptographic verification, and defensive engineering methodology.
---

# Trail of Bits Security Engineering & Audit Methodology

This skill implements the security audit, threat modeling, and defensive engineering standards developed and practiced by Trail of Bits.

## Core Philosophy

1. **Assume Breach & Fail Closed**:
   - Systems must fail safely and deny access by default when errors or anomalies occur.
   - Never rely on security through obscurity or client-side trust.

2. **Defense in Depth**:
   - Every security barrier must be backed by secondary controls.
   - Validation must happen at entry points, service boundaries, and database queries.

3. **Invariants & State Machine Integrity**:
   - Explicitly define the system's security invariants (e.g., "A token can only be consumed once", "Unauthorized users can never access tenant data").
   - Audit state transitions for race conditions, reentrancy, and replay attacks.

## Security Review Checklist

### 1. Authentication & Session Management
- **Token Security**: Validate signatures, issuers, expirations, and audience claims strictly.
- **Replay Attack Prevention**: Single-use tokens (e.g., password reset, OTP) must be invalidated immediately in a transactional manner upon consumption.
- **Timing Attacks**: Use constant-time comparison for secrets, hashes, and signatures.
- **Session Lifecycles**: Strict expiration, secure cookie attributes (`HttpOnly`, `Secure`, `SameSite=Lax/Strict`), and revocation capabilities.

### 2. Authorization & Access Control
- **IDOR / BOLA Prevention**: Verify object ownership and organizational tenant boundaries on every data fetch/mutation.
- **Role Enforcement**: Enforce role checks server-side on every API route, never trusting client state or headers alone.
- **Least Privilege**: Grant minimal necessary database permissions and API scopes.

### 3. Cryptographic Implementation
- **Algorithms**: Use modern, vetted primitives (AES-GCM, Argon2id, PBKDF2 with sufficient iterations, Ed25519/ECDSA, SHA-256/SHA-512).
- **Key Management**: Secrets must never be hardcoded, logged, or exposed to the client. Fail hard in production if environment secrets are unset.
- **RNG**: Use cryptographically secure pseudorandom number generators (`crypto.getRandomValues()` or `crypto.randomUUID()`).

### 4. Input Validation & Data Sanitization
- **Strict Typing**: Reject unexpected payloads and properties (schema validation with Zod or strict guards).
- **Injection Defense**: Parameterized queries for SQL/Drizzle; escape HTML/SVG to prevent XSS.
- **Resource Limits**: Enforce payload size limits, rate limiting, and timeouts to prevent DoS.

### 5. Cloudflare & Edge Architecture (Specific to Stack)
- Bindings & Secrets: Validate presence and integrity of Cloudflare Workers/Pages bindings (D1, KV, R2).
- Header Integrity: Trust headers like `CF-Connecting-IP` only when running behind authenticated Cloudflare infrastructure.
- Anti-Bot: Cloudflare Turnstile token verification server-side prior to state mutation.

## Audit Workflow

When auditing or reviewing code:
1. **Identify Entry Points**: Map all public and authenticated endpoints.
2. **Trace Data Flow**: Follow user-supplied input from HTTP request down to database operations.
3. **Analyze Edge Cases**: Boundary values, nulls, negative values, malformed inputs, race conditions.
4. **Report Findings**: Categorize by Severity (Critical, High, Medium, Low, Informational), provide clear Root Cause, Exploitation Scenario, and Remediation Diff.
