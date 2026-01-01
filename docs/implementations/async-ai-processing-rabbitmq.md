# Async AI Processing with RabbitMQ - Implementation Log

## Overview

This document tracks the implementation of async AI processing using RabbitMQ. The flow enables asynchronous task processing: (1) Client → Tasks (input validation), (2) Tasks → AI Service, (3) AI Service validates (prompt injection, schema), (4) AI Service creates job in RabbitMQ, (5) AI Service returns 202 to Tasks, (6) Tasks returns 202 to client, (7) Worker processes job, calls OpenAI, then calls Tasks service webhook endpoint, (8) Tasks service webhook creates task and reconciles token usage. Token usage is reserved before queueing and reconciled in webhook callback.

## Implementation Progress

### Section 1: Infrastructure Setup

**Status**: ✅ Complete

**Completed**:

- Added RabbitMQ service to `docker-compose.yml` with ports 5672 (AMQP) and 15672 (management UI)
  - Uses environment variables `${RABBITMQ_DEFAULT_USER}` and `${RABBITMQ_DEFAULT_PASS}` for credentials
- Added `RABBITMQ_URL` environment variable to AI service config (using `str()` from envalid)
- Added `TASKS_SERVICE_BASE_URL` environment variable to AI service config (using `url()` from envalid for better validation)
- Added `SERVICE_URL` environment variable to Tasks service config (using `url()` from envalid) - Tasks service uses this to refer to itself
- Created `backend/services/ai/src/constants/rabbitmq.ts` with object-based constants:
  - `RABBITMQ_QUEUE.AI_CAPABILITY_JOBS` (instead of flat `RABBITMQ_QUEUE_NAME`)
  - `RABBITMQ_DLQ.AI_CAPABILITY_JOBS_DLQ` (instead of flat `RABBITMQ_DLQ_NAME`)
- Updated `backend/services/ai/src/constants/index.ts` to export RabbitMQ constants
- Updated `backend/services/ai/tsconfig.json` to add `@workers/*` path alias

**Files Created**:

- `backend/services/ai/src/constants/rabbitmq.ts`

**Files Modified**:

- `docker-compose.yml` (RabbitMQ service added with env vars for credentials)
- `backend/services/ai/src/config/env.ts` (added RABBITMQ_URL and TASKS_SERVICE_BASE_URL with url() validation)
- `backend/services/tasks/src/config/env.ts` (added SERVICE_URL - Tasks service uses this for its own URL)
- `backend/services/ai/src/constants/index.ts`
- `backend/services/ai/tsconfig.json`

**User Changes Applied**:

- `docker-compose.dev.yml`: RabbitMQ service not added (user rejected - likely not needed for dev)
- Constants structure: Changed to object-based pattern (`RABBITMQ_QUEUE.AI_CAPABILITY_JOBS`) for better organization
- Tasks service: Uses `SERVICE_URL` instead of `TASKS_SERVICE_BASE_URL` for self-reference
- AI service: Uses `url()` validator for `TASKS_SERVICE_BASE_URL` (better validation)

**Issues Encountered**:

- None

**Test Results**:

- `npm run type-check:ci`: ✅ Pass (verified after user changes)
- `npm run test`: ✅ Pass (274 tests passed - from initial run)

**Notes**:

- `.env.example` files are filtered by gitignore, so they need to be manually updated with:
  - AI service: `RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672` and `TASKS_SERVICE_BASE_URL=http://tasks:3001` (for docker) or `http://localhost:3001` (for local)
  - Tasks service: `SERVICE_URL=http://tasks:3001` (for docker) or `http://localhost:3001` (for local)
- Future sections will use `RABBITMQ_QUEUE.AI_CAPABILITY_JOBS` and `RABBITMQ_DLQ.AI_CAPABILITY_JOBS_DLQ` instead of the flat constant names
- Tasks service webhook will use `env.SERVICE_URL` to construct callback URLs

### Section 2: AI Service - RabbitMQ Client

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 3: AI Service - Job Payload Types

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 4: AI Service - Async Pattern Executor

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 5: AI Service - Worker Implementation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 6: Tasks Service - Webhook Types and Schemas

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 7: Tasks Service - Webhook Endpoint Implementation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 8: Tasks Service - Async Flow Implementation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 9: Metrics Updates

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

### Section 10: Testing and Documentation

**Status**: ⏸️ Not Started

**Completed**:

- [To be filled after implementation]

**Files Created**:

- [To be filled after implementation]

**Files Modified**:

- [To be filled after implementation]

**Issues Encountered**:

- [To be filled if any issues]

**Test Results**:

- `npm run type-check:ci`: ⏸️ Pending
- `npm run test`: ⏸️ Pending

**Notes**:

- [To be filled]

## Summary

[Final summary when all sections are complete]

