## ADDED Requirements

### Requirement: Unauthenticated routes enforce a per-IP request rate limit
The system SHALL enforce a rate limit of 60 requests per minute per source IP address on all unauthenticated API routes (login, register, forgot-password, reset-password). Requests exceeding the limit SHALL be rejected with HTTP 429.

#### Scenario: IP within rate limit is allowed
- **WHEN** a client IP sends 60 or fewer requests in any 60-second sliding window to unauthenticated routes
- **THEN** all requests SHALL be processed normally with no rate-limit headers added

#### Scenario: IP exceeds rate limit
- **WHEN** a client IP sends more than 60 requests within a 60-second sliding window
- **THEN** the 61st and subsequent requests within that window SHALL receive HTTP 429
- **AND** the response SHALL include `Retry-After: 60` in the headers
- **AND** the response body SHALL contain `{ "error": "Too many requests" }`

#### Scenario: Rate limit window resets after 60 seconds
- **WHEN** a client IP has been rate-limited and 60 seconds elapse since the oldest request in its window
- **THEN** the IP SHALL be allowed to make requests again without receiving 429

### Requirement: Authenticated routes enforce a per-user request rate limit
The system SHALL enforce a rate limit of 120 requests per minute per authenticated user ID on all routes that require a valid JWT. Requests exceeding the limit SHALL be rejected with HTTP 429.

#### Scenario: Authenticated user within rate limit is allowed
- **WHEN** an authenticated user sends 120 or fewer requests in any 60-second sliding window
- **THEN** all requests SHALL be processed normally

#### Scenario: Authenticated user exceeds rate limit
- **WHEN** an authenticated user sends more than 120 requests within a 60-second sliding window
- **THEN** the 121st and subsequent requests within that window SHALL receive HTTP 429
- **AND** the response SHALL include `Retry-After: 60` in the headers
- **AND** the response body SHALL contain `{ "error": "Too many requests" }`

#### Scenario: Rate limit applies per user, not per IP for authenticated routes
- **WHEN** two different authenticated users share the same IP address and each sends 100 requests per minute
- **THEN** both users SHALL receive normal responses (neither exceeds 120 req/min per user)

### Requirement: Rate limiting uses in-memory sliding window without external dependencies
The rate limiting implementation SHALL use an in-memory sliding window (per Cloudflare Worker isolate) with no KV, Durable Object, or external service dependencies.

#### Scenario: Rate limiter initialized on first request
- **WHEN** the first request arrives at a new worker isolate instance
- **THEN** the in-memory rate limit store SHALL be initialized empty
- **AND** the request SHALL be processed normally

#### Scenario: Memory is bounded to prevent unbounded growth
- **WHEN** the in-memory store accumulates entries for many unique IPs or user IDs
- **THEN** entries older than 60 seconds SHALL be eligible for eviction on each request evaluation
- **AND** the store SHALL not retain entries for keys that have had no requests for more than 60 seconds
