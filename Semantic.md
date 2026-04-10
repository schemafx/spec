# SchemaFX Semantic Specification

Semantic validation rules enforced at schema load time. See [schema.schema.json](schema.schema.json) for structural validation, [Runtime.md](Runtime.md) for runtime behavior, and [Versioning.md](Versioning.md) for versioning rules.

Keywords are per RFC 2119/8174. ERROR rules MUST be enforced, WARNING SHOULD be reported, INFO MAY be reported.

Rule tables include a **Since** column for the version in which the rule was introduced. See [Version-Aware Rule Enforcement](#version-aware-rule-enforcement).

## Rule Categories

| Category              | Description                                      | Phase      |
| --------------------- | ------------------------------------------------ | ---------- |
| Referential Integrity | Cross-entity references resolve to valid targets | 2–5        |
| Uniqueness            | Identifiers unique within their scope            | 2–5        |
| Type Consistency      | Values match expected types                      | 2–4        |
| Logical Invariants    | Constraints between related properties           | 2–5        |
| Circular Dependencies | Circular references detected and rejected        | 6          |
| Security              | Access constraints enforced before observation   | Runtime    |
| Tenancy               | Multi-tenant isolation on table data             | 3, Runtime |
| Partitioning          | Partition routing and condition validation       | 3, Runtime |
| Internationalization  | Locale configuration and string resolution       | 2, Runtime |
| Application           | Top-level application configuration constraints  | 2, Runtime |

---

## Connector Rules

| ID      | Description                                                                                                             | Sev     | Since       |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| CON-001 | Connector keys MUST be unique                                                                                           | ERROR   | 0.0.1-alpha |
| CON-002 | `auth` with `SecretRef` values requires registered `provider`                                                           | ERROR   | 0.0.1-alpha |
| CON-003 | `config.type` MUST be a registered connector handler                                                                    | ERROR   | 0.0.1-alpha |
| CON-004 | `sql` connectors: `dialect` MUST be supported, `uri` MUST be present without scheme or credentials                      | ERROR   | 0.0.1-alpha |
| CON-005 | Plaintext secrets SHOULD use `SecretRef`                                                                                | WARNING | 0.0.1-alpha |
| CON-006 | `openapi` connectors: `tables` required with operation bindings                                                         | ERROR   | 0.0.1-alpha |
| CON-007 | `other` connectors: `name` MUST be non-empty (OPTIONAL support)                                                         | WARNING | 0.0.1-alpha |
| CON-008 | `poll.interval` MUST be valid ISO 8601 duration, non-zero positive                                                      | ERROR   | 0.0.1-alpha |
| CON-009 | `oauth2`: `serviceAccountEmail` and `privateKey` MUST both be present or absent                                         | ERROR   | 0.0.1-alpha |
| CON-010 | `oauth2`: `impersonateUser` requires service account credentials                                                        | ERROR   | 0.0.1-alpha |
| CON-011 | `rss` connectors: `feedUrl` MUST be valid URL; read-only                                                                | ERROR   | 0.0.1-alpha |
| CON-012 | `sparql` connectors: table entries, field mappings, `classUri` MUST be valid                                            | ERROR   | 0.0.1-alpha |
| CON-013 | `sparql`: unmapped tables rely on inference (NOT RECOMMENDED)                                                           | WARNING | 0.0.1-alpha |
| CON-014 | `soap` connectors: `tables` required with valid table references                                                        | ERROR   | 0.0.1-alpha |
| CON-015 | `resultPath` MUST be valid JSONPath (RFC 9535) starting with `$`                                                        | ERROR   | 0.0.1-alpha |
| CON-016 | `graphql` connectors: valid table refs, `operation` non-empty                                                           | ERROR   | 0.0.1-alpha |
| CON-017 | `graphql`: unmapped tables rely on inference (NOT RECOMMENDED)                                                          | WARNING | 0.0.1-alpha |
| CON-018 | `odata` connectors: table refs valid, `entitySet` non-empty                                                             | ERROR   | 0.0.1-alpha |
| CON-019 | `odata`: unmapped tables rely on inference (NOT RECOMMENDED)                                                            | WARNING | 0.0.1-alpha |
| CON-020 | `rss`: field mappings valid, `itemPath` MUST be valid JSONPath                                                          | ERROR   | 0.0.1-alpha |
| CON-021 | HTTP-based connectors MUST support configurable connection and request timeout                                          | ERROR   | 0.0.1-alpha |
| CON-022 | SQL connectors MUST use parameterized queries; string concatenation of user values is forbidden                         | ERROR   | 0.0.1-alpha |
| CON-023 | All outbound connector URLs (`endpoint`, `rootEndpoint`, `jwksUrl`, etc.) MUST be subject to SSRF validation at runtime | ERROR   | 0.0.1-alpha |

---

## Table Rules

| ID      | Description                                                                                                          | Sev     | Since       |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| TBL-001 | Table keys MUST be unique                                                                                            | ERROR   | 0.0.1-alpha |
| TBL-002 | `table.connector` MUST reference an existing connector                                                               | ERROR   | 0.0.1-alpha |
| TBL-003 | `table.primary` field(s) MUST exist in the table                                                                     | ERROR   | 0.0.1-alpha |
| TBL-004 | `table.label` MUST reference a valid field                                                                           | ERROR   | 0.0.1-alpha |
| TBL-005 | Field IDs within a table MUST be unique                                                                              | ERROR   | 0.0.1-alpha |
| TBL-006 | Primary key field(s) SHOULD have `required: true`                                                                    | WARNING | 0.0.1-alpha |
| TBL-007 | Action IDs within a table MUST be unique                                                                             | ERROR   | 0.0.1-alpha |
| TBL-008 | Reference field `config.table` MUST exist                                                                            | ERROR   | 0.0.1-alpha |
| TBL-009 | Self-referential reference fields MAY be used for hierarchical data                                                  | INFO    | 0.0.1-alpha |
| TBL-010 | `table.poll.interval` MUST be valid ISO 8601 duration, non-zero positive; takes precedence over connector-level poll | ERROR   | 0.0.1-alpha |
| TBL-011 | `table.path` segments MUST match connector type requirements                                                         | ERROR   | 0.0.1-alpha |
| TBL-012 | `table.filter` MUST be a valid `RowCondition`, enforced before row access                                            | ERROR   | 0.0.1-alpha |

---

## Optimistic Concurrency Rules

Applies when `table.concurrency` is present. Updates and deletes MUST include a staleness check.

| ID      | Description                                                               | Sev     | Since       |
| ------- | ------------------------------------------------------------------------- | ------- | ----------- |
| OCC-001 | `concurrency.versionField` MUST reference a valid field                   | ERROR   | 0.0.1-alpha |
| OCC-002 | Version field type: `integer` for `version` strategy, `string` for `etag` | ERROR   | 0.0.1-alpha |
| OCC-003 | `versionField` MUST NOT be a primary key field                            | ERROR   | 0.0.1-alpha |
| OCC-004 | Version field is implementation-managed; `editable: true` NOT RECOMMENDED | WARNING | 0.0.1-alpha |

---

## Partition Rules

Applies to entries within `table.partitions`.

| ID      | Description                                                                         | Sev   | Since       |
| ------- | ----------------------------------------------------------------------------------- | ----- | ----------- |
| PRT-001 | Partition IDs within a table MUST be unique                                         | ERROR | 0.0.1-alpha |
| PRT-002 | `partition.condition` MUST be a valid `RowCondition` with valid field refs          | ERROR | 0.0.1-alpha |
| PRT-003 | `partition.connector` (if specified) MUST reference an existing connector           | ERROR | 0.0.1-alpha |
| PRT-004 | `partition.path` MUST follow connector path conventions (see TBL-011)               | ERROR | 0.0.1-alpha |
| PRT-005 | Compound operators SHOULD be preferred for complex partitioning                     | INFO  | 0.0.1-alpha |
| PRT-006 | On read: query matching partitions, union results, exclude matching main table rows | ERROR | 0.0.1-alpha |
| PRT-007 | On create: route to first matching partition, else main table                       | ERROR | 0.0.1-alpha |
| PRT-008 | On update/delete: locate record across all partitions and apply correctly           | ERROR | 0.0.1-alpha |
| PRT-009 | Order: partition → tenancy → `table.filter` → `rowSecurity` → `view.filter`         | ERROR | 0.0.1-alpha |
| PRT-010 | `partition.poll` precedence: partition > table > connector                          | ERROR | 0.0.1-alpha |

---

## Format Rules

Applies to `table.formatRules` entries.

| ID      | Description                                                            | Sev   | Since       |
| ------- | ---------------------------------------------------------------------- | ----- | ----------- |
| FMT-001 | `condition` MUST be a valid `RowCondition` with valid field refs       | ERROR | 0.0.1-alpha |
| FMT-002 | `columns` entries MUST reference valid fields                          | ERROR | 0.0.1-alpha |
| FMT-003 | `style` MUST have at least one styling property                        | ERROR | 0.0.1-alpha |
| FMT-004 | Format rules are presentation-only; no effect on persistence/filtering | INFO  | 0.0.1-alpha |

---

## Action Rules

| ID      | Description                                                                                                       | Sev     | Since       |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| ACT-001 | `add_row` action `view` MUST reference a valid form view                                                          | ERROR   | 0.0.1-alpha |
| ACT-002 | `edit_row` action `view` MUST reference a valid form view                                                         | ERROR   | 0.0.1-alpha |
| ACT-003 | `copy_row` action `view` MUST reference a valid form view                                                         | ERROR   | 0.0.1-alpha |
| ACT-004 | Navigate actions: `protocol` MUST be allowed scheme, `address` MUST resolve non-empty; dangerous schemes rejected | ERROR   | 0.0.1-alpha |
| ACT-005 | Grouped actions: all IDs MUST be valid in the same table                                                          | ERROR   | 0.0.1-alpha |
| ACT-006 | Grouped actions MUST NOT create circular groupings                                                                | ERROR   | 0.0.1-alpha |
| ACT-007 | `run_workflow` action `workflow` MUST reference existing workflow                                                 | ERROR   | 0.0.1-alpha |
| ACT-008 | `other` actions: `name` MUST be non-empty (OPTIONAL support)                                                      | WARNING | 0.0.1-alpha |
| ACT-009 | `copy_row` action `fields` MUST reference valid field IDs                                                         | ERROR   | 0.0.1-alpha |
| ACT-010 | `action.condition` MUST be a valid `RowCondition`                                                                 | ERROR   | 0.0.1-alpha |
| ACT-011 | Navigate action `placeholder` values MUST reference valid fields                                                  | ERROR   | 0.0.1-alpha |
| ACT-012 | Bulk actions: referenced action MUST be row-level (`edit_row`, `copy_row`, `delete`, `navigate`, `run_workflow`)  | ERROR   | 0.0.1-alpha |
| ACT-013 | Bulk actions: circular references rejected                                                                        | ERROR   | 0.0.1-alpha |
| ACT-014 | Bulk action `maxItems` MUST be positive integer                                                                   | ERROR   | 0.0.1-alpha |
| ACT-015 | Bulk action `condition` MUST be valid `RowCondition` with valid field refs                                        | ERROR   | 0.0.1-alpha |

---

## View Rules

| ID      | Description                                                                                        | Sev     | Since       |
| ------- | -------------------------------------------------------------------------------------------------- | ------- | ----------- |
| VIW-001 | View keys MUST be unique                                                                           | ERROR   | 0.0.1-alpha |
| VIW-002 | `view.table` MUST reference existing table                                                         | ERROR   | 0.0.1-alpha |
| VIW-003 | Table view fields MUST reference valid field IDs                                                   | ERROR   | 0.0.1-alpha |
| VIW-004 | Form view fields MUST reference valid field IDs                                                    | ERROR   | 0.0.1-alpha |
| VIW-005 | Detail view fields MUST reference valid field IDs                                                  | ERROR   | 0.0.1-alpha |
| VIW-006 | Dashboard section `viewIds` MUST reference existing views                                          | ERROR   | 0.0.1-alpha |
| VIW-007 | Group view `viewIds` MUST reference existing views                                                 | ERROR   | 0.0.1-alpha |
| VIW-008 | `view.interactions` action IDs MUST resolve to valid actions in view's table                       | ERROR   | 0.0.1-alpha |
| VIW-009 | Dashboard and group views MUST NOT have circular view references                                   | ERROR   | 0.0.1-alpha |
| VIW-010 | Views without table reference MUST NOT have `interactions`                                         | ERROR   | 0.0.1-alpha |
| VIW-011 | `other` views: `name` MUST be non-empty (OPTIONAL support)                                         | WARNING | 0.0.1-alpha |
| VIW-012 | Vega views: exactly one of `spec` or `specUrl` required                                            | ERROR   | 0.0.1-alpha |
| VIW-013 | Vega views: `table` MUST exist; `signals` keys MUST match spec signal names                        | ERROR   | 0.0.1-alpha |
| VIW-014 | `view.filter` MUST be valid `RowCondition`, applied after `table.filter`; requires table reference | ERROR   | 0.0.1-alpha |
| VIW-015 | `view.accessible` condition controls navigation visibility; defaults to `true`                     | ERROR   | 0.0.1-alpha |
| VIW-016 | `view.position` MUST be non-empty array of unique strings                                          | WARNING | 0.0.1-alpha |
| VIW-017 | `view.accessible` condition evaluation errors MUST be treated as falsy (deny access)               | ERROR   | 0.0.1-alpha |
| VIW-018 | Dashboard/group views MUST omit embedded views where `accessible` evaluates falsy                  | ERROR   | 0.0.1-alpha |

---

## Workflow Rules

| ID      | Description                                                                                                                                   | Sev     | Since       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| WFL-001 | Workflow keys MUST be unique                                                                                                                  | ERROR   | 0.0.1-alpha |
| WFL-002 | Data trigger `config.table` MUST reference existing table                                                                                     | ERROR   | 0.0.1-alpha |
| WFL-003 | Manual trigger `config.table` MUST reference existing table                                                                                   | ERROR   | 0.0.1-alpha |
| WFL-004 | Schedule trigger `config.interval` MUST be valid ISO 8601 duration                                                                            | ERROR   | 0.0.1-alpha |
| WFL-005 | `run_action` step `config.table` MUST reference existing table                                                                                | ERROR   | 0.0.1-alpha |
| WFL-006 | `run_action` step `config.action` MUST reference valid action                                                                                 | ERROR   | 0.0.1-alpha |
| WFL-007 | `run_operation` step `config.connector` MUST reference existing connector                                                                     | ERROR   | 0.0.1-alpha |
| WFL-008 | `run_operation` step `config.operationId` MUST be non-empty                                                                                   | ERROR   | 0.0.1-alpha |
| WFL-009 | `other` triggers: `name` MUST be non-empty (OPTIONAL support)                                                                                 | WARNING | 0.0.1-alpha |
| WFL-010 | `run_workflow` step: `config.workflow` MUST exist; circular invocations rejected                                                              | ERROR   | 0.0.1-alpha |
| WFL-011 | `other` actions: `name` MUST be non-empty (OPTIONAL support)                                                                                  | WARNING | 0.0.1-alpha |
| WFL-012 | Condition steps: `config.condition` valid, `config.then` non-empty, nested IDs unique                                                         | ERROR   | 0.0.1-alpha |
| WFL-013 | Switch steps: `config.expression` valid, cases non-empty with unique primitives, nested IDs unique                                            | ERROR   | 0.0.1-alpha |
| WFL-014 | ForEach steps: `config.items` evaluates to array, `config.as` valid identifier, nested IDs unique                                             | ERROR   | 0.0.1-alpha |
| WFL-015 | Parallel steps: 2+ branches, unique branch IDs, unique nested action IDs                                                                      | ERROR   | 0.0.1-alpha |
| WFL-016 | Retry policies: `maxAttempts` 1–10, `delay` valid duration, `backoff` valid strategy                                                          | ERROR   | 0.0.1-alpha |
| WFL-017 | Error handlers: `strategy` valid; `goto` target MUST reference valid action ID                                                                | ERROR   | 0.0.1-alpha |
| WFL-018 | Error handler `goto` MUST reference forward action only                                                                                       | ERROR   | 0.0.1-alpha |
| WFL-019 | Workflow action IDs MUST be globally unique across entire tree                                                                                | ERROR   | 0.0.1-alpha |
| WFL-020 | Workflow `maxInstances` positive integer; `onLimit` valid strategy                                                                            | ERROR   | 0.0.1-alpha |
| WFL-021 | Trigger `maxConcurrent` positive integer; `onLimit` valid strategy                                                                            | ERROR   | 0.0.1-alpha |
| WFL-022 | Callback steps: valid URL, allowed method, `secretHeaders` as `SecretRef`                                                                     | ERROR   | 0.0.1-alpha |
| WFL-023 | `workflow.accessible` condition controls triggerability; defaults to `true`                                                                   | ERROR   | 0.0.1-alpha |
| WFL-024 | HTTP callback URLs MUST NOT resolve to private/reserved IPs. DNS resolution required before connecting (see runtime spec SSRF Protection)     | ERROR   | 0.0.1-alpha |
| WFL-025 | `workflow.transaction: "all_or_nothing"` MUST NOT span actions targeting different connectors; use `compensate` for cross-connector workflows | ERROR   | 0.0.1-alpha |

---

## Audit Rules

| ID      | Description                                                                                            | Sev     | Since       |
| ------- | ------------------------------------------------------------------------------------------------------ | ------- | ----------- |
| AUD-001 | `audit.destinationTable` MUST reference existing table                                                 | ERROR   | 0.0.1-alpha |
| AUD-002 | Destination table MUST have: `action`, `entity_table`, `entity_id`, `timestamp`                        | ERROR   | 0.0.1-alpha |
| AUD-003 | `captureState` `before`/`both`: destination MUST have `before_state` field                             | ERROR   | 0.0.1-alpha |
| AUD-004 | `captureState` `after`/`both`: destination MUST have `after_state` field                               | ERROR   | 0.0.1-alpha |
| AUD-005 | `audit.fields` MUST reference valid field IDs                                                          | ERROR   | 0.0.1-alpha |
| AUD-006 | `audit.condition` MUST be valid `RowCondition`                                                         | ERROR   | 0.0.1-alpha |
| AUD-007 | `audit.destinationTable` MUST NOT reference containing table                                           | ERROR   | 0.0.1-alpha |
| AUD-008 | Circular audit chains rejected                                                                         | ERROR   | 0.0.1-alpha |
| AUD-009 | Audit destination tables SHOULD be append-only; `update` and `delete` on audit records NOT RECOMMENDED | WARNING | 0.0.1-alpha |

---

## Auth Rules

| ID       | Description                                                                                                                            | Sev     | Since       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| AUTH-001 | `auth.userTable` MUST exist and contain all `userFields`                                                                               | ERROR   | 0.0.1-alpha |
| AUTH-002 | `userFields.identifier` MUST exist; SHOULD be unique                                                                                   | ERROR   | 0.0.1-alpha |
| AUTH-003 | Password auth: `userFields.passwordHash` required as string                                                                            | ERROR   | 0.0.1-alpha |
| AUTH-004 | Password auth: at least one algorithm required                                                                                         | ERROR   | 0.0.1-alpha |
| AUTH-005 | JWT auth: `algorithms` required; asymmetric with `jwksUrl`, HMAC with `secret`                                                         | WARNING | 0.0.1-alpha |
| AUTH-006 | LDAP auth: `userFilter` MUST contain `{{username}}` placeholder                                                                        | ERROR   | 0.0.1-alpha |
| AUTH-007 | OIDC/SAML: `autoProvision` requires `identifier` in claim/attribute mappings                                                           | ERROR   | 0.0.1-alpha |
| AUTH-008 | API key auth: `expiresAt` field MUST be datetime                                                                                       | ERROR   | 0.0.1-alpha |
| AUTH-009 | FIDO2: `credentialTable` MUST exist with mapped fields                                                                                 | ERROR   | 0.0.1-alpha |
| AUTH-010 | SMS OTP: `phoneField` MUST reference valid userTable field                                                                             | ERROR   | 0.0.1-alpha |
| AUTH-011 | Email OTP: `emailField` MUST reference valid userTable field                                                                           | ERROR   | 0.0.1-alpha |
| AUTH-012 | Auth method types SHOULD not be duplicated                                                                                             | WARNING | 0.0.1-alpha |
| AUTH-013 | MFA factor types MUST be declared in `auth.methods`                                                                                    | ERROR   | 0.0.1-alpha |
| AUTH-014 | Stateful session mode: `auth.session.table` required                                                                                   | ERROR   | 0.0.1-alpha |
| AUTH-015 | `refreshTokenRotation` requires `refreshable: true`                                                                                    | ERROR   | 0.0.1-alpha |
| AUTH-016 | `auth.audit` destination MUST satisfy AUD-002–AUD-004                                                                                  | ERROR   | 0.0.1-alpha |
| AUTH-017 | Email recovery requires email field via `userFields`                                                                                   | ERROR   | 0.0.1-alpha |
| AUTH-018 | Stateful session identifier MUST be regenerated after auth (session fixation); stateless JWT MUST be freshly issued per authentication | ERROR   | 0.0.1-alpha |
| AUTH-019 | Lockout MUST NOT reveal account existence                                                                                              | ERROR   | 0.0.1-alpha |
| AUTH-020 | `auth.mfa.enforce.condition` MUST be valid with userTable field refs                                                                   | ERROR   | 0.0.1-alpha |
| AUTH-021 | `userFields.role` MUST exist in userTable                                                                                              | ERROR   | 0.0.1-alpha |
| AUTH-022 | Role IDs MUST be unique in `auth.rbac.roles`                                                                                           | ERROR   | 0.0.1-alpha |
| AUTH-023 | Declared roles without `userFields.role` SHOULD warn                                                                                   | WARNING | 0.0.1-alpha |
| AUTH-024 | `rbac.defaultRole` MUST match existing role ID                                                                                         | ERROR   | 0.0.1-alpha |
| AUTH-025 | `registration.defaultRole` MUST match existing role ID                                                                                 | ERROR   | 0.0.1-alpha |
| AUTH-026 | Role `inherits` MUST reference existing roles; circular chains rejected                                                                | ERROR   | 0.0.1-alpha |
| AUTH-027 | Federated role mapping with `autoProvision` requires `userFields.role`                                                                 | ERROR   | 0.0.1-alpha |
| AUTH-028 | Password `algorithm` MUST be `bcrypt` or `argon2`. Weaker algorithms (scrypt, md5, sha\*) MUST be rejected                             | ERROR   | 0.0.1-alpha |
| AUTH-029 | LDAP `userFilter` MUST apply RFC 4515 escaping to `{{username}}` before constructing the filter                                        | ERROR   | 0.0.1-alpha |
| AUTH-030 | OAuth2 JWT Bearer: MUST validate `iss`, `aud`, `exp` claims. Key rotation SHOULD be supported                                          | ERROR   | 0.0.1-alpha |

---

## Extension Rules

| ID      | Description                                                            | Sev   | Since       |
| ------- | ---------------------------------------------------------------------- | ----- | ----------- |
| EXT-001 | Extension keys MUST match `^x-[a-zA-Z0-9][a-zA-Z0-9\/_.-]*$`           | ERROR | 0.0.1-alpha |
| EXT-002 | Reserved namespaces (`x-schemafx`, `x-internal`) not for third parties | ERROR | 0.0.1-alpha |
| EXT-003 | Unknown extension keys MUST be tolerated                               | INFO  | 0.0.1-alpha |
| EXT-004 | Top-level extension takes precedence over inline                       | INFO  | 0.0.1-alpha |

---

## Array Field Rules

| ID      | Description                                   | Sev     | Since       |
| ------- | --------------------------------------------- | ------- | ----------- |
| ARR-001 | `config.subtype` MUST be valid `FieldConfig`  | ERROR   | 0.0.1-alpha |
| ARR-002 | `minItems` MUST be ≤ `maxItems`               | ERROR   | 0.0.1-alpha |
| ARR-003 | `minItems` MUST be non-negative integer       | ERROR   | 0.0.1-alpha |
| ARR-004 | `maxItems` MUST be non-negative integer       | ERROR   | 0.0.1-alpha |
| ARR-005 | Reference subtype MUST resolve to valid table | ERROR   | 0.0.1-alpha |
| ARR-006 | Nesting beyond 3 levels SHOULD warn           | WARNING | 0.0.1-alpha |

---

## Decimal Field Rules

| ID          | Description                                                               | Sev   | Since       |
| ----------- | ------------------------------------------------------------------------- | ----- | ----------- |
| FLD-DEC-001 | `scale` MUST be less than or equal to `precision` when both are specified | ERROR | 0.0.1-alpha |

---

## File Field Rules

| ID      | Description                                                 | Sev     | Since       |
| ------- | ----------------------------------------------------------- | ------- | ----------- |
| FIL-001 | `config.store` MUST reference existing table                | ERROR   | 0.0.1-alpha |
| FIL-002 | Store table MUST have: `name`, `path`, `mimeType`, `size`   | ERROR   | 0.0.1-alpha |
| FIL-003 | `config.formats` MUST be valid MIME types                   | WARNING | 0.0.1-alpha |
| FIL-004 | `config.pattern` MUST be valid regex                        | ERROR   | 0.0.1-alpha |
| FIL-005 | `config.maxSize` MUST be positive integer                   | ERROR   | 0.0.1-alpha |
| FIL-006 | Self-referential file fields valid                          | INFO    | 0.0.1-alpha |
| FIL-007 | `deleteWithRow: true` cascades file deletion                | INFO    | 0.0.1-alpha |
| FIL-008 | File connector `formats` MUST be MIME types, not extensions | WARNING | 0.0.1-alpha |

---

## Row Condition Rules

`RowCondition`: JSON Logic evaluated against row field values.
`BooleanOrCondition`: static boolean or `RowCondition`.
`DefaultValueOrCondition`: static literal or `RowCondition`.

| ID      | Description                                                                                                          | Sev   | Since       |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| CND-001 | `RowCondition` MUST be valid non-empty JSON Logic with operator key                                                  | ERROR | 0.0.1-alpha |
| CND-002 | `var` references MUST be valid field IDs in same table                                                               | ERROR | 0.0.1-alpha |
| CND-003 | `action.condition` evaluated in parent table context; no row = condition met                                         | ERROR | 0.0.1-alpha |
| CND-004 | JSON Logic operators MUST be from the whitelist defined in `JsonLogicRule.propertyNames`. Unknown operators rejected | ERROR | 0.0.1-alpha |

---

## Field Condition Rules

| ID          | Description                                                                                                       | Sev   | Since       |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| FLD-CND-001 | Field-level conditions MUST satisfy CND-001 and CND-002                                                           | ERROR | 0.0.1-alpha |
| FLD-CND-002 | Defaults without row context: `required` false, `nullable` false, `show` true, `editable` true, `accessible` true | ERROR | 0.0.1-alpha |
| FLD-CND-003 | `field.show` false: field hidden but included in writes if valued                                                 | ERROR | 0.0.1-alpha |
| FLD-CND-004 | `field.editable` false: read-only but still included in writes                                                    | ERROR | 0.0.1-alpha |
| FLD-CND-005 | `field.defaultValue` result type MUST match field config type                                                     | INFO  | 0.0.1-alpha |
| FLD-CND-006 | `field.searchable` defaults: true for string/reference, false for others                                          | INFO  | 0.0.1-alpha |
| FLD-CND-007 | `field.accessible` false: absent from all operations, values silently discarded                                   | ERROR | 0.0.1-alpha |

---

## Field Uniqueness Rules

| ID          | Description                                                         | Sev   | Since       |
| ----------- | ------------------------------------------------------------------- | ----- | ----------- |
| FLD-UNQ-001 | `unique: true` rejects duplicates; null exempt                      | ERROR | 0.0.1-alpha |
| FLD-UNQ-002 | `unique` MUST NOT be set on calculated, array, json, or file fields | ERROR | 0.0.1-alpha |
| FLD-UNQ-003 | Primary key fields implicitly unique                                | INFO  | 0.0.1-alpha |

---

## Calculated Field Rules

| ID          | Description                                                                                                                              | Sev   | Since       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| FLD-CAL-001 | `config.calculation` MUST be valid JSON Logic                                                                                            | ERROR | 0.0.1-alpha |
| FLD-CAL-002 | `var` refs MUST resolve; dot-notation follows reference chains                                                                           | ERROR | 0.0.1-alpha |
| FLD-CAL-003 | Calculated fields MUST NOT be `table.primary` or `table.label`                                                                           | ERROR | 0.0.1-alpha |
| FLD-CAL-004 | Calculated fields read-only; submitted values stripped                                                                                   | ERROR | 0.0.1-alpha |
| FLD-CAL-005 | Calculated values NOT persisted; derived at query time                                                                                   | ERROR | 0.0.1-alpha |
| FLD-CAL-006 | Circular calculations rejected at load                                                                                                   | ERROR | 0.0.1-alpha |
| FLD-CAL-007 | `config.format` type MUST NOT be `calculated`                                                                                            | ERROR | 0.0.1-alpha |
| FLD-CAL-008 | `related` refs format: `table_id.reference_field_id`                                                                                     | ERROR | 0.0.1-alpha |
| FLD-CAL-009 | `related` operator returns matching child rows array                                                                                     | ERROR | 0.0.1-alpha |
| FLD-CAL-010 | `table` operator refs MUST be existing table keys                                                                                        | ERROR | 0.0.1-alpha |
| FLD-CAL-011 | `table` operator returns all rows from table                                                                                             | ERROR | 0.0.1-alpha |
| FLD-CAL-012 | Calc-to-calc refs evaluated in topological order                                                                                         | ERROR | 0.0.1-alpha |
| FLD-CAL-013 | `record` refs MUST be valid record key or `"user"` (with auth)                                                                           | ERROR | 0.0.1-alpha |
| FLD-CAL-014 | `record` operator returns first matching row or null                                                                                     | ERROR | 0.0.1-alpha |
| FLD-CAL-015 | Per-row evaluation context. Dependencies resolved in topological order (any valid sort). Source field changes invalidate dependent calcs | ERROR | 0.0.1-alpha |

---

## Record Definition Rules

| ID      | Description                                                                       | Sev   | Since       |
| ------- | --------------------------------------------------------------------------------- | ----- | ----------- |
| REC-001 | Record keys MUST be unique and valid `Identifier`                                 | ERROR | 0.0.1-alpha |
| REC-002 | `records[id].table` MUST reference existing table                                 | ERROR | 0.0.1-alpha |
| REC-003 | `records[id].condition` MUST be valid JSON Logic with table field refs            | ERROR | 0.0.1-alpha |
| REC-004 | Record definitions do not participate in calc field circular dependency detection | INFO  | 0.0.1-alpha |
| REC-005 | Key `"user"` reserved; resolves to authenticated user row when auth configured    | ERROR | 0.0.1-alpha |

---

## String Format Rules

| ID          | Description                                                                         | Sev     | Since       |
| ----------- | ----------------------------------------------------------------------------------- | ------- | ----------- |
| FLD-STR-001 | `config.format` hints input widget; unknown formats treated as plain text           | WARNING | 0.0.1-alpha |
| FLD-STR-002 | `email`, `url`, `phone` formats apply built-in validation unless `pattern` provided | WARNING | 0.0.1-alpha |
| FLD-STR-003 | `format` and `enum` may combine; `enum` takes precedence for allowed values         | INFO    | 0.0.1-alpha |
| FLD-STR-004 | `markdown` and `html` are presentation hints only                                   | INFO    | 0.0.1-alpha |
| FLD-STR-005 | `config.multiline: true` hints multi-line text area                                 | INFO    | 0.0.1-alpha |

---

## Field Mapping Rules

| ID          | Description                                                                                         | Sev     | Since       |
| ----------- | --------------------------------------------------------------------------------------------------- | ------- | ----------- |
| FLD-MAP-001 | `field.source` overrides `field.id` for data source access                                          | ERROR   | 0.0.1-alpha |
| FLD-MAP-002 | `source` MUST NOT be set on calculated fields                                                       | ERROR   | 0.0.1-alpha |
| FLD-MAP-003 | `readTransform` MUST NOT be set on calculated fields                                                | ERROR   | 0.0.1-alpha |
| FLD-MAP-004 | `writeTransform` MUST NOT be set on calculated fields                                               | ERROR   | 0.0.1-alpha |
| FLD-MAP-005 | `readTransform` MUST be valid JSON Logic; result compatible with field type                         | ERROR   | 0.0.1-alpha |
| FLD-MAP-006 | `writeTransform` MUST be valid JSON Logic evaluated against schema row                              | ERROR   | 0.0.1-alpha |
| FLD-MAP-007 | Resolved `source` keys MUST be unique within table                                                  | ERROR   | 0.0.1-alpha |
| FLD-MAP-008 | `readTransform` without `writeTransform` effectively read-only; SHOULD warn if `editable` not false | WARNING | 0.0.1-alpha |

---

## Security Rules

`table.filter` MUST be applied at earliest privileged point.

| ID      | Description                                                                                                                  | Sev     | Since       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| SEC-001 | `table.filter` enforced at earliest user-uncontrollable point; excluded rows never observable                                | ERROR   | 0.0.1-alpha |
| SEC-002 | User-context filter evaluation is supplementary; excluded rows discarded                                                     | ERROR   | 0.0.1-alpha |
| SEC-003 | `view.filter` is NOT a security boundary; use `table.filter` for access                                                      | WARNING | 0.0.1-alpha |
| SEC-004 | `table.filter` re-evaluated per access; caches store filtered results only                                                   | ERROR   | 0.0.1-alpha |
| SEC-005 | `table.filter` AND `view.filter` combined with logical AND. `table.filter` is the security boundary and MUST NOT be weakened | ERROR   | 0.0.1-alpha |

---

## Export Rules

| ID      | Description                                                                                                                  | Sev   | Since       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- | ----------- |
| EXP-001 | Export keys MUST be unique and valid `Identifier`                                                                            | ERROR | 0.0.1-alpha |
| EXP-002 | `files` export paths MUST start with `/`                                                                                     | ERROR | 0.0.1-alpha |
| EXP-003 | Path keys MUST be unique within export                                                                                       | ERROR | 0.0.1-alpha |
| EXP-004 | `files` table refs MUST exist                                                                                                | ERROR | 0.0.1-alpha |
| EXP-005 | `files` formats MUST be valid IANA MIME types with known extensions                                                          | ERROR | 0.0.1-alpha |
| EXP-006 | `files` filter MUST be valid JSON Logic with table field refs                                                                | ERROR | 0.0.1-alpha |
| EXP-007 | `encoding` MUST be allowed value; defaults to `utf-8`                                                                        | ERROR | 0.0.1-alpha |
| EXP-008 | `endpoint` MUST start with `/` and be non-empty                                                                              | ERROR | 0.0.1-alpha |
| EXP-009 | `graphql` tables non-empty; each key MUST reference existing table                                                           | ERROR | 0.0.1-alpha |
| EXP-010 | `odata` tables non-empty; `entitySetName`/`entityTypeName` valid identifiers                                                 | ERROR | 0.0.1-alpha |
| EXP-011 | `sparql` tables non-empty; field mappings, `classUri`, templates valid                                                       | ERROR | 0.0.1-alpha |
| EXP-012 | `sparql` writes require `updateEndpoint` or default update path                                                              | ERROR | 0.0.1-alpha |
| EXP-013 | `soap` tables non-empty; valid identifiers, filter valid JSON Logic                                                          | ERROR | 0.0.1-alpha |
| EXP-014 | `soap` namespace MUST be valid URI; `serviceName` valid identifier                                                           | ERROR | 0.0.1-alpha |
| EXP-015 | `openapi` paths start with `/`; table refs valid                                                                             | ERROR | 0.0.1-alpha |
| EXP-016 | `openapi` response `fields`/`exclude` valid field IDs; no overlap                                                            | ERROR | 0.0.1-alpha |
| EXP-017 | `openapi` filter MUST be valid JSON Logic                                                                                    | ERROR | 0.0.1-alpha |
| EXP-018 | `openapi` `maxPageSize` ≥ `defaultPageSize`; `pageSize` ≤ `maxPageSize`                                                      | ERROR | 0.0.1-alpha |
| EXP-019 | `openapi` version valid; endpoint paths unique                                                                               | ERROR | 0.0.1-alpha |
| EXP-020 | `rss` export `table` MUST reference an existing table                                                                        | ERROR | 0.0.1-alpha |
| EXP-021 | `rss` export all specified `fields.*` values MUST reference valid field IDs in the target table                              | ERROR | 0.0.1-alpha |
| EXP-022 | `rss` export `sort.field` MUST reference a valid field ID in the target table                                                | ERROR | 0.0.1-alpha |
| EXP-023 | `rss` export enclosure: if `enclosureUrl` is set, `enclosureType` MUST also be set                                           | ERROR | 0.0.1-alpha |
| EXP-024 | All paginated exports MUST apply a default page size; unbounded result sets MUST NOT be returned                             | ERROR | 0.0.1-alpha |
| EXP-025 | All export types MUST enforce the full export data pipeline (tenancy → `table.filter` → `rowSecurity` → field accessibility) | ERROR | 0.0.1-alpha |

---

## Tenancy Rules

| ID      | Description                                                                                           | Sev     | Since       |
| ------- | ----------------------------------------------------------------------------------------------------- | ------- | ----------- |
| TEN-001 | `tenancy.strategy` MUST be `row`, `schema`, or `database`                                             | ERROR   | 0.0.1-alpha |
| TEN-002 | `tenancy.identifier` valid with `source` and `key`                                                    | ERROR   | 0.0.1-alpha |
| TEN-003 | `tenancy.column` MUST reference valid field                                                           | ERROR   | 0.0.1-alpha |
| TEN-004 | `strict` enforcement rejects requests without tenant; `permissive` allows unfiltered                  | ERROR   | 0.0.1-alpha |
| TEN-005 | `row` strategy: isolation at earliest point; reads filtered, creates tagged, updates/deletes verified | ERROR   | 0.0.1-alpha |
| TEN-006 | Tenant discriminator column NOT modifiable via update                                                 | ERROR   | 0.0.1-alpha |
| TEN-007 | Multiple tables SHOULD use same `identifier` config                                                   | WARNING | 0.0.1-alpha |

---

## Pagination Rules

| ID      | Description                                                | Sev     | Since       |
| ------- | ---------------------------------------------------------- | ------- | ----------- |
| PAG-001 | View-level pagination takes precedence over table-level    | INFO    | 0.0.1-alpha |
| PAG-002 | Default `pageSize` is 20                                   | INFO    | 0.0.1-alpha |
| PAG-003 | Pagination on non-native connector SHOULD warn (in-memory) | WARNING | 0.0.1-alpha |
| PAG-004 | `keyset` mode requires `keysetFields` with valid field IDs | ERROR   | 0.0.1-alpha |
| PAG-005 | `cursor` mode `cursorField` MUST exist in table            | ERROR   | 0.0.1-alpha |
| PAG-006 | `maxPageSize` MUST be ≥ `pageSize`                         | ERROR   | 0.0.1-alpha |
| PAG-007 | `keyset` on non-native seek SHOULD warn (in-memory)        | WARNING | 0.0.1-alpha |

---

## Slice Rules

| ID      | Description                                                                                            | Sev   | Since       |
| ------- | ------------------------------------------------------------------------------------------------------ | ----- | ----------- |
| SLC-001 | `slice.table` MUST reference existing table                                                            | ERROR | 0.0.1-alpha |
| SLC-002 | `slice.columns` entries MUST be valid base table field IDs                                             | ERROR | 0.0.1-alpha |
| SLC-003 | `slice.actions` entries MUST be valid base table action IDs                                            | ERROR | 0.0.1-alpha |
| SLC-004 | `slice.workflows` entries MUST be existing workflows                                                   | ERROR | 0.0.1-alpha |
| SLC-005 | `slice.filter` MUST be valid `RowCondition` against base table                                         | ERROR | 0.0.1-alpha |
| SLC-006 | `additionalFields` IDs MUST NOT collide with base table or other additions                             | ERROR | 0.0.1-alpha |
| SLC-007 | `additionalActions` IDs MUST NOT collide with base table or other additions                            | ERROR | 0.0.1-alpha |
| SLC-008 | `formatRules` field refs resolve against union of base + additional fields                             | ERROR | 0.0.1-alpha |
| SLC-009 | Writes through a slice MUST be applied to the base table; rows violating slice filter MUST be rejected | ERROR | 0.0.1-alpha |
| SLC-010 | Slice audit entries MUST reference the base table key as `entity_table`                                | ERROR | 0.0.1-alpha |

---

## Row Security Rules

`RowSecurity` defines row-level access control via `BooleanOrCondition`.

| ID      | Description                                                                               | Sev   | Since       |
| ------- | ----------------------------------------------------------------------------------------- | ----- | ----------- |
| RSC-001 | Each property MUST be valid `BooleanOrCondition`                                          | ERROR | 0.0.1-alpha |
| RSC-002 | `rowSecurity.read` false: row silently filtered from results                              | ERROR | 0.0.1-alpha |
| RSC-003 | `rowSecurity.create` fail: reject with `AUTH_FORBIDDEN`                                   | ERROR | 0.0.1-alpha |
| RSC-004 | `rowSecurity.update` false: reject with `AUTH_FORBIDDEN`                                  | ERROR | 0.0.1-alpha |
| RSC-005 | `rowSecurity.delete` false: reject with `AUTH_FORBIDDEN`                                  | ERROR | 0.0.1-alpha |
| RSC-006 | Order: `table.filter` → `rowSecurity` → action/view conditions                            | ERROR | 0.0.1-alpha |
| RSC-007 | Export reads MUST enforce `rowSecurity.read`; writes MUST enforce the operation condition | ERROR | 0.0.1-alpha |
| RSC-008 | Bulk and batch operations MUST evaluate row security per row, not per batch               | ERROR | 0.0.1-alpha |

---

## Internationalization Rules

| ID       | Description                                                                                          | Sev     | Since       |
| -------- | ---------------------------------------------------------------------------------------------------- | ------- | ----------- |
| I18N-001 | `i18n.defaultLocale` MUST be a valid BCP 47 tag                                                      | ERROR   | 0.0.1-alpha |
| I18N-002 | `i18n.fallbackLocale` (if set) MUST be in `i18n.supportedLocales`                                    | ERROR   | 0.0.1-alpha |
| I18N-003 | `i18n.defaultLocale` MUST be in `i18n.supportedLocales` (when `supportedLocales` is present)         | ERROR   | 0.0.1-alpha |
| I18N-004 | `LocalizedString` locale keys SHOULD be in `i18n.supportedLocales`                                   | WARNING | 0.0.1-alpha |
| I18N-005 | `LocalizedString` map values MUST include `_default` key when no `i18n.fallbackLocale` is configured | ERROR   | 0.0.1-alpha |
| I18N-006 | Locale resolution MUST NOT alter field data values                                                   | ERROR   | 0.0.1-alpha |

---

## Application Rules

| ID      | Description                                                                             | Sev   | Since       |
| ------- | --------------------------------------------------------------------------------------- | ----- | ----------- |
| APP-001 | `app.defaultView` (when static string) MUST reference an existing view key              | ERROR | 0.0.1-alpha |
| APP-002 | `app.defaultView` (when condition) MUST be valid JSON Logic                             | ERROR | 0.0.1-alpha |
| APP-003 | `app.defaultView` condition result MUST be a valid view key at runtime                  | ERROR | 0.0.1-alpha |
| APP-004 | If no accessible view exists at runtime, the implementation MUST present an error state | ERROR | 0.0.1-alpha |

---

## Validation Error Format

Each error: `ruleId`, `severity`, `path` (JSON Pointer), `message`. Optional: `expected`, `actual`, `suggestions`.

---

## Validation Execution Order

Validation proceeds in order; phases MUST NOT skip:

1. **Structural** — JSON Schema; reject invalid before proceeding
2. **Connectors** — Validate connector definitions
3. **Tables** — Tables, fields, actions, audit; verify connector refs
4. **Views** — Views; verify table and field refs
5. **Workflows** — Workflows; verify table and action refs
6. **Cross-cutting** — Circular dependency detection

Collect all errors within a phase for batch reporting.

---

## Version-Aware Rule Enforcement

Validation respects schema's `schemaVersion`:

- Rule `Since` ≤ schema version: enforce (per severity)
- Rule `Since` > schema version: skip
- SemVer 2.0.0 precedence within same MAJOR
- Rules at newer MAJOR unreachable (MAJOR mismatch rejected earlier)

### Implementation Requirements

- Maintain machine-readable catalog of rule IDs and `Since` versions
- Compare rule `Since` against `schemaVersion` before enforcement
- Emit INFO diagnostic for skipped rules
- Catalog is single source of truth
