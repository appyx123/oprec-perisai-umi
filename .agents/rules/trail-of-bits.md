# Trail of Bits Security Standard

- Threat model every change: identify trust boundaries, untrusted input, and failure modes.
- Fail closed & deny by default: unauthorized or invalid states must abort immediately with clear, non-leaking errors.
- Defense in depth: validate on client, API entrypoint, and DB queries. Do not rely on single gates.
- Invariant enforcement: single-use tokens must be burned immediately; state transitions must be atomic to prevent race conditions & replay attacks.
- Cryptography: use constant-time comparisons for secrets/hashes; cryptographically secure RNG; never expose keys.
- Authorization: enforce object-level permissions (IDOR/BOLA checks) server-side on every fetch/mutation.
- Injection defense: strict parameterized queries, strict schema validation, escape outputs.
