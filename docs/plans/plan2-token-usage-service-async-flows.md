# Plan 2: Token Usage Service for Async Flows (Overview)

## Overview

**Focus**: Implement Redis-based token reconciliation and duration tracking for async operations in the Tasks Service.

**Problem**: After transitioning to async operations (RabbitMQ + Webhooks), token reservations made during the initial request need to be reconciled when the AI service callback arrives. However, the request-local state (`res.locals`) is lost once the initial response is sent.

**Solution**: Use Redis to store request metadata (reserved tokens, `startTime`, and rate limiter context) during the initial request, then retrieve and apply reconciliation when the asynchronous callback arrives.

## Token Usage Reconciliation Paths

### Path 1: Immediate Errors (Synchronous)

For errors that occur **before** the AI service accepts the request (e.g., prompt injection detected in middleware):

- Handled synchronously by existing `tokenUsageErrorHandler` middleware.
- No Redis storage required.

### Path 2: Async Completion (Asynchronous)

For requests that are accepted by the AI service (`202 Accepted`):

- Metadata is stored in Redis.
- Reconciliation occurs when the callback arrives (Success or AI-level failure).
- Redis keys are cleaned up after reconciliation.
- **This architecture enables accurate "Total Request Duration" metrics for async flows.**

## Sub-Plans

This plan is broken down into two main phases:

### [Plan 2.1: Token Usage Service (Infrastructure)](./plan2.1-token-usage-service.md)

Focuses on creating the standalone service that interacts with Redis.

- Implementation of `storeRequestMetadata`, `getRequestMetadata`, and `reconcileTokenUsageFromCallback`.
- Comprehensive unit testing.

### [Plan 2.2: Async Flow Integration & Token Reconciliation](./plan2.2-reconciliation-implementation.md)

Focuses on integrating the service into the existing controller logic.

- Updating `TasksController` to store metadata.
- Updating `WebhooksController` to reconcile tokens and record duration-based metrics.
- Comprehensive integration testing covering the full async loop.

## Success Criteria

- [ ] Token usage service implemented and tested.
- [ ] Tasks controller correctly stores `startTime` and token info after queuing requests.
- [ ] Webhook controller retrieves metadata and reconciles tokens for both success and failure callbacks.
- [ ] **Success metrics in webhooks now record actual total duration** (including queue and AI processing time).
- [ ] Redis keys are efficiently managed with TTLs and manual cleanup.
- [ ] System remains resilient to missing or expired metadata.
