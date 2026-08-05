<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Rules

- Always create tests when bugs are reported. Every bug fix must include a test that reproduces the bug and verifies the fix.
- Always clean up test data after tests run. Every test must follow the pattern: setup test data → execute test → cleanup test data. Use `test.afterEach` for cleanup. Share cleanup helpers via `tests/helpers.ts`.
- New features must include tests for both happy path and unhappy path.
- Only deploy to production on explicit order from the user.

## Test runs

- Always output test results to a file, e.g. `CI=1 npx playwright test > /var/folders/k1/kn91d0k10_d_tdy22qptjctw0000gn/T/opencode/playwright-results.txt 2>&1` (or a `.tmp/` path inside the repo), then use that file to investigate failures instead of re-running and re-parsing terminal output.
- When investigating failures, read/grep the results file for the exact failing test names and error messages before changing code.
- When fixing failed tests, re-run only the failed tests. Only run full suites for final confirmation.
- Tests must not depend on seed data. All test data must be loaded at the beginning of the test and deleted after the test completes.
