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

### Result Structure

The parallel action result MUST be an object keyed by branch `id`. Each value MUST be the result of that branch (success value or error).

With `"fail_fast"`, cancelled branches MUST have their result set to `null`. With `"settle"`, every branch MUST have a result entry regardless of success or failure. Per-branch errors MUST include the `ErrorResponse` structure.

Post-parallel actions MAY access branch results via `{"var": "branchId"}` in the execution context.

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

Per-trigger limits enforced independently from workflow-level. Both limits are evaluated; the lower numeric limit applies. If either limit is reached and its `onLimit` policy would reject the execution (`skip` or `cancel_running`), that rejection takes effect.

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
- `all_or_nothing` with actions spanning multiple connectors MUST be rejected at validation time with `SCHEMA_INVALID_TRANSACTION`; implementations MUST NOT silently degrade to partial commits

### Compensate

- Track completed actions on a stack
- On failure with `stop`, iterate stack in reverse and execute compensations
- Best-effort: log compensation failures, retry once after 1 s, then continue
- Actions without `compensation` are skipped
- Compensation retry policy MUST be configurable (`maxAttempts` default ≥ 3, `delay`, `backoff` strategy). The built-in default of a single retry after 1 s applies only when no explicit policy is configured.
- Compensation failures MUST be logged with full context (original action, compensation action, error) for manual resolution
- Compensation failures that exhaust all retries MUST produce a `COMPENSATION_FAILED` error code in logs and metrics

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

When `startTime` is specified, it defines the anchor point for interval calculation. The first execution occurs at `startTime`; subsequent executions occur at `startTime + N × interval` for integer N ≥ 1. If `startTime` is in the past, the runtime MUST compute the next future occurrence from the anchor without replaying missed intervals. If `startTime` is absent, the first execution SHOULD occur one `interval` after schema deployment.

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

When `pageSize` is absent from the resolved pagination configuration, implementations MUST apply the default `pageSize` of 20.

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

### Provider Interface

A secret provider MUST implement at minimum:

1. **`resolve(name, meta)`** — return the secret value or fail with `AUTH_SECRET_RESOLUTION`
2. **`healthCheck()`** — return provider availability status

When a `SecretRef` references an unregistered `provider`, resolution MUST fail with `AUTH_SECRET_RESOLUTION` and a message identifying the unknown provider. Implementations SHOULD support provider failover: when a provider's `healthCheck` fails, a configured fallback provider MAY be attempted before returning an error.

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

Validate all outbound URLs:

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

#### DNS Rebinding Prevention

After DNS resolution passes the blocked-range check, implementations MUST connect to the **resolved IP address** directly. The hostname MUST NOT be re-resolved between validation and TCP connection. This prevents DNS rebinding attacks where a hostname resolves to a permitted IP during validation but to a blocked IP on the subsequent connection attempt.

#### Transport Security

All outbound connector URLs (`endpoint`, `rootEndpoint`, `uri`, `feedUrl`, etc.) carrying credentials or sensitive data SHOULD use `https`. For SQL connectors, TLS SHOULD be required unless the connection target is `localhost` or a Unix socket. For LDAP connectors, `ldaps://` or `startTls: true` SHOULD be used. Mutual TLS (mTLS) is RECOMMENDED for service-to-service connector communications in production deployments.

---

## Row Security Enforcement

> **§ Normative**

When `table.rowSecurity` is configured, the runtime MUST enforce row-level access control on every data operation.

### Pipeline Position

The full data access pipeline order is:

1. **Partition resolution** — route to correct data location
2. **Tenancy enforcement** — filter/route by tenant
3. **`table.filter`** — security boundary; excluded rows MUST never be observable (SEC-001)
4. **`table.rowSecurity`** — per-operation access control (read/create/update/delete)
5. **`view.filter`** / per-export `filter` — additive filtering (not a security boundary)

`table.filter` is the primary security boundary and MUST be enforced at the earliest user-uncontrollable point after tenancy. `rowSecurity` provides operation-specific access control evaluated after `table.filter`.

### Per-Operation Semantics

| Operation | Condition            | Behavior                                                                                                                                                        |
| --------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read      | `rowSecurity.read`   | Rows failing the condition MUST be silently excluded from results. They MUST NOT appear in list responses, search results, export output, or pagination totals. |
| Create    | `rowSecurity.create` | Evaluate condition against the proposed row. If falsy, reject with `AUTH_FORBIDDEN`.                                                                            |
| Update    | `rowSecurity.update` | Evaluate condition against the existing row. If falsy, reject with `AUTH_FORBIDDEN`.                                                                            |
| Delete    | `rowSecurity.delete` | Evaluate condition against the existing row. If falsy, reject with `AUTH_FORBIDDEN`.                                                                            |

### Evaluation Rules

- When a `rowSecurity` property is a static `false`, the operation MUST be denied for all rows.
- When a `rowSecurity` property is absent or static `true`, no restriction is applied for that operation.
- When a `rowSecurity` property is a `RowCondition`, it MUST be evaluated per-row with the current row field values and the authenticated user context (via `{"record": "user"}`).
- Calculated fields MUST be evaluated before `rowSecurity` conditions that reference them. If a calculated field depends on `{"record": "user"}` and the user context is null, the calculated field evaluates to null, and the row security condition receives that null value.
- Condition evaluation errors MUST be treated as falsy (deny access) and logged as warnings.

### Bulk and Batch Interactions

- Bulk actions: `rowSecurity` MUST be evaluated per-row. Rows failing the condition MUST be skipped (not cause batch failure).
- Atomic batches: if any row fails `rowSecurity`, the entire batch MUST be rejected with `AUTH_FORBIDDEN`.

### Export and API Enforcement

All export pathways MUST enforce `rowSecurity.read`. Exports MUST NOT expose rows excluded by `rowSecurity.read` under any circumstances.

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

### Export Enforcement

Tenancy MUST be enforced on all export pathways. The tenant identifier MUST be resolved using the same `tenancy.identifier` configuration as direct operations. For exports with their own `auth` block, the tenant identifier is resolved from the export request context (headers, JWT claims, or query parameters as configured). An export request without a valid tenant identifier on a `strict`-enforcement table MUST be rejected.

---

## Partition Behavior

> **§ Normative**

Data routed across partition locations by JSON Logic conditions.
Partitions share parent field structure but may override `connector` and/or `path`.

### Pipeline Order

1. Partition resolution (union reads / route writes)
2. Tenancy enforcement
3. `table.filter` (security boundary)
4. `table.rowSecurity` (per-operation access control)
5. `view.filter` / per-export `filter` (additive filtering)
6. Return result

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

### Upload Protocol

The upload endpoint MUST validate file constraints (`formats`, `maxSize`, `pattern`, `encodings`) before persisting. Constraint violations MUST be rejected with the appropriate `VALIDATION_FILE_*` error code.

For `multipart/form-data`, each file part MUST include a `Content-Disposition` header with a `filename` parameter. The runtime MUST NOT trust client-supplied MIME types alone; content-type detection MUST be performed on the file content (e.g., magic byte inspection).

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

### Default Value Application

Default values MUST be applied at the following points:

1. **Form initialization** — when rendering a new-row form, evaluate `defaultValue` and populate the field. If `defaultValue` is a `RowCondition`, evaluate with an empty row context (no field values yet). Condition errors MUST be treated as `null`.
2. **Server-side create** — when processing a create operation, if a field with `defaultValue` is absent from the payload, apply the default. If present in the payload, the submitted value takes precedence.
3. **Interaction with `required`** — `required` validation MUST be evaluated after default value application. A field with a `defaultValue` that resolves to a non-empty value satisfies `required`.

### Field Constraint Validation

Field constraints (`minLength`, `maxLength`, `pattern`, `min`, `max`, `step`, `enum`) MUST be enforced on create and update operations. Constraint violations MUST return `VALIDATION_FIELD_CONSTRAINT` with the field ID in the error details.

All implementation MUST validate all constraints, including when the runtime is divided between front and back ends. Constraints on calculated fields MUST NOT be enforced (calculated values are derived, not user-supplied).

### Accessible Field Enforcement

When `field.accessible` is `false` (or a `RowCondition` evaluating to falsy):

- The field MUST be omitted from all read responses (list, get, export, API)
- The field MUST be omitted from write request schemas
- Submitted values for inaccessible fields MUST be silently discarded
- Calculated fields MAY reference inaccessible fields internally; the result is included if the calculated field itself is accessible
- Inaccessible fields MUST be excluded from search indexes and search results
- Inaccessible fields MUST still be captured in audit logs if the field is within `audit.fields` scope
- Inaccessible fields MUST NOT cause errors when referenced in conditions; they resolve to `null`

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

### Row Security Interaction

Format rules MUST only be evaluated against rows that pass `rowSecurity.read`. Rows excluded by row security MUST NOT be evaluated for format rule conditions. Excluded rows MUST NOT be counted in pagination totals. Format rule conditions MUST NOT leak information about filtered rows (e.g., conditional styling that reveals the existence of hidden rows).

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

### Reference Traversal Rules

- **Null references**: when a reference field is null, traversal MUST return `null` (not error). Downstream operators receiving null MUST treat it as absent.
- **Maximum depth**: implementations MUST support traversal. Traversal beyond the maximum depth MUST return `null` and log a warning. Maximum depth MUST default to 5 levels and MAY differ between runtimes.
- **Circular references**: implementations MUST detect circular reference chains and terminate traversal returning `null`. Circular references MUST NOT cause infinite loops.
- **One-to-many cardinality**: `{"var": "refField.prop"}` resolves the single referenced row. For collections, use the `related` operator instead.

### Operators

| Operator  | Returns                                                        |
| --------- | -------------------------------------------------------------- |
| `related` | Array of rows from table where reference points to current row |
| `table`   | All rows from specified table                                  |
| `record`  | First matching row from record definition, or null             |

### Reserved `user` Record

When `auth` configured, `{"record": "user"}` resolves to authenticated user's row.
`{"record": "user.fieldId"}` for specific field.

### Record Resolution Lifecycle

- **Resolution timing**: record definitions MUST be resolved per-request. Within a single request, the same record definition MUST return a consistent result.
- **Caching**: implementations MAY cache record lookup results within the scope of a single request. Cross-request caching MUST respect the underlying table's data freshness requirements.
- **Null result**: when no row matches a record's `condition`, the `record` operator returns `null`. Downstream references to fields on a null record MUST resolve to `null` without error.
- **Multiple matches**: when multiple rows match, the implementation MUST return the first matching row in the table's default sort order. This behavior MUST be deterministic.

### Calculated Fields in Exports

Calculated fields MUST be included in export read responses (list, get, query operations). Calculated fields MUST be marked as read-only in generated schemas (e.g., `readOnly: true` in OpenAPI, non-nullable output fields in GraphQL). Calculated fields MUST NOT appear in request/input schemas for create or update operations. When export `response.fields` selection is used, calculated fields are eligible for inclusion or exclusion like any other field.

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
- `COMPENSATION_FAILED` — compensation action exhausted all retries
- `INTERNAL_LOCK_LOST` — distributed lock lost during execution

### Error Messages

Must be actionable, specific, and safe (no secrets or internal paths).

### HTTP Status Code Mapping

Implementations exposing HTTP APIs MUST map error codes to HTTP status codes as follows:

| Error Code Pattern               | HTTP Status                 | Description                                |
| -------------------------------- | --------------------------- | ------------------------------------------ |
| `VALIDATION_*`                   | `400 Bad Request`           | Input validation failures                  |
| `AUTH_UNAUTHORIZED`              | `401 Unauthorized`          | Missing or invalid credentials             |
| `AUTH_FORBIDDEN`                 | `403 Forbidden`             | Authenticated but insufficient permissions |
| `AUTH_TOKEN_EXPIRED`             | `401 Unauthorized`          | Expired authentication token               |
| `AUTH_ACCOUNT_LOCKED`            | `403 Forbidden`             | Account locked due to failed attempts      |
| `AUTH_SECRET_RESOLUTION`         | `500 Internal Server Error` | Secret provider failure                    |
| `NOT_FOUND_*`                    | `404 Not Found`             | Missing resource                           |
| `CONFLICT_DUPLICATE_KEY`         | `409 Conflict`              | Uniqueness constraint violation            |
| `CONFLICT_STALE_UPDATE`          | `409 Conflict`              | Optimistic concurrency failure             |
| `SCHEMA_*`                       | `500 Internal Server Error` | Schema configuration errors                |
| `COMPAT_*`                       | `500 Internal Server Error` | Version compatibility errors               |
| `INTERNAL_*`                     | `500 Internal Server Error` | Server errors                              |
| `INTERNAL_TIMEOUT`               | `504 Gateway Timeout`       | Upstream timeout                           |
| `INTERNAL_CONNECTOR_UNAVAILABLE` | `503 Service Unavailable`   | Connector circuit breaker open             |
| `INTERNAL_LOCK_LOST`             | `500 Internal Server Error` | Distributed lock lost during execution     |
| `COMPENSATION_FAILED`            | `500 Internal Server Error` | Compensation action exhausted all retries  |
| `RATE_LIMITED`                   | `429 Too Many Requests`     | Rate limit exceeded                        |

The response body MUST conform to the `ErrorResponse` schema regardless of the HTTP status code. Export-specific error formats MUST include the `ErrorResponse.code` and `ErrorResponse.message` fields mapped into the protocol-native error structure.

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

Lock acquisition MUST use a configurable timeout (default: 30s). If the lock cannot be acquired within the timeout, the workflow's `concurrency.onLimit` policy applies. Locks MUST be renewed at `TTL/2` intervals for long-running workflows. Stale locks (holder crashed) MUST expire at TTL and become acquirable by other instances.

#### Fencing Tokens

Each lock acquisition MUST produce a monotonically increasing fencing token. Workflow actions that perform mutations through connectors supporting fencing (e.g., database transactions, conditional writes) SHOULD include the fencing token to prevent stale lock holders from applying out-of-order mutations after a network partition. Implementations MUST detect when a lock is lost mid-execution (renewal failure) and MUST halt the workflow with an `INTERNAL_LOCK_LOST` error rather than continue with potentially stale state.

Polling uses a separate lock namespace: `poll-lock:{connectorId}:{tableId}`. On leader failure, the lock TTL expiry enables automatic failover. The new leader MUST NOT replay missed poll intervals; it resumes from the next scheduled poll.

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

## Export Auth Enforcement

> **§ Normative**

When an export `auth` block is present, the runtime MUST enforce the following sequence on every inbound request to the export endpoint:

1. **Credential verification** — attempt to resolve the credential for the configured `type` (`apikey`, `jwt`, `oauth2`). Invalid credentials (malformed token, bad signature, revoked key) MUST be rejected immediately. Absent credentials (no credential supplied) are allowed to proceed to the next step.
2. **Accessible check** — if `auth.accessible` is present, evaluate the `RowCondition` against the caller context (equivalent to `{"record": "user"}`). If the condition evaluates falsy, the request MUST be rejected. If `auth.accessible` is absent, requests with absent credentials are rejected at this point.
3. **Data access** — proceed to serve data. `table.filter`, `rowSecurity`, and per-export `filter` conditions still apply.

The `accessible` condition is a strict gate: it is evaluated _after_ credential verification and _before_ any data access. It MUST NOT be bypassed by caching or short-circuit evaluation.

When `auth.type` is `none`, `accessible` is still evaluated if present. The normal rule applies: the request is denied only if the condition resolves falsy; a truthy result allows the request through regardless of caller context.

### Auth Composition with Application Auth

Export auth is **independent** of application-level `auth`. An export's `auth` block is the sole authentication mechanism for that export endpoint. Application-level auth methods (password, OIDC, SAML, etc.) do not apply to export endpoints unless the export explicitly configures equivalent credentials.

A `{ "type": "none" }` export auth intentionally makes the endpoint publicly accessible. When the underlying tables have `rowSecurity` or `table.filter` conditions referencing user context (`{"record": "user"}`), these conditions MUST evaluate with a null user context for unauthenticated export requests. When `accessible` itself references `{"record": "user"}` and the user context is null, the condition MUST evaluate as falsy (deny access), and the export MUST return `AUTH_FORBIDDEN`. Implementations SHOULD warn at schema load time when `auth.type` is `"none"` on exports referencing tables with user-context security conditions.

### Export Data Pipeline

All export types MUST enforce the following data pipeline on every request:

1. **Export auth** — verify credentials per the export's `auth` block
2. **Tenancy** — resolve and enforce tenant isolation per `table.tenancy`
3. **`table.filter`** — security boundary; excluded rows never observable
4. **`table.rowSecurity.read`** — per-operation access control
5. **Per-export `filter`** — apply the export-specific filter condition
6. **Field accessibility** — omit fields where `field.accessible` is falsy
7. **Response shaping** — apply `response.fields`/`exclude` if configured

This pipeline MUST be applied identically regardless of export type.

---

## File Export Behavior

> **§ Normative**

Exposes table data as serialized files.

### Path Resolution

Full path: `{endpoint}{path}`.
Format selected by file extension mapping to allowed MIME types.

### Security Enforcement

File exports MUST enforce the full export data pipeline: tenancy, `table.filter` (security boundary), `rowSecurity.read`, and per-path `filter`. Only rows passing all conditions are included in the exported file.

### Filter

`filter` RowCondition combined with `table.filter` via AND.

### Encoding

Applied for text formats; ignored for binary.

---

## OpenAPI Export Behavior

> **§ Normative**

Exposes tables as REST API with auto-generated OpenAPI document.

### Security Enforcement

OpenAPI exports MUST enforce the full export data pipeline: tenancy, `table.filter`, `rowSecurity`, and per-resource `filter`. Write operations (`create`, `update`, `replace`, `delete`) MUST enforce the corresponding `rowSecurity` operation condition.

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

## GraphQL Export Behavior

> **§ Normative**

Exposes selected tables as a GraphQL API.

### Endpoint

Served at the configured `endpoint` path. Accepts queries via POST (default) or the configured `method`. Introspection queries MUST be supported.

### Schema Generation

The runtime MUST generate a GraphQL schema from the export's table mappings:

- Each table mapping produces an object type named by `typeName`
- Fields derive from accessible, non-file table fields. Calculated fields MUST be included as non-nullable output fields.
- Reference fields produce nested object types following the reference chain
- List queries (`queryField`) return a connection type with pagination
- Single queries (`singleQueryField`) accept the primary key as argument
- Mutations (`createX`, `updateX`, `deleteX`) are generated per `mutations` configuration

### Query Execution

1. Parse and validate the GraphQL query
2. Resolve each field against the export data pipeline (tenancy → `table.filter` → `rowSecurity.read` → field accessibility)
3. Apply pagination for list queries
4. Return data in standard GraphQL response format `{ "data": ... }`

### Error Format

GraphQL errors MUST follow the GraphQL specification error format with `message`, `locations`, and `path` fields. The `extensions` object MUST include the SchemaFX `code` from `ErrorCode`.

### Security Enforcement

GraphQL exports MUST enforce the full export data pipeline. Write mutations MUST enforce the corresponding `rowSecurity` operation condition.

---

## OData Export Behavior

> **§ Normative**

Exposes selected tables as an OData service.

### Service Documents

- Service document served at `{endpoint}`
- Metadata document served at `{endpoint}/$metadata`
- Both MUST be regenerated on schema change

### Schema Generation

The runtime MUST generate CSDL metadata from the export's table mappings:

- Each table mapping produces an entity type named by `entityTypeName` and entity set named by `entitySetName`
- Field types map to OData EDM types
- Primary key fields are declared as entity keys
- Reference fields produce navigation properties

### System Query Options

Implementations MUST support the following OData system query options:

| Query Option     | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| `$select`        | Field projection                                                            |
| `$filter`        | Row filtering (combined with `rowSecurity.read` and `table.filter` via AND) |
| `$orderby`       | Sort specification                                                          |
| `$top` / `$skip` | Offset-based pagination                                                     |
| `$count`         | Include total count in response                                             |
| `$expand`        | Inline related entities (depth limited per reference traversal rules)       |

### Error Format

Errors MUST conform to OData JSON error format: `{ "error": { "code": "<ErrorCode>", "message": "..." } }`.

### Security Enforcement

OData exports MUST enforce the full export data pipeline. Write operations MUST enforce the corresponding `rowSecurity` operation condition.

---

## SPARQL Export Behavior

> **§ Normative**

Exposes selected tables as a SPARQL endpoint serving RDF data.

### Endpoint

Query endpoint at the configured `endpoint` path. Update endpoint at `updateEndpoint` (defaults to query endpoint).

### RDF Mapping

The runtime MUST map table rows to RDF triples:

- Subject IRI: constructed from `subjectTemplate` (RFC 6570) using row field values, or auto-generated from the table key and primary key
- Predicate: RDF predicate URIs from the `fields` mapping
- Object: field values serialized as RDF literals with appropriate XSD datatypes
- Class assertion: `<subject> rdf:type <classUri>` for each row

### Query Execution

1. Parse SPARQL query
2. Match triple patterns against the RDF mapping
3. Apply the export data pipeline (tenancy → `table.filter` → `rowSecurity.read`)
4. Return results in SPARQL Query Results format (JSON or XML)

### Update Operations

When write operations are enabled (`insert`, `update`, `delete`), the runtime MUST:

- Parse SPARQL Update requests
- Map triple patterns back to row operations
- Enforce `rowSecurity` for the corresponding operation
- Require `updateEndpoint` configuration for write-enabled exports (EXP-012)

### Pagination

SPARQL result sets MUST support `LIMIT` and `OFFSET`. Default limit MUST be applied when the query has no explicit `LIMIT` (default: 1000 rows).

### Security Enforcement

SPARQL exports MUST enforce the full export data pipeline.

---

## SOAP Export Behavior

> **§ Normative**

Exposes selected tables as a SOAP web service.

### WSDL Generation

The runtime MUST auto-generate a WSDL document served at `{endpoint}?wsdl`:

- Target namespace from export configuration
- XSD complex types derived from table fields per `typeName` mappings
- WSDL operations generated per `operations` configuration (e.g., `GetAllProduct`, `GetProduct`, `CreateProduct`)
- SOAP binding version per `soapVersion`

### Operation Execution

1. Parse SOAP envelope
2. Dispatch to the operation matching the SOAPAction header or first body element
3. Resolve row data via the export data pipeline (tenancy → `table.filter` → `rowSecurity`)
4. Serialize response as SOAP envelope with XSD-typed elements

### Fault Format

SOAP faults MUST include the SchemaFX `ErrorCode` in the fault detail element: `<detail><errorCode>NOT_FOUND_RECORD</errorCode><message>...</message></detail>`.

### Security Enforcement

SOAP exports MUST enforce the full export data pipeline. Write operations MUST enforce the corresponding `rowSecurity` operation condition.

---

## RSS Export Behavior

> **§ Normative**

Exposes a table as an RSS or Atom feed.

### Feed Generation

The runtime MUST generate a feed document conforming to RSS or Atom (per `format`) at the configured `endpoint`:

- Channel/feed metadata from `channel` configuration, falling back to `app` metadata
- Feed items mapped from table rows via the `fields` mapping
- Items sorted by `sort` configuration (default: descending by `pubDate` field)
- Item count limited by `maxItems` (default: 20)

### Item Mapping

| RSS Element   | Atom Element          | Source                                                                  |
| ------------- | --------------------- | ----------------------------------------------------------------------- |
| `title`       | `title`               | `fields.title` field value                                              |
| `link`        | `link[rel=alternate]` | `fields.link` field value                                               |
| `description` | `summary`             | `fields.description` field value                                        |
| `pubDate`     | `published`           | `fields.pubDate` field value (ISO 8601 → RFC 822 for RSS)               |
| `guid`        | `id`                  | `fields.guid` or `fields.link`                                          |
| `author`      | `author`              | `fields.author` field value                                             |
| `category`    | `category`            | `fields.category` field value                                           |
| `enclosure`   | `link[rel=enclosure]` | `fields.enclosureUrl`, `fields.enclosureType`, `fields.enclosureLength` |

### Security Enforcement

RSS exports MUST enforce the full export data pipeline: tenancy, `table.filter`, `rowSecurity.read`, and per-export `filter`.

---

## Export Pagination

> **§ Normative**

Pagination requirements vary by export protocol:

| Export Type | Pagination Mechanism                                  | Default Limit                               |
| ----------- | ----------------------------------------------------- | ------------------------------------------- |
| OpenAPI     | `page`/`pageSize` query parameters                    | `defaultPageSize` (25), `maxPageSize` (100) |
| GraphQL     | Connection pattern (`first`/`after`, `last`/`before`) | 25                                          |
| OData       | `$top`/`$skip` system query options                   | 25                                          |
| SPARQL      | `LIMIT`/`OFFSET` in query                             | 1000                                        |
| SOAP        | Request message parameters (`offset`, `limit`)        | 100                                         |
| Files       | Not paginated (full dataset export)                   | N/A                                         |
| RSS         | `maxItems` configuration                              | 20                                          |

All paginated exports MUST respect `maxPageSize` limits. Client-requested page sizes exceeding the maximum MUST be clamped. Exports MUST NOT return unbounded result sets; a default limit MUST always be applied.

---

## Connector Runtime Behavior

> **§ Normative**

### SQL Connector

SQL connectors translate table operations to SQL statements:

- **Read**: `SELECT` with `WHERE` clause derived from filters, tenancy, and row security
- **Create**: `INSERT` with parameterized values. MUST use parameterized queries; string concatenation of user values is forbidden.
- **Update**: `UPDATE` with `WHERE` on primary key. OCC token included in `WHERE` when configured.
- **Delete**: `DELETE` with `WHERE` on primary key.
- **Type mapping**: field types map to SQL types per dialect. Implementations MUST handle dialect-specific differences (e.g., `BOOLEAN` vs `TINYINT(1)`, `TEXT` vs `VARCHAR`).
- **Timeout**: connection timeout default 30s, query timeout default 60s. Both MUST be configurable.
- **Connection pooling**: SQL connectors SHOULD maintain a connection pool. When pooling is implemented, pool parameters (`minConnections`, `maxConnections`, `idleTimeout`, `maxLifetime`) MUST be configurable. Pool exhaustion MUST return `INTERNAL_CONNECTOR_ERROR` after a configurable wait timeout.

### GraphQL Connector

GraphQL connectors execute operations via the configured endpoint:

- **Read (LIST/GET)**: execute the bound `operation` as a `query`. Apply `variables` substitutions. Extract results via `resultPath`.
- **Write (POST/UPDATE/PATCH/DELETE)**: execute the bound `operation` as a `mutation`. Map row field values to mutation variables.
- **Error handling**: GraphQL responses with `errors` array MUST be mapped to `INTERNAL_CONNECTOR_ERROR`. Individual field errors SHOULD be mapped to `VALIDATION_*` codes when possible.
- **Timeout**: request timeout default 30s.

### OData Connector

OData connectors interact with OData v4 services:

- **Read**: `GET {rootEndpoint}/{entitySet}` with `$select`, `$expand`, `$filter` as configured
- **Create**: `POST {rootEndpoint}/{entitySet}` with JSON entity body
- **Update**: `PATCH {rootEndpoint}/{entitySet}({key})` for partial update
- **Delete**: `DELETE {rootEndpoint}/{entitySet}({key})`
- **Type coercion**: OData EDM types MUST be mapped to SchemaFX field types

### SPARQL Connector

SPARQL connectors query RDF endpoints:

- **Read**: construct `SELECT` queries using field-to-predicate mappings from `fields`. Apply `classUri` as `rdf:type` filter.
- **Write**: construct `INSERT DATA` / `DELETE INSERT WHERE` using the field-to-predicate mappings. Require `updateEndpoint`.
- **Subject resolution**: use `subjectTemplate` to construct or match subject IRIs
- **Type coercion**: XSD datatypes MUST be mapped to SchemaFX field types

### SOAP Connector

SOAP connectors invoke WSDL-defined operations:

- **Operation dispatch**: match table CRUD operation to the configured SOAP `operation` name
- **Request construction**: serialize row data as SOAP XML body elements per the WSDL message schema
- **Response parsing**: extract results via `resultPath` from the SOAP response body
- **Fault handling**: SOAP Faults MUST be mapped to `INTERNAL_CONNECTOR_ERROR`

### RSS Connector

RSS/Atom connectors are read-only:

- **Read**: fetch feed from `feedUrl`, parse items, map fields via `fields` configuration
- **Item extraction**: apply `itemPath` JSONPath to locate the items array in the parsed feed
- **Write operations**: MUST be rejected with `INTERNAL_CONNECTOR_ERROR` (RSS is read-only per CON-011)

### Files Connector

File connectors interact with the local file system:

- **Read**: scan `basePath` for files matching `pattern`, parse per `formats`
- **Write**: serialize row data to file at the path determined by `table.path`
- **Path security**: file paths MUST be normalized and validated against `basePath`. Path traversal (`../`) MUST be rejected.
- **Encoding**: read/write using configured `encodings`

### Connector Timeout and Retry

HTTP-based connectors MUST support:

- **Connection timeout**: maximum time to establish a connection
- **Request timeout**: maximum time for a complete request/response cycle

Timeout values MUST be configurable. Timeouts MUST result in `INTERNAL_TIMEOUT` error code.

Connector-level retry (via `retryPolicy` on the connector) is independent of workflow-level retry. When both are configured, connector retry is attempted first; if all connector retries fail, the failure propagates to the workflow retry policy.

---

## Execution Context

> **§ Normative**

Workflows, conditions, and expressions operate within an execution context that provides data for variable resolution.

### Context Shape

| Key                     | Type        | Available When      | Description                                                   |
| ----------------------- | ----------- | ------------------- | ------------------------------------------------------------- |
| Row field IDs           | any         | Row context present | Current row field values keyed by `field.id`                  |
| `user`                  | object/null | `auth` configured   | Authenticated user's row (equivalent to `{"record": "user"}`) |
| Named records           | object/null | `records` defined   | Record lookup results keyed by record ID                      |
| `item` (or `config.as`) | any         | Inside `for_each`   | Current iteration item                                        |
| `index`                 | integer     | Inside `for_each`   | Current iteration index (0-based)                             |
| Branch results          | object      | After `parallel`    | Results keyed by branch `id`                                  |
| `$trigger`              | object      | Workflow execution  | Trigger event data (`table`, `action`, `id`, `row`)           |

### Context Isolation

- **Parallel branches**: each branch receives a read-only copy of the parent context. Branches MUST NOT mutate the parent context. Writes within a branch are visible only to subsequent actions in that branch.
- **For-each iterations**: each iteration receives the parent context plus the `item` and `index` bindings. Iterations MUST NOT mutate the parent context.
- **Sub-workflows** (`run_workflow`): the sub-workflow receives a copy of the invoking context. Changes in the sub-workflow MUST NOT propagate back to the caller.
- **Condition/switch branches**: branches share the parent context. This differs from parallel branches because condition/switch is sequential.

### Context Mutation Rules

Actions producing results (e.g., `run_operation`, `http_callback`) MUST make their result available via their action `id` in the context for subsequent actions. For example, after action `fetch-data` completes, `{"var": "fetch-data.result"}` resolves to the action's return value.

---

## Authentication Flows

> **§ Normative**

When `auth` is configured, the runtime MUST implement authentication flows for each configured method.

### Common Flow

All authentication methods share this outer flow:

1. **Rate limiting** — if `auth.rateLimit` configured, check attempts within window. Exceeding limit returns `RATE_LIMITED`.
2. **Method dispatch** — route to the appropriate method handler based on request (credential type, endpoint, etc.)
3. **Credential verification** — method-specific validation (see per-method flows below)
4. **Account status** — verify the user's `active` field (if configured via `userFields.active`). Inactive accounts MUST be rejected with `AUTH_FORBIDDEN`.
5. **MFA check** — if `auth.mfa` configured and enforcement condition met, initiate MFA flow
6. **Session issuance** — create session per `auth.session` configuration
7. **Audit** — log authentication event if `auth.audit` configured

### Password Authentication

1. Look up user by `userFields.identifier`
2. Check lockout status (see Account Lockout)
3. Verify submitted password against stored `userFields.passwordHash` using configured `algorithm` (`bcrypt` or `argon2`)
4. On failure: increment failed attempt counter, return `AUTH_UNAUTHORIZED` (MUST NOT reveal whether identifier or password was wrong)
5. On success: reset failed attempt counter (if `lockout.resetOnSuccess`), check `maxAge` for password expiry
6. Proceed to account status check

### JWT Authentication

1. Extract Bearer token from `Authorization` header
2. Decode JWT header, verify `alg` is in configured `algorithms`
3. For asymmetric algorithms: fetch JWKS from `jwksUrl`, verify signature
4. For HMAC algorithms: verify signature using `secret`
5. Validate claims: `iss` MUST match `issuer`, `aud` MUST match `audience` (if configured), `exp` MUST be in the future
6. Map claims to user fields via `claimMappings`
7. Look up or provision user

### OIDC Authentication

1. Redirect user to the OIDC provider's authorization endpoint with configured `scopes` and `redirectUri`
2. If `pkce` enabled, generate code verifier and challenge (using `pkceMethod`)
3. On callback: exchange authorization code for tokens at the provider's token endpoint
4. Validate the ID token (signature, `iss`, `aud`, `exp`, `nonce`)
5. Map claims via `claimMappings`
6. If `autoProvision` and user not found: create user row from mapped claims (AUTH-007: `identifier` MUST be in mappings)
7. Proceed to account status check

### SAML Authentication

1. Build SAML AuthnRequest (sign if `signAuthnRequests` is true)
2. Redirect to IdP `ssoUrl`
3. On ACS callback: validate SAML Response signature using `certificate`
4. If `wantEncryptedAssertions`: decrypt using `spPrivateKey`
5. Validate assertion conditions (`NotBefore`, `NotOnOrAfter`, `Audience`) with `allowedClockDrift` tolerance
6. Extract attributes, map via `attributeMappings`
7. If `autoProvision` and user not found: create user row

### LDAP Authentication

1. Connect to LDAP server at `url` (apply `startTls` if configured)
2. Bind with service account (`bindDn` / `bindPassword`)
3. Search for user: substitute `{{username}}` into `userFilter` with RFC 4515 escaping (AUTH-029), search under `baseDn` with configured `searchScope`
4. If no results: return `AUTH_UNAUTHORIZED`
5. Attempt bind with user's DN and submitted password
6. On failure: return `AUTH_UNAUTHORIZED`
7. On success: map LDAP attributes to user fields

### API Key Authentication

1. Extract key from configured `headerName` header (or query parameter per `location`)
2. Hash the submitted key
3. Look up in `keyTable` by `keyFields.key`
4. Verify `keyFields.active` is true (if configured)
5. Verify `keyFields.expiresAt` is in the future (if configured)
6. Resolve associated user via `keyFields.user` reference
7. Proceed to account status check

### FIDO2/WebAuthn Authentication

1. **Registration**: generate challenge, send to client with RP configuration, verify attestation response, store credential in `credentialTable`
2. **Authentication**: generate challenge with allowed credentials for user, verify assertion response (signature, `signCount` increment), update `signCount`
3. Credential lookup via `credentialFields` mappings

### TOTP Authentication

1. During enrollment: generate shared secret, present as QR code (using `issuer`), verify initial code
2. During verification: compute expected TOTP using `algorithm`, `digits`, `period`. Accept codes within `window` drift tolerance.
3. Recovery codes (if `recoveryCodes` enabled): each code is single-use

### SMS-OTP / Email-OTP Authentication

1. Look up delivery address from `phoneField` / `emailField`
2. Generate code (`digits` digits) or link (for email-otp `mode: "link"`)
3. Set expiry per `expiry` configuration
4. On verification: validate code/link, enforce `maxAttempts` per code
5. Expired or exhausted codes MUST return `AUTH_UNAUTHORIZED`

### OAuth2 Client Credentials

1. Extract Bearer token from `Authorization` header
2. If `jwksUrl` configured: validate JWT signature and claims (`iss`, `aud`, `exp`, configured `algorithms`)
3. If `introspectionUrl` configured: POST to introspection endpoint with `introspectionClientId`/`introspectionClientSecret`, verify `active: true`
4. Extract client identity from `clientIdentityClaim`
5. Map claims via `claimMappings`

---

## MFA Flow

> **§ Normative**

When `auth.mfa` is configured, multi-factor authentication extends the primary authentication flow.

### Enforcement

MFA is required when:

- `mfa.enforce.default` is `true`, OR
- `mfa.enforce.condition` evaluates truthy against the authenticated user's row

When MFA is not required, the user MAY still opt in if enrolled.

### Flow Execution

1. After primary authentication succeeds, check enforcement condition
2. If MFA required and user is enrolled: present configured `flows` (ordered by priority). The user selects a flow and completes each `factor` sequentially.
3. If MFA required and user is NOT enrolled: require enrollment before granting access. The user MUST complete enrollment for at least one flow.
4. Each factor references a method `id` from `auth.methods`. The method's authentication flow is executed as a verification step.
5. All factors in the selected flow MUST succeed. Failure at any factor MUST reject the authentication.

### Remember Device

When `mfa.rememberDevice.enabled` is true:

- After successful MFA, the user MAY opt to trust the current device
- Trusted device token MUST be cryptographically bound to the user and device fingerprint
- Token valid for `rememberDevice.duration`
- Maximum trusted devices enforced per `rememberDevice.maxDevices` (oldest revoked on overflow)
- On subsequent authentication from a trusted device, MFA MAY be skipped

---

## Session Lifecycle

> **§ Normative**

When `auth.session` is configured, the runtime MUST manage session state through the following lifecycle.

### Session States

| State       | Description                                                                |
| ----------- | -------------------------------------------------------------------------- |
| `created`   | Session issued after successful authentication (including MFA if required) |
| `active`    | Session is valid and in use                                                |
| `refreshed` | Session extended via refresh (if `refreshable: true`)                      |
| `expired`   | Session exceeded `timeout` (idle) or `maxDuration` (absolute)              |
| `revoked`   | Session explicitly invalidated (logout, password change, admin action)     |

### State Transitions

- `created` → `active`: immediate on issuance
- `active` → `refreshed`: on refresh token exchange (if `refreshable` and within `maxDuration`)
- `active` → `expired`: when `timeout` or `maxDuration` exceeded
- `active`/`refreshed` → `revoked`: on explicit logout, password change (if session not exempt), or admin revocation
- `expired` → (terminal): cannot be refreshed or reactivated

### Stateful vs Stateless

- **Stateful** (`mode: "stateful"`): session state stored in `session.table`. Session identifier MUST be regenerated after authentication (AUTH-018).
- **Stateless** (`mode: "stateless"`): session encoded in JWT. Revocation via `statelessRevocation` strategy (`none` or `blocklist`). AUTH-018 does not apply to stateless sessions (no server-side identifier exists); instead, the JWT MUST be freshly issued on each authentication — pre-existing tokens MUST NOT be reused across authentication events. Blocklist entries MUST be automatically purged once the associated JWT's `exp` claim has passed; implementations MUST NOT allow unbounded blocklist growth.

### Concurrent Session Enforcement

When `maxConcurrentSessions` is configured, creating a new session that exceeds the limit MUST revoke the oldest active session for that user.

### Refresh Token Rotation

When `refreshTokenRotation` is true, each refresh MUST issue a new refresh token and invalidate the previous one. Reuse of an invalidated refresh token MUST revoke all sessions for that user (potential token theft).

---

## Account Recovery Flow

> **§ Normative**

When `auth.recovery` is configured, the runtime MUST implement the account recovery flow.

### Flow

1. **Request** — user submits recovery request (identifier only). Rate-limited per `recovery.rateLimit` (default: 5/hour). Response MUST NOT reveal whether the account exists.
2. **Token generation** — generate a cryptographically random recovery token. Store hashed token with expiry (`recovery.tokenExpiry`, default: 1 hour).
3. **Delivery** — send token via configured `method`:
    - `email`: send reset link/code to the email resolved from `userFields.email` or `userFields.identifier`
    - `sms`: send code to the phone resolved from `recovery.phoneField`
    - `admin`: no token generated; admin manually resets
4. **Validation** — user submits token. Verify: not expired, attempt count within `recovery.maxAttempts`, hash matches.
5. **Password reset** — if `recovery.requirePasswordChange` is true (default), user MUST set new password. New password MUST satisfy password rules and history constraints.
6. **Completion** — invalidate recovery token, invalidate all existing sessions for the user.

---

## Account Lockout

> **§ Normative**

When `auth.methods[].lockout` is configured for a password method, the runtime MUST enforce account lockout.

### State Machine

| State      | Description                      |
| ---------- | -------------------------------- |
| `unlocked` | Normal authentication flow       |
| `locked`   | Authentication attempts rejected |

### Transitions

- `unlocked` → `locked`: consecutive failed attempts reach `lockout.maxAttempts`
- `locked` → `unlocked`: `lockout.duration` elapses, OR admin unlock
- On successful authentication (when `lockout.resetOnSuccess` is true): reset failed attempt counter to zero

### Error Response

Locked accounts MUST receive `AUTH_ACCOUNT_LOCKED`. The error response MUST NOT reveal the lockout reason to prevent account enumeration (AUTH-019). The response MUST be indistinguishable from a normal `AUTH_UNAUTHORIZED` response in timing and content for external observers.

---

## Slice Behavior

> **§ Normative**

Slices are filtered projections of a base table. They share the base table's data, connector, and security configuration.

### Projection Semantics

- When `slice.columns` is specified, only those fields are accessible through the slice. Fields not in `columns` are treated as if `accessible: false` for operations via this slice.
- When `slice.columns` is absent, all base table fields are accessible.
- `slice.additionalFields` are overlay calculated fields available only through this slice.

### Filter Stacking

The slice's `filter` is combined with the base table's `filter` via logical AND. The combined filter order is:

1. Base table `table.filter` (security boundary)
2. Base table `rowSecurity`
3. Slice `filter` (additive restriction)

### Write Routing

Write operations (create, update, delete) through a slice MUST be applied to the base table. The slice's `filter` MUST be enforced: created rows that would not match the slice filter MUST be rejected. Updates that would cause a row to no longer match the slice filter MUST be rejected.

### Action Overlay

- `slice.actions`: only these actions from the base table are exposed
- `slice.additionalActions`: available only through this slice, evaluated against the base table's row context
- Action conditions are evaluated with the full base table row, not the projected slice columns

### Audit and Triggers

Audit entries and data triggers fire on the base table, not the slice. The `entity_table` in audit entries MUST reference the base table key.

---

## View Type Behavior

> **§ Normative**

### Table View

Table views display rows in a tabular list. Fields are rendered in the order specified by `config.fields`. Pagination is controlled by the view's `pagination` override or the table-level default. The view's `filter` is combined with `table.filter` via AND.

### Form View

Form views render fields for creating or editing a row:

- Fields are rendered in `config.fields` order
- Calculated fields MUST be displayed as read-only (no input control)
- Field conditions (`required`, `editable`, `show`, `accessible`) MUST be evaluated against the current row state
- On submit: validate all field constraints server-side, then persist. Validation failures MUST return `VALIDATION_FAILED` with per-field `details`.

### Detail View

Detail views render a single row in read-only format. Fields in `config.fields` are displayed in order. Calculated fields, reference fields (resolved to display label), and all field formatting MUST be applied.

### Dashboard View

Dashboard views compose multiple views into sections:

- Sections are rendered in array order
- Each section's `viewIds` are rendered according to `layout` (`grid`, `stack`, `row`)
- Each embedded view fetches data independently
- An error in one section's view MUST NOT prevent other sections from rendering
- Dashboard views have no table reference; security is enforced by each embedded view's own table

### Group View

Group views compose multiple views sequentially:

- Views are rendered in `viewIds` order
- `direction` controls layout (`horizontal` or `vertical`)
- Each view operates independently with its own data and security context
- Exact visual rendering (tabs, accordion, side-by-side) is implementation-defined

---

## View Accessibility Enforcement

> **§ Normative**

When `view.accessible` evaluates to `false`:

- The view MUST NOT appear in navigation menus or view listings
- Direct access to the view (by URL or ID) MUST behave as if the view does not exist (return `NOT_FOUND_VIEW`)
- Views embedded in dashboards or groups where `accessible` is falsy MUST be omitted from the composition
- The `accessible` condition MUST be evaluated server-side; client-side enforcement alone is insufficient
- Condition evaluation errors MUST be treated as falsy (deny access)
- When `accessible` is absent or `true`, the view is accessible to all users

---

## Default View Resolution

> **§ Normative**

The `app.defaultView` property determines the initial view on application startup.

### Resolution Algorithm

1. If `defaultView` is a static view ID: navigate to that view. If the view does not exist or is not accessible, fall through to step 3.
2. If `defaultView` is a `JsonLogicRule`: evaluate against the current user context (`{"record": "user"}`). The result MUST be a valid view ID. If evaluation fails or the result is not a valid accessible view, fall through to step 3.
3. **Fallback**: navigate to the first view (in definition order) where `view.accessible` evaluates truthy.
4. If no accessible view exists, the runtime MUST present an error state (not a blank screen).

---

## Internationalization Resolution

> **§ Normative**

When `i18n` is configured, the runtime MUST resolve localized strings for all `LocalizedString` values.

### Locale Negotiation

1. Extract requested locale from the `Accept-Language` HTTP header (or equivalent client signal)
2. Match against `i18n.supportedLocales` using BCP 47 matching (exact match first, then language-only match)
3. If no match: use `i18n.fallbackLocale` (if configured), then `i18n.defaultLocale`

### String Resolution

For each `LocalizedString` encountered:

1. If the value is a plain string: use as-is for all locales
2. If the value is a locale map: look up the negotiated locale key. If absent, try language-only key (e.g., `fr` for `fr-FR`). If still absent, use `_default`.
3. Missing translations MUST fall back to `_default`. A missing `_default` is a schema error (structural validation).

### Scope

Locale resolution applies to: view names, field names, field descriptions, action names, error messages (`LocalizedString` in confirmText, etc.), and branding text. Locale resolution MUST NOT alter field values or data content.

---

## Structured Logging

> **§ Normative**

Conformant runtimes MUST emit structured log entries for all significant operations. Log entries MUST be machine-parseable (JSON or equivalent structured format).

### Required Fields

Every log entry MUST include:

| Field           | Type     | Description                                              |
| --------------- | -------- | -------------------------------------------------------- |
| `timestamp`     | datetime | ISO 8601 with timezone                                   |
| `level`         | string   | `ERROR`, `WARN`, `INFO`, or `DEBUG`                      |
| `correlationId` | string   | Request-scoped identifier for tracing related operations |
| `component`     | string   | Subsystem emitting the log (e.g., `workflow`, `auth`)    |
| `message`       | string   | Human-readable description                               |

Additional contextual fields (e.g., `workflowId`, `connectorId`, `tableId`, `ruleId`) SHOULD be included where applicable.

### Severity Mapping

| Spec Language                  | Log Level |
| ------------------------------ | --------- |
| "MUST reject" / error response | `ERROR`   |
| "log warning" / SHOULD report  | `WARN`    |
| Operational event              | `INFO`    |
| Diagnostic detail              | `DEBUG`   |

### Log Scrubbing

Resolved `SecretRef` values MUST NOT appear in log output. Auth credentials, tokens, passwords, and connection strings MUST be redacted to `[REDACTED]`. Audit log `before_state`/`after_state` MUST redact fields whose values originated from `SecretRef` resolution.

Workflow execution context MUST NOT be logged at `INFO` or lower severity with resolved secret values. `DEBUG`-level context dumps MUST still redact secrets.

---

## Runtime Metrics

> **§ Normative**

Conformant runtimes MUST emit the following metrics. Metric names use dot notation; implementations MAY translate to their platform's convention (e.g., OpenTelemetry, Prometheus).

### Required Metrics

| Metric Name                                | Type      | Labels                   | Description                                           |
| ------------------------------------------ | --------- | ------------------------ | ----------------------------------------------------- |
| `schemafx.request.duration`                | histogram | `table`, `operation`     | Data operation duration                               |
| `schemafx.connector.request.duration`      | histogram | `connector`, `operation` | Connector call duration                               |
| `schemafx.connector.errors`                | counter   | `connector`, `errorCode` | Connector error count                                 |
| `schemafx.workflow.duration`               | histogram | `workflow`, `trigger`    | Workflow execution duration                           |
| `schemafx.workflow.errors`                 | counter   | `workflow`, `errorCode`  | Workflow error count                                  |
| `schemafx.auth.attempts`                   | counter   | `method`, `result`       | Auth attempt count (success/failure)                  |
| `schemafx.export.request.duration`         | histogram | `export`, `type`         | Export request duration                               |
| `schemafx.connector.pool.active`           | gauge     | `connector`              | Active connections (SQL connectors)                   |
| `schemafx.workflow.queue.depth`            | gauge     | `workflow`               | Queued workflow instances (`onLimit: queue`)          |
| `schemafx.poll.lag`                        | gauge     | `connector`, `table`     | Seconds since last successful poll                    |
| `schemafx.lock.acquire.duration`           | histogram | `lockType`               | Distributed lock acquisition time                     |
| `schemafx.connector.circuit_breaker.state` | gauge     | `connector`              | Circuit breaker state (0=closed, 1=half-open, 2=open) |
| `schemafx.secret.resolution.errors`        | counter   | `provider`               | Secret resolution failure count                       |
| `schemafx.session.active`                  | gauge     |                          | Active session count                                  |

### Distributed Tracing

HTTP-based connector calls and HTTP callbacks MUST propagate trace context via W3C Trace Context headers (`traceparent`, `tracestate`). Workflow executions MUST carry a `traceId` spanning the full execution tree including sub-workflows.

---

## Connector Health

> **§ Normative**

Conformant runtimes MUST monitor connector availability and implement circuit-breaker behavior per connector.

### Circuit Breaker States

| State       | Behavior                                                           |
| ----------- | ------------------------------------------------------------------ |
| `closed`    | Normal operation; track failure count                              |
| `open`      | Reject requests immediately with `INTERNAL_CONNECTOR_UNAVAILABLE`  |
| `half-open` | Allow a single probe request; success → `closed`, failure → `open` |

### Configuration

- `failureThreshold` — consecutive failures before opening (default: 5)
- `resetInterval` — time in `open` state before transitioning to `half-open` (default: 30s)

Timeout errors (`INTERNAL_TIMEOUT`) MUST count toward the `failureThreshold`. `VALIDATION_*` errors MUST NOT count (they indicate client errors, not connector health issues).

### Partial Availability

When a connector is unavailable, tables bound to that connector MUST return `INTERNAL_CONNECTOR_UNAVAILABLE`. Tables on healthy connectors MUST continue operating. Views referencing unavailable tables MUST degrade gracefully — display an error state for that section without failing the entire view. Dashboard sections MUST render independently per existing dashboard error isolation requirements.

---

## Schema Reload

> **§ Normative**

Conformant runtimes MUST support schema reload without process restart.

### Reload Semantics

- In-flight workflows MUST complete under the schema version they started with.
- New requests after reload MUST use the new schema.
- Connector pool reconfiguration MUST be graceful: drain old connections over a configurable timeout before closing.
- Schema validation (structural + semantic) MUST pass before the new schema becomes active. Validation failure MUST leave the previous schema in effect and emit an `ERROR` log.
- During reload, the health endpoint MUST report `degraded` until the new schema is fully active.

### Multi-Instance Coordination

In distributed deployments, all instances SHOULD converge to the same schema version within a bounded time window. During transitions, the health endpoint SHOULD include the active `schemaVersion` in its response to enable load balancers and orchestrators to detect version skew. Instances running different schema versions concurrently MUST still honor forward/backward compatibility rules as defined in [Versioning.md](Versioning.md).

---

## Graceful Shutdown

> **§ Normative**

On shutdown signal, the runtime MUST:

1. Stop accepting new requests (health readiness → `down`).
2. Complete in-flight workflows within a configurable drain timeout (default: 30s).
3. Release all distributed locks.
4. Close connector connections gracefully.
5. Flush pending audit log entries.

Workflows exceeding the drain timeout MUST be logged as incomplete with sufficient context for manual recovery. The incomplete workflow log entry MUST include: `workflowId`, `triggerId`, `correlationId`, the last successfully completed action ID, the pending action ID, the full execution context at the point of interruption, and the compensation stack (if `transaction: "compensate"`). This information enables operators to perform manual recovery or automated replay.

---

## Secret Rotation

> **§ Normative**

Resolved `SecretRef` values MUST NOT be cached indefinitely. Runtimes MUST re-resolve secrets at a configurable interval (default TTL: 300s).

On connector authentication failure, the runtime MUST re-resolve the connector's `SecretRef` credentials and retry once before returning `AUTH_SECRET_RESOLUTION`. This enables transparent secret rotation without runtime restart.

---

## Configuration Options

> **§ Normative** (defaults), **§ Informative** (tuning guidance)

Conformant runtimes MUST use the following defaults unless explicitly overridden by operator configuration. Runtimes MUST validate all configuration options at startup and MUST reject invalid values (negative timeouts, zero thresholds, malformed durations) with a clear error preventing startup.

| Option                      | Default  | Normative Default |
| --------------------------- | -------- | ----------------- |
| Scheduling mode             | `single` | No                |
| Webhook DNS timeout         | 2000 ms  | Yes               |
| Notification buffer size    | 100      | No                |
| Secret resolution cache TTL | 300 s    | Yes               |
| Circuit breaker threshold   | 5        | Yes               |
| Circuit breaker reset       | 30 s     | Yes               |
| Shutdown drain timeout      | 30 s     | Yes               |
| SQL connection timeout      | 30 s     | No                |
| SQL query timeout           | 60 s     | No                |
| HTTP connector timeout      | 30 s     | No                |
