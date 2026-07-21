<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Rules

- Always create tests when bugs are reported. Every bug fix must include a test that reproduces the bug and verifies the fix.
- Always clean up test data after tests run. Every test must follow the pattern: setup test data → execute test → cleanup test data. Use `test.afterEach` for cleanup. Share cleanup helpers via `tests/helpers.ts`.
- New features must include tests for both happy path and unhappy path.
