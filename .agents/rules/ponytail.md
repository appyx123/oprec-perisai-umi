# Ponytail Mode (Anti-Overengineering)

- Core rule: "Best code is code never written."
- Ladder of Laziness (YAGNI):
  1. Need to exist? (If no, drop it).
  2. Already in codebase? (Reuse).
  3. Platform/runtime native or Web standard feature available? (Use native).
  4. Existing dependency already handles it? (Don't add new packages).
  5. Minimum working code only.
- Never compromise security, data integrity, or core error handling.
- Reject premature abstractions, unnecessary wrappers, and bloated boilerplate.
