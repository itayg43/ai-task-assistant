# Plan 1.5: Metrics Middleware Cleanup

## Overview

Remove the unused and inaccurate metrics middleware from the codebase.

## Deletions

- **Directory**: `backend/services/tasks/src/middlewares/metrics-middleware/`
- **Directory**: `backend/shared/src/middlewares/metrics/`

## References

Ensure no imports remain in any files pointing to the deleted directories.

## Verification Plan

- Run `npm run build` for both AI and Tasks services to ensure no broken imports.
