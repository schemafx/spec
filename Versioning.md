# SchemaFX Versioning and Compatibility

Versioning strategy, compatibility guarantees, and schema evolution rules. See [schema.schema.json](schema.schema.json), [Semantic.md](Semantic.md), and [Runtime.md](Runtime.md) for related specifications.

Keywords are interpreted per BCP 14 [RFC 2119] [RFC 8174].

## Table of Contents

- [Version Identification](#version-identification)
- [Semantic Versioning Policy](#semantic-versioning-policy)
- [Compatibility Guarantees](#compatibility-guarantees)
- [Deprecation Policy](#deprecation-policy)
- [Schema Evolution Rules](#schema-evolution-rules)
- [Migration Requirements](#migration-requirements)
- [Compatibility Matrix](#compatibility-matrix)
- [Conformance Levels](#conformance-levels)
- [Specification Document Classification](#specification-document-classification)

---

## Version Identification

- **`schemaVersion`** — REQUIRED. SemVer 2.0.0 string identifying the specification version the document conforms to. This is the authoritative source for all compatibility decisions.
- **`app.version`** — Application version. Independent of the specification version; MUST NOT be used for compatibility decisions.
- **Pre-release versions** (e.g., `2.0.0-alpha.1`) are for proposed changes. MUST NOT be used in production schemas and carry no compatibility guarantees.

---

## Semantic Versioning Policy

SchemaFX follows [Semantic Versioning 2.0.0](https://semver.org/).

### MAJOR — Breaking Changes

- Removal of required properties or entire definition types
- Type changes to existing properties
- Removal of enum values
- Narrowing constraints (optional to required, tightening validation)
- Semantic rules that invalidate previously valid schemas
- Changing the JSON Schema dialect

### MINOR — Additive Changes

Schemas valid under X.Y.Z MUST remain valid under X.(Y+1).0.

- New optional properties or definition types
- New enum values or extension points
- Deprecation of existing features
- Relaxing constraints (required to optional)
- New semantic rules (see [Semantic Rule Evolution](#semantic-rule-evolution))

### PATCH — Non-Breaking Fixes

- Documentation corrections and clarifications
- Regex pattern bug fixes
- Example corrections

---

## Compatibility Guarantees

### Forward Compatibility (processing a newer schema)

- **Same MAJOR, newer PATCH** — MUST accept; fully compatible.
- **Same MAJOR, newer MINOR** — MUST accept; silently ignore unknown properties; MUST warn. Unknown enum values MUST reject only the affected entity while other valid entities continue to function.
- **Newer MAJOR** — MUST reject with a clear error.

Unknown properties from newer MINOR versions MUST be preserved during round-trip serialization and MUST NOT be stripped. [schema.schema.json](schema.schema.json) omits `additionalProperties: false` to support this structurally.

### Backward Compatibility (processing an older schema)

- **Same MAJOR, older PATCH** — MUST accept; fully compatible.
- **Same MAJOR, older MINOR** — MUST accept; apply defaults from [schema.schema.json](schema.schema.json) for missing optional properties; if no default, treat as absent.
- **Older MAJOR** — MUST reject with a clear error and migration guidance.
- **Below minimum supported version** — MUST reject with the minimum version and migration guidance.

Validation MUST be performed against the rules normative at the schema's declared `schemaVersion`. Properties introduced after that version MUST NOT be required. See [Semantic.md - Version-Aware Rule Enforcement](Semantic.md#version-aware-rule-enforcement) for rule versioning details.

---

## Deprecation Policy

Features progress through three stages: **Stable**, **Deprecated**, **Removed**.

- **Stable** — Fully supported and normative.
- **Deprecated** — Still functional; MUST continue to work identically. MUST NOT be removed without being deprecated for at least one full MINOR release cycle. Deprecation notices MUST specify the version deprecated, the planned removal version, and a migration path.
- **Removed** — No longer part of the specification; schemas using it MUST be rejected.

---

## Schema Evolution Rules

### Adding and Removing Properties

- Adding a required property (top-level or on a definition) — MAJOR
- Adding an optional property — MINOR
- Removing any property — MAJOR (MUST follow deprecation lifecycle)

### Modifying Properties

- Widening type — MINOR
- Narrowing type — MAJOR
- Adding enum value — MINOR
- Removing enum value — MAJOR
- Relaxing validation — PATCH or MINOR
- Tightening validation — MAJOR
- Changing default value — MINOR

### Semantic Rule Evolution

New or modified semantic rules MUST update the **Since** column in [Semantic.md](Semantic.md). Existing rules retain their original `Since` value.

- New ERROR-severity rule — MINOR if validating previously undefined behavior; MAJOR if rejecting previously valid schemas
- New WARNING/INFO-severity rule — MINOR
- Removing a semantic rule — MINOR
- Severity ERROR to WARNING — MINOR (relaxation)
- Severity WARNING to ERROR — MAJOR (tightening)

---

## Migration Requirements

When a MAJOR version is released, the specification MUST include:

1. A machine-readable migration manifest listing all breaking changes. The manifest MUST be a JSON document conforming to the following structure:
    - `fromVersion` (SemVer) — source version
    - `toVersion` (SemVer) — target version
    - `changes` (array) — each entry with: `type` (`added` | `removed` | `changed` | `renamed`), `path` (JSON Pointer to affected location), `classification` (`online-safe` | `requires-maintenance-window`), `description` (human-readable summary)
2. A human-readable migration guide with before/after examples.
3. RECOMMENDED: An automated migration script.

### Zero-Downtime Migration

Migration manifests MUST classify each breaking change as:

- **`online-safe`** — Can be applied without downtime (e.g., adding a new required property with a default).
- **`requires-maintenance-window`** — Requires coordinated downtime (e.g., removing a property, changing types).

The recommended migration pattern for `online-safe` changes is: expand (add new structure) → migrate data → contract (remove old structure). Runtimes SHOULD support reading both old and new schema structures during the transition window.

### Rollback

MINOR version rollbacks (removing newly-added optional features) MUST be supported without data loss. MAJOR version rollbacks SHOULD be addressed in migration manifests with a reverse migration path. Conformant runtimes SHOULD retain the previous schema version to enable rapid rollback.

---

## Compatibility Matrix

|                  | 1.0.x   | 1.1.x   | 1.2.x  | 2.0.x  |
| ---------------- | ------- | ------- | ------ | ------ |
| **Schema 1.0.x** | Full    | Full    | Full   | Reject |
| **Schema 1.1.x** | Forward | Full    | Full   | Reject |
| **Schema 1.2.x** | Forward | Forward | Full   | Reject |
| **Schema 2.0.x** | Reject  | Reject  | Reject | Full   |

- **Full** — All features supported.
- **Forward** — Accepted with warnings; unknown features ignored.
- **Reject** — Incompatible; MUST reject with error.

---

## Conformance Levels

### Level 1 Minimal

- MUST validate `schemaVersion` format.
- MUST reject MAJOR version mismatches.
- MUST apply defaults for missing optional properties.

### Level 2 Standard

All Level 1, plus:

- MUST implement full forward and backward compatibility.
- MUST detect deprecated features and emit structured warnings.

### Level 3 Full

All Level 2, plus:

- MUST preserve unknown properties during round-trip serialization.
- MUST support pre-release version handling.
- SHOULD provide automated migration tooling for MAJOR transitions.

---

## Specification Document Classification

| Document                                 | Classification | Description                        |
| ---------------------------------------- | -------------- | ---------------------------------- |
| [schema.schema.json](schema.schema.json) | **Normative**  | Structural JSON Schema definitions |
| [Semantic.md](Semantic.md)               | **Normative**  | Semantic validation rules          |
| [Runtime.md](Runtime.md)                 | **Mixed**      | Runtime behavior specification     |
| [Versioning.md](Versioning.md)           | **Normative**  | Versioning and compatibility rules |

- **Normative** — Requirements using RFC 2119 keywords are binding.
- **Mixed** — Contains both normative and informative sections, each marked accordingly.
- **Informative** — Guidance and examples; non-binding.

When normative and informative content conflict, normative content takes precedence.
