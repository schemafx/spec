# SchemaFX Application Definition

## Consideration

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

This document, repository and all of [SchemaFX](https://github.com/schemafx) code and [website](https://schemafx.com/) are licensed under [Apache 2.0](/LICENSE). Any application created from this definition is the sole work, responsibility, and property of its creator. SchemaFX does not claim ownership of, endorse, or assume liability for applications derived from this specification. See the [Apache 2.0 license](/LICENSE) for further details.

## Introduction

This specification defines a standard, language-agnostic structure for data-driven applications which allows both humans and systems to understand the outline and functioning of an application without coding knowledge.

When properly defined, an interpreter MUST be able to generate a complete working data-driven application.

## Interpretation

The configuration interpretation depends on the end interpreter. While interpreters MUST ensure to support the fields as defined in the [Definition](#definition), they MAY not interpret all of the fields. For example, a server-side interpreter MAY interpret data actions but skip on the views while a client interpreter MAY focus on views.

If a field is interpreted, it MUST follow the interpretation boundaries defined below. If no interpretation standard is defined for a specific field, it doesn't need any default or minimal configuration.

## Format

A SchemaFX Application Definition is a JSON object which can be represented in either JSON or YAML format.

The definition supports 4 types of data from JSON structure: `string`, `number`, `array`, `json`.

```JSON
{
    "string": "str",
    "number": 1.2,
    "array": ["val1", "val2"],
    "json": {
        "somefield": "value"
    }
}
```

JSON below will be indicated with a type similar to `Map<string, number>`, in which case it will show:

```JSON
{
    "field": 1.2
}
```

Note that in the context of SchemaFX Application Definition, the keys in a map MUST always be ids.

## Definition

The complete definition is available as two formats:

- Human-Readable: [spec.md](/spec.md)
- Machine-Readable: [spec.json](/spec.json)

## Validation

The [Definition](#definition) MUST be strictly validated as described above.

Failing the **REQUIRED** fields MUST throw an error and prevent proceeding further.
Failing the field type MUST throw an error and prevent proceeding further.

## Modularity

Custom fields can be added from the [Definition](#definition), those MUST be prefixed with `x-` to ensure it remains separate from existing and future fields while allowing tools to retain their own infrastructure and configuration.

Fields for `config` allow additional configuration beyond what is standardized; those are however at risk of being impacted by newer versions as it evolves. You can contribute to this repository for extending the API with a new version.

## Examples

Examples of correct definitions, can be found from the [`examples/`](/examples/) folder.

## License

Apache 2.0
