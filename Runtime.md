# SchemaFX Runtime Semantics

This document defines how SchemaFX executes workflows, actions, triggers, and other dynamic operations. It complements the [structural specification](schema.schema.json), [validation rules](Semantic.md), and [versioning policy](Versioning.md).

## Document Status

Sections marked **§ Normative** contain binding requirements using RFC 2119/8174 keywords (MUST, SHOULD, MAY). Sections marked **§ Informative** are explanatory and non-binding. See [Versioning.md](Versioning.md) for the full classification policy and keyword interpretation.

---

## Action Execution Semantics

> **§ Normative**

### Dispatch Order

1. **Confirmation** — prompt if `action.confirm` is true
2. **Context validation** — verify required row data and handlers
3. **Type dispatch** — route based on `config.type`
4. **Result** — return success or failure

### Confirmation

- `delete` handles confirmation internally
- Other actions with `confirm: true` prompt before executing
- Cancelled confirmation returns success with "Cancelled"

### Navigate

URI = `{protocol}:{address}`, with placeholder substitution from row field values.

**Allowed protocols**: `http`, `https`, `mailto`, `tel`, `sms`, `view`
**Blocked schemes**: `javascript`, `data`, `vbscript`, `file`, `ftp`

When `protocol` is a `RowCondition`, validate the resolved value at runtime.

### Copy Row

Copies all fields except primary key and computed fields.
When `config.fields` is specified, only those fields are copied.

### Grouped Actions

Execute sequentially with fail-fast.
Circular references are rejected at validation (ACT-006).

### Bulk Actions

Applies a row-level action to multiple selected rows:

- Rows not satisfying `config.condition` are skipped
- Rows are batched by `config.maxItems`, batches run sequentially
- Within a batch, rows run concurrently
- Individual row failures do not abort the batch

### Action Visibility

An action is visible when:

- Its `condition` evaluates truthy against the current row
- It has a `description` (always visible unless condition is falsy)

In table context, condition is evaluated against all rows; visible only if all pass.

---

## Workflow Execution Semantics

> **§ Normative**

### Execution Flow

1. Log workflow start
2. Evaluate workflow-level concurrency
3. Execute actions sequentially
4. Log result and return

### Action Execution Algorithm

For each workflow action:

1. **Condition** — if present and falsy, skip (not a failure)
2. **Dispatch** — execute per `config.type`
3. **Retry** — apply retry policy on failure
4. **Error** — apply `onError` handler or halt
5. **Collect** — record result and continue

### Run Operation

Invokes a connector operation:

1. Look up connector and verify type
2. Locate operation by `config.operationId`
3. Substitute placeholders with row context
4. Resolve authentication, execute, return result

### Delay

Parse ISO 8601 duration, wait, return success.

### Run Action

Execute a table action. `delete` requires row context. Interactive types may be skipped in autonomous contexts.

### Run Workflow

Execute a sub-workflow. Circular invocations are rejected.

### Condition Action

- Truthy → execute `config.then`
- Falsy with `config.else` → execute else branch
- Falsy without else → succeed with no effect

### Switch Action

Evaluate `config.expression`, match against `config.cases` (strict equality, no fall-through).
No match → execute `config.default` or succeed.

### For-Each Action

Evaluate `config.items` (must be array), iterate with scoped context binding item to `config.as` (default: `"item"`) and index to `"index"`.

`config.concurrency` controls parallel iterations (1 = sequential).
`config.onIterationError`: `"stop"` (default) halts on failure; `"continue"` logs and continues.

### Parallel Action

All branches start concurrently, each executing its actions sequentially.
Branches share read-only parent context.

`config.failStrategy`:

- `"fail_fast"` (default) — cancel on first failure
- `"settle"` — wait for all, return combined result

### Retry Policy

Evaluated after initial failure, before `onError`:

1. If `retry.retryOn` specified, skip if error code not listed
2. Retry up to `retry.maxAttempts` with `retry.backoff` (`fixed`/`linear`/`exponential`)
3. Success on any attempt = action successful
4. All fail = pass last failure to `onError`

### Error Handler

| Strategy   | Behavior                                            |
| ---------- | --------------------------------------------------- |
| `stop`     | Halt and return failure (default)                   |
| `continue` | Log error, proceed to next action                   |
| `goto`     | Jump to specified action (must be forward, WFL-018) |

### Workflow Concurrency

When `workflow.concurrency` is present:

- Count running instances
- Below `maxInstances` → start
- At limit → apply `concurrency.onLimit`: `"queue"` / `"skip"` / `"cancel_running"`

### Trigger Concurrency

Per-trigger limits enforced independently from workflow-level. Both evaluated; stricter wins.

### HTTP Callback

Resolve URL, method, headers, body against workflow context.
Validate URL against SSRF rules (see [SSRF Protection](#ssrf-protection)).
2xx = success; timeout = `INTERNAL_TIMEOUT`; non-2xx = `INTERNAL_CONNECTOR_ERROR`.

---

## Transaction Semantics

> **§ Normative**

### Workflow Transaction Modes

| Mode             | Behavior                                                        |
| ---------------- | --------------------------------------------------------------- |
| `none` (default) | Each action commits independently                               |
| `all_or_nothing` | Single transaction; any failure rolls back all database changes |
| `compensate`     | On failure, execute compensation actions in reverse order       |

### All-or-Nothing

- Begin transaction before first action
- All mutations share same context
- Non-database actions run outside transaction
- `onError.strategy: "continue"` keeps transaction open
- Cross-connector needs `compensate` mode

### Compensate

- Track completed actions on a stack
- On failure with `stop`, iterate stack in reverse and execute compensations
- Best-effort: log compensation failures, retry once after 1 s, then continue
- Actions without `compensation` are skipped

### Batch Operation Atomicity

Each row operates independently by default.
With `"atomic": true`, all rows share a transaction — any failure rolls back all.

### Delete Cascade Atomicity

When `deleteWithRow: true`, cascade file deletions and primary record delete are wrapped in a single transaction.

---

## Optimistic Concurrency Control

> **§ Normative**

Prevents lost updates on tables with `table.concurrency` configured.
Stale requests are rejected with `CONFLICT_STALE_UPDATE`.

### Version Strategy

Integer counter in `versionField`, incremented on every write.
On update/delete:

- Extract token from payload (required)
- Compare against stored value (strict equality)
- Match → apply mutation, increment version
- Mismatch → reject with conflict

### ETag Strategy

Content hash in `versionField`, recomputed after every write.
Same comparison logic as version, using string equality.

### Write Payload Handling

1. Extract token as staleness input
2. Strip from payload before persisting
3. Response returns internally-computed token

### Batch Interaction

OCC applied per row. With `"atomic": true`, a single stale row rolls back entire batch.

### Transaction Interaction

Within `all_or_nothing` or `compensate`:

- Conflict triggers rollback/compensation on unhandled `stop`
- Version increment included in same transaction
- Retry requires re-reading row for fresh token

---

## Trigger Behavior

> **§ Normative**

### Data Triggers

Fire when table events match `trigger.config.table` and event type in `trigger.config.event`.
Matching workflows queued subject to concurrency controls.

### Schedule Triggers

Run on ISO 8601 intervals. Empty durations (`P`, `PT`) rejected.

### Manual Triggers

Invoked by user-initiated actions.

---

## Polling Behavior

> **§ Normative**

Inbound-only — source never written to.

### Precedence

1. Table's `poll` configuration
2. Connector's `poll` configuration
3. No polling

### Execution

1. Schedule timer per `interval`
2. Fetch all rows
3. Compare to snapshot by primary key and field values
4. Classify: `create` / `update` / `delete`
5. Invoke data trigger matching
6. Update snapshot

### Interval Validation

- Zero/negative durations rejected
- Sub-second intervals produce warning

### Snapshot Storage

In-memory (single instance) or shared store (distributed).
Only one instance polls a table in distributed mode.

---

## Live Data Notifications

> **§ Normative**

Events published on row create/update/delete (direct write or poll-detected).

### Event Payload

| Field    | Required | Description                    |
| -------- | -------- | ------------------------------ |
| `table`  | Yes      | Affected table key             |
| `action` | Yes      | `create` / `update` / `delete` |
| `id`     | No       | Primary key when known         |

### Sequencing

Monotonically increasing, non-negative, non-reused sequence numbers.

### Replay Buffer

Bounded buffer for reconnection replay.
Gap exceeding buffer → out-of-buffer signal → full refresh needed.

### Subscriptions

Filter by table key. Unmatched events discarded.

---

## Pagination

> **§ Normative**

### Mode Precedence

1. View-level `pagination`
2. Table-level `pagination`
3. Defaults: `offset` mode, `pageSize: 20`

### Offset Mode (default)

Traditional page/limit. Returns `data`, `total`, `page`, `limit`, `totalPages`.

### Cursor Mode

Forward-only using base64url-encoded cursor from `cursorField`.
`total` = `-1`, `totalPages` = `0`.
Returns `nextCursor` when more records exist.

### Keyset Mode

Multi-field cursor from `keysetFields` for stable deep pagination.
Same response as cursor mode.

### Page Size

- Absent → use default from precedence
- Invalid → treated as absent
- `< 1` → clamped to 1
- `> maxPageSize` → clamped

### Sort

`sort` falls back to primary key.
`dir`: `asc` (default) or `desc`.

### Search

Case-insensitive substring match against searchable fields.
OR logic across multiple fields.
Applied before sort and pagination.

### Connector Support

SQL: native offset/cursor/keyset.
Others: varying levels of native vs in-memory pagination.

---

## Secret Resolution

> **§ Normative**

### Resolution

A `SecretRef` (`value.type === "secret"`):

1. Look up resolver for `value.provider`
2. Call resolver with `name` and `meta`
3. Return resolved value or fail

### Built-in Providers

| Provider | Description           |
| -------- | --------------------- |
| `env`    | Environment variables |

### Connector Authentication

| Auth Type | Key Fields                                                  |
| --------- | ----------------------------------------------------------- |
| `token`   | `token`                                                     |
| `basic`   | `username`, `password`                                      |
| `apikey`  | `key`                                                       |
| `oauth2`  | `clientId`, `clientSecret`, optional service account fields |

**OAuth2 Client Credentials**: POST to `tokenUrl` with credentials.
**OAuth2 Service Account (JWT Bearer)**: Build JWT, sign with RS256, POST to `tokenUrl`.

### Operation Binding

For OpenAPI/SOAP: match `binding.table` to table key, retrieve operation for CRUD type.
For SPARQL: map fields to RDF triple patterns via `mapping`.

---

## Table Path Resolution

> **§ Normative**

The `table.path` array locates data within a connector:

| Connector | Path                  | Semantics                          |
| --------- | --------------------- | ---------------------------------- |
| `sql`     | `[db, schema, table]` | Fully-qualified reference          |
| `graphql` | `[data]`              | Response key containing records    |
| `odata`   | `[data]`              | Entity set name                    |
| `openapi` | `[table]`             | Operation binding lookup           |
| `sparql`  | `[data]`              | SELECT variable for records        |
| `files`   | `[type, path]`        | `folder` or `file` + relative path |
| `rss`     | `[]`                  | Empty; feed items exposed directly |
| `soap`    | `[table]`             | SOAP operation binding lookup      |

Validated at schema load (TBL-011).

---

## Sensitive Field Validation

> **§ Normative**

Plaintext values rejected for auth credentials and SQL connection strings.
Must use `SecretRef` format.

---

## Security Constraints

> **§ Normative**

### SSRF Protection

Validate webhook/callback URLs:

- Scheme must be `http:` or `https:`
- Check against allowed hosts list
- DNS resolution with timeout
- Block private/internal IP ranges and metadata endpoints

#### Blocked IP Ranges

Implementations MUST resolve the hostname and reject requests to blocked ranges:

| Range             | Description              |
| ----------------- | ------------------------ |
| `127.0.0.0/8`     | IPv4 loopback            |
| `10.0.0.0/8`      | RFC 1918 private         |
| `172.16.0.0/12`   | RFC 1918 private         |
| `192.168.0.0/16`  | RFC 1918 private         |
| `169.254.0.0/16`  | Link-local               |
| `0.0.0.0/8`       | Current network          |
| `100.64.0.0/10`   | Shared address space     |
| `192.0.0.0/24`    | IETF protocol assignment |
| `198.18.0.0/15`   | Benchmarking             |
| `::1/128`         | IPv6 loopback            |
| `fc00::/7`        | IPv6 unique local        |
| `fe80::/10`       | IPv6 link-local          |
| `169.254.169.254` | Cloud metadata endpoint  |

DNS resolution MUST use a timeout (default: 2000 ms). Re-resolve per request; cached results MUST NOT bypass checks.

---

## Tenancy Enforcement

> **§ Normative**

When `table.tenancy` configured, tenant isolation enforced on all operations.

### Tenant Resolution Sources

| Source   | Resolution                          |
| -------- | ----------------------------------- |
| `header` | Request header by `identifier.key`  |
| `jwt`    | JWT claim path by `identifier.key`  |
| `query`  | Query parameter by `identifier.key` |

### Enforcement Modes

| Mode         | Absent Identifier Behavior |
| ------------ | -------------------------- |
| `strict`     | Reject request (default)   |
| `permissive` | Proceed without filtering  |

### Row-Level Isolation

Uses `tenancy.column` discriminator:

- Reads: filter by tenant at database level
- Creates: inject tenant ID, override submitted values
- Updates/Deletes: verify ownership, non-matching = not found

### Schema/Database Isolation

`schema` strategy: replace schema segment with tenant ID.
`database` strategy: route to tenant-specific connector.

---

## Partition Behavior

> **§ Normative**

Data routed across partition locations by JSON Logic conditions.
Partitions share parent field structure but may override `connector` and/or `path`.

### Pipeline Order

1. Partition resolution (union reads / route writes)
2. Tenancy enforcement
3. Table filter
4. Return result

### Read

Query all partitions, union results where conditions match.
Exclude duplicates from main table.

### Write

Insert into first matching partition, or main table if none match.

### Update/Delete

Locate across all partitions, operate at current location.

---

## Audit Behavior

> **§ Normative**

When `table.audit` present, record entries for qualifying mutations.

### Destination Table Fields

| Field          | Type       | Description                             |
| -------------- | ---------- | --------------------------------------- |
| `action`       | string     | `create` / `update` / `delete`          |
| `entity_table` | string     | Mutated table key                       |
| `entity_id`    | string/int | Row primary key                         |
| `timestamp`    | datetime   | When mutation occurred                  |
| `before_state` | json       | When `captureState` includes `"before"` |
| `after_state`  | json       | When `captureState` includes `"after"`  |

### Behavior

- Before-state captured pre-mutation, after-state post-mutation
- Serialized as JSON by `field.id`, raw values
- When `audit.fields` present, only those fields included
- When `audit.condition` present, falsy skips entry
- Audit failure MUST NOT block mutation
- MUST NOT trigger further triggers/audit/notifications

---

## File Field Behavior

> **§ Normative**

### Storage Table Contract

| Field      | Type    | Description       |
| ---------- | ------- | ----------------- |
| `name`     | string  | Original filename |
| `path`     | string  | File path or URL  |
| `mimeType` | string  | MIME type         |
| `size`     | integer | Bytes             |

### Validation

| Property    | Behavior                      |
| ----------- | ----------------------------- |
| `formats`   | Reject disallowed MIME types  |
| `encodings` | Validate encoding             |
| `pattern`   | Reject non-matching filenames |
| `maxSize`   | Reject oversized files        |

### Secure Access

Time-limited tokens with HMAC-SHA256 signature.
Default expiry: 3600s. Recommend < 300s for sensitive files.

### Self-Referential Storage

When `config.store` matches containing table, table acts as its own file storage.

### Cascade Delete

When `config.deleteWithRow: true`, delete file from storage and storage record before parent row.
Failures logged but do not block parent deletion.

---

## Array Field Behavior

> **§ Normative**

Ordered lists where each element conforms to `subtype` FieldConfig.

### Validation

1. Must be JSON array
2. Length within `minItems`/`maxItems` bounds
3. Each element validated against `subtype`

### Display

Compact: comma-separated.
Expanded: structured representation.
Edit: add/remove/reorder with per-element constraints.

---

## Row Condition Evaluation

> **§ Normative**

A `RowCondition` is a JSON Logic rule evaluated against row field values.
Truthy = condition met; falsy = unmet.

Only operators from the schema whitelist (`JsonLogicRule.propertyNames`) are permitted; unknown operators rejected at load time (CND-004).

A `BooleanOrCondition` is either:

- Static boolean (used as-is)
- RowCondition (evaluated per-row)

In table context (no single row), evaluate against all rows; met only if all pass.

### Field Conditions

| Property     | Default        | Behavior                                       |
| ------------ | -------------- | ---------------------------------------------- |
| `required`   | `false`        | Field must have non-empty value                |
| `searchable` | type-dependent | Included in search                             |
| `nullable`   | `false`        | Accepts null                                   |
| `show`       | `true`         | Visible in UI (still in write payloads)        |
| `editable`   | `true`         | Editable in forms                              |
| `accessible` | `true`         | Included in read/write (false = fully omitted) |

`defaultValue` accepts literal or RowCondition.

### Re-evaluation

- Initial render: evaluate all conditions
- Field change: re-evaluate conditions referencing changed field
- Row refresh: re-evaluate for refreshed row
- Error: treat as falsy, log warning

---

## Format Rule Behavior

> **§ Normative**

Format rules apply conditional text styles to rows/cells. Presentational only.

### Evaluation

Iterate `table.formatRules` in order:

1. Evaluate condition against row
2. On match, apply `TextStyle` to `rule.columns`
3. Later rules override earlier for same CSS property

### Supported Properties

`color`, `backgroundColor`, `fontWeight`, `fontStyle`, `textDecoration`, `fontSize`, `textTransform`

### Context

- Table view: cell content
- Detail view: field values
- Form view: not applied

---

## Calculated Field Behavior

> **§ Normative**

Read-only fields derived from JSON Logic rules. Never persisted.

### Evaluation

`calculation` receives row fields keyed by `field.id`.
Error → treat as absent, log warning.

Evaluation is per-row. Multiple calc fields evaluated in topological order (dependencies first); any valid sort is acceptable.

Cache invalidation: when a source field changes, dependent calcs MUST be re-evaluated.

### Display

Formatted per `config.format`.
Non-numeric result with numeric format → plain string, warning.

### Variable Resolution

- `{"var": "fieldId"}` — current row value
- `{"var": "refField.prop"}` — traverse reference into related table

### Operators

| Operator  | Returns                                                        |
| --------- | -------------------------------------------------------------- |
| `related` | Array of rows from table where reference points to current row |
| `table`   | All rows from specified table                                  |
| `record`  | First matching row from record definition, or null             |

### Reserved `user` Record

When `auth` configured, `{"record": "user"}` resolves to authenticated user's row.
`{"record": "user.fieldId"}` for specific field.

### Role-Based Access

User role available via `{"record": "user.<roleField>"}`.
Inheritance resolved transitively.

---

## Field Mapping Behavior

> **§ Normative**

Transforms between connector-level and schema-level field names/values.

### Source Key

`field.source` if set, otherwise `field.id`.

### Read Pipeline

1. Extract raw value using source key
2. Apply `readTransform` (against source-keyed row)
3. Type coercion

### Write Pipeline

1. Collect schema value by `field.id`
2. Apply `writeTransform` (against schema-keyed row)
3. Write under source key

### Simple Rename

Set `field.source`, omit transforms.

---

## Duration and Timing

> **§ Informative** (validation rules normative)

### ISO 8601 Format

`P[n]Y[n]M[n]W[n]D[T[n]H[n]M[n]S]`

Examples: `PT5M` = 5 min, `PT1H30M` = 90 min, `P1D` = 1 day.

At least one component required; empty durations rejected.

---

## Input Sanitization

> **§ Normative**

### String Sanitization

All user strings:

1. Strip HTML tags
2. Remove HTML attributes
3. Trim whitespace

### Context-Specific

| Context   | Method                              |
| --------- | ----------------------------------- |
| HTML      | Escape `<>`, `&`, `"`               |
| Attribute | Escape quotes, reject `javascript:` |
| URL       | URL-encode segments                 |
| JSON      | Proper serialization                |

---

## Error Handling

> **§ Normative**

### Error Codes

See `ErrorResponse` schema for structure.

**Categories**:

- `VALIDATION_*` — input validation failures
- `NOT_FOUND_*` — missing resources
- `CONFLICT_*` — concurrency/uniqueness conflicts
- `AUTH_*` — authentication/authorization
- `SCHEMA_*` — schema errors
- `COMPAT_*` — version compatibility
- `INTERNAL_*` — server errors
- `RATE_*` — rate limiting

### Error Messages

Must be actionable, specific, and safe (no secrets or internal paths).

---

## Vega View Rendering

> **§ Normative**

### Spec Resolution

Use `config.spec` directly, or fetch from `config.specUrl`.

### Data Injection

When `config.table` specified:

- Fetch rows
- Inject as `"source"` dataset
- Replace if exists, otherwise prepend

### Signals

Apply `config.signals` overrides after rendering.

### Interactions

Wire `click` to execute referenced action with datum as context.

---

## Distributed Execution

> **§ Normative**

### Scheduling Modes

| Mode          | Description                 |
| ------------- | --------------------------- |
| `single`      | Single instance (default)   |
| `distributed` | Multi-instance with locking |

### Distributed Locking

Lock key: `workflow-lock:{workflowId}`
TTL-based with automatic expiry.
Only one instance holds lock at a time.

---

## Extension Runtime Behavior

> **§ Normative**

### Key Pattern

`^x-[a-zA-Z0-9][a-zA-Z0-9\/_.-]*$`

### Precedence

Top-level `extensions` overrides inline `x-*` properties.

### Tolerance

Unknown keys tolerated (INFO log). MUST NOT reject schema.

---

## File Export Behavior

> **§ Normative**

Exposes table data as serialized files.

### Path Resolution

Full path: `{endpoint}{path}`.
Format selected by file extension mapping to allowed MIME types.

### Filter

`filter` RowCondition combined with `table.filter` via AND.

### Encoding

Applied for text formats; ignored for binary.

---

## OpenAPI Export Behavior

> **§ Normative**

Exposes tables as REST API with auto-generated OpenAPI document.

### Document

Served at `{endpoint}/openapi.json` and `.yaml`.
Regenerated on schema change.

### Operations

Per-table operations: `list`, `read`, `create`, `update`, `replace`, `delete`.

### Schema Derivation

Response schema from allowed fields.
Request schema excludes read-only/calculated fields.

### Pagination

List endpoints paginated.
`defaultPageSize` (25), `maxPageSize` (100).

### Query Parameters

Configurable: `sort`, `filter`, `search`, `fields`.

### Filter

`filter` RowCondition combined with `table.filter` via AND.

---

## Configuration Options

> **§ Informative**

| Option                   | Default  |
| ------------------------ | -------- |
| Scheduling mode          | `single` |
| Webhook DNS timeout      | 2000 ms  |
| Notification buffer size | 100      |
