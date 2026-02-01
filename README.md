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

Below is the complete structure definition for the SchemaFX Application Definition.

### SchemaFX Object

All of those fields are to be positioned at the top of the definition.

| Field Name    | Type                                       | Description                                                                |
| ------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| schemaVersion | `string`                                   | **REQUIRED**. Specifies which version of the definition to use.            |
| app           | [`Metadata`](#appmetadata)                 | **REQUIRED**. Configures metadata for the application.                     |
| connectors    | `Map<string, `[`Connector`](#connector)`>` | **REQUIRED**. Defines the available connection sources.                    |
| tables        | `Map<string, `[`Table`](#table)`>`         | **REQUIRED**. Structures the data through tables.                          |
| views         | [`View`](#view)`[]`                        | Outlines the list of definitions of the different views in an application. |
| workflows     | `Map<string, `[`Workflow`](#workflow)`>`   | Describe the automated workflows runnable from the application.            |

### Metadata

| Field Name  | Type                    | Description                                             |
| ----------- | ----------------------- | ------------------------------------------------------- |
| name        | `string`                | **REQUIRED**. The application name.                     |
| description | `string`                | The application description.                            |
| version     | `string`                | **REQUIRED**. The application version.                  |
| branding    | [`Branding`](#branding) | **REQUIRED**. The application's branding configuration. |

### Branding

| Field Name     | Type     | Description                                             |
| -------------- | -------- | ------------------------------------------------------- |
| primaryColor   | `string` | **REQUIRED**. The Hex color code for the primary color. |
| secondaryColor | `string` | The Hex color code for the secondary color.             |

### Connector

| Field Name  | Type                                                                                                                                                                                                                                                                                                           | Description                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| name        | `string`                                                                                                                                                                                                                                                                                                       | **REQUIRED**. The connector name.          |
| description | `string`                                                                                                                                                                                                                                                                                                       | The connector description.                 |
| config      | [`ConnectorConfigOpenAPI`](#connectorconfigopenapi) \| [`ConnectorConfigSQL`](#connectorconfigsql) \| [`ConnectorConfigFile`](#connectorconfigfile) \| [`ConnectorConfigGraphQL`](#connectorconfiggraphql) \| [`ConnectorConfigREST`](#connectorconfigrest) \| [`ConnectorConfigOData`](#connectorconfigodata) | **REQUIRED**. The connector configuration. |
| auth        | [`ConnectorAuthBasic`](#connectorauthbasic) \| [`ConnectorAuthToken`](#connectorauthtoken) \| [`ConnectorAuthOAuth2`](#connectorauthoauth2) \| [`ConnectorAuthApiKey`](#connectorauthapikey)                                                                                                                   | The connector authentication.              |

#### ConnectorConfigOpenAPI

| Field Name | Type        | Description                                                           |
| ---------- | ----------- | --------------------------------------------------------------------- |
| type       | `"openapi"` | **REQUIRED**. The connector type.                                     |
| configUrl  | `string`    | **REQUIRED**. The URL pointing to the OpenAPI configuration document. |

#### ConnectorConfigSQL

| Field Name | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| type       | `"sql"`  | **REQUIRED**. The connector type. |
| dialect    | `string` | **REQUIRED**. The SQL dialect.    |

#### ConnectorConfigFile

| Field Name | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| type       | `"file"` | **REQUIRED**. The connector type. |
| format     | `string` | **REQUIRED**. The file format.    |
| delimiter  | `string` | The delimiter used in the file.   |

#### ConnectorConfigGraphQL

| Field Name | Type        | Description                                    |
| ---------- | ----------- | ---------------------------------------------- |
| type       | `"graphql"` | **REQUIRED**. The connector type.              |
| endpoint   | `string`    | **REQUIRED**. The URL of the GraphQL endpoint. |

#### ConnectorConfigREST

| Field Name | Type     | Description                             |
| ---------- | -------- | --------------------------------------- |
| type       | `"rest"` | **REQUIRED**. The connector type.       |
| baseUrl    | `string` | **REQUIRED**. The base URL for the API. |

#### ConnectorConfigOData

| Field Name | Type      | Description                                      |
| ---------- | --------- | ------------------------------------------------ |
| type       | `"odata"` | **REQUIRED**. The connector type.                |
| serviceUrl | `string`  | **REQUIRED**. The base URL of the OData service. |
| version    | `string`  | The OData version.                               |

#### ConnectorAuthBasic

| Field Name | Type                  | Description                              |
| ---------- | --------------------- | ---------------------------------------- |
| type       | `"basic"`             | **REQUIRED**. The connector auth type.   |
| fields     | [`Field`](#field)`[]` | **REQUIRED**. The available auth fields. |

#### ConnectorAuthToken

| Field Name | Type       | Description                               |
| ---------- | ---------- | ----------------------------------------- |
| type       | `"token"`  | **REQUIRED**. The connector auth type.    |
| tokenUrl   | `string`   | **REQUIRED**. The URL to fetch the token. |
| scopes     | `string[]` | The scopes required for the token.        |

#### ConnectorAuthOAuth2

| Field Name | Type       | Description                               |
| ---------- | ---------- | ----------------------------------------- |
| type       | `"oauth2"` | **REQUIRED**. The connector auth type.    |
| authUrl    | `string`   | **REQUIRED**. The URL for authorization.  |
| tokenUrl   | `string`   | **REQUIRED**. The URL to fetch the token. |
| scopes     | `string[]` | The scopes required for the token.        |

#### ConnectorAuthApiKey

| Field Name | Type                    | Description                            |
| ---------- | ----------------------- | -------------------------------------- |
| type       | `"apikey"`              | **REQUIRED**. The connector auth type. |
| keyName    | `string`                | **REQUIRED**. The name of the API key. |
| location   | `"header"` \| `"query"` | **REQUIRED**. Where to pass the key.   |

### Table

| Field Name  | Type                    | Description                                |
| ----------- | ----------------------- | ------------------------------------------ |
| name        | `string`                | **REQUIRED**. The table name.              |
| description | `string`                | The table description.                     |
| connector   | `string`                | **REQUIRED**. The source connector.        |
| path        | `string[]`              | **REQUIRED**. The path from the connector. |
| fields      | [`Field`](#field)`[]`   | The list of available fields.              |
| actions     | [`Action`](#action)`[]` | The list of available actions.             |

### Field

| Field Name  | Type                                                                                                                                                                                                                    | Description                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| id          | `string`                                                                                                                                                                                                                | **REQUIRED**. The field id.            |
| name        | `string`                                                                                                                                                                                                                | **REQUIRED**. The field name.          |
| description | `string`                                                                                                                                                                                                                | The field description.                 |
| primary     | `boolean`                                                                                                                                                                                                               | Whether the field is a key.            |
| required    | `boolean`                                                                                                                                                                                                               | Whether the field is required.         |
| config      | [`FieldConfigString`](#fieldconfigstring) \| [`FieldConfigNumber`](#fieldconfignumber) \| [`FieldConfigBoolean`](#fieldconfigboolean) \| [`FieldConfigDate`](#fieldconfigdate) \| [`FieldConfigJSON`](#fieldconfigjson) | **REQUIRED**. The field configuration. |

The `id` field MUST be unique across all fields.

#### FieldConfigString

| Field Name | Type       | Description                   |
| ---------- | ---------- | ----------------------------- |
| type       | `"string"` | **REQUIRED**. The field type. |

#### FieldConfigNumber

| Field Name | Type       | Description                   |
| ---------- | ---------- | ----------------------------- |
| type       | `"number"` | **REQUIRED**. The field type. |

#### FieldConfigBoolean

| Field Name | Type        | Description                   |
| ---------- | ----------- | ----------------------------- |
| type       | `"boolean"` | **REQUIRED**. The field type. |

#### FieldConfigDate

| Field Name | Type     | Description                   |
| ---------- | -------- | ----------------------------- |
| type       | `"date"` | **REQUIRED**. The field type. |

#### FieldConfigJSON

| Field Name | Type     | Description                   |
| ---------- | -------- | ----------------------------- |
| type       | `"json"` | **REQUIRED**. The field type. |

### Action

| Field Name  | Type                                                                                                                                                                                                                                    | Description                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| id          | `string`                                                                                                                                                                                                                                | **REQUIRED**. The action id.            |
| name        | `string`                                                                                                                                                                                                                                | **REQUIRED**. The action name.          |
| description | `string`                                                                                                                                                                                                                                | The action description.                 |
| config      | [`ActionConfigAdd`](#actionconfigadd) \| [`ActionConfigUpdate`](#actionconfigupdate) \| [`ActionConfigDelete`](#actionconfigdelete) \| [`ActionConfigProcess`](#actionconfigprocess) \| [`ActionConfigWorkflow`](#actionconfigworkflow) | **REQUIRED**. The action configuration. |

The `id` field MUST be unique across all actions.

#### ActionConfigAdd

| Field Name | Type    | Description                    |
| ---------- | ------- | ------------------------------ |
| type       | `"add"` | **REQUIRED**. The action type. |

#### ActionConfigUpdate

| Field Name | Type       | Description                         |
| ---------- | ---------- | ----------------------------------- |
| type       | `"update"` | **REQUIRED**. The action type.      |
| fields     | `string[]` | The fields to avail for quick edit. |

#### ActionConfigDelete

| Field Name | Type       | Description                    |
| ---------- | ---------- | ------------------------------ |
| type       | `"delete"` | **REQUIRED**. The action type. |

#### ActionConfigProcess

A process action is an action which processes multiple actions.

| Field Name | Type        | Description                                                                   |
| ---------- | ----------- | ----------------------------------------------------------------------------- |
| type       | `"process"` | **REQUIRED**. The action type.                                                |
| actions    | `string[]`  | **REQUIRED**. A list of actions to run. **Those MUST be processed in order**. |

#### ActionConfigWorkflow

A workflow action is an action which runs a workflow.

| Field Name | Type         | Description                        |
| ---------- | ------------ | ---------------------------------- |
| type       | `"workflow"` | **REQUIRED**. The action type.     |
| workflow   | `string`     | **REQUIRED**. The workflow to run. |

### View

| Field Name  | Type                                                                                                                    | Description                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| id          | `string`                                                                                                                | **REQUIRED**. The view id.                            |
| name        | `string`                                                                                                                | **REQUIRED**. The view name.                          |
| description | `string`                                                                                                                | The view description.                                 |
| table       | `string`                                                                                                                | **REQUIRED**. The view source [`Table`](#table)'s id. |
| config      | [`ViewConfigTable`](#viewconfigtable) \| [`ViewConfigForm`](#viewconfigform) \| [`ViewConfigDetail`](#viewconfigdetail) | **REQUIRED**. The view configuration.                 |

The `id` field MUST be unique across all views.

#### ViewConfigTable

| Field Name | Type       | Description                                                                        |
| ---------- | ---------- | ---------------------------------------------------------------------------------- |
| type       | `"table"`  | **REQUIRED**. The view type.                                                       |
| fields     | `string[]` | **REQUIRED**. The list of fields to display. **Those MUST be displayed in order**. |

#### ViewConfigForm

| Field Name | Type       | Description                                                                        |
| ---------- | ---------- | ---------------------------------------------------------------------------------- |
| type       | `"form"`   | **REQUIRED**. The view type.                                                       |
| fields     | `string[]` | **REQUIRED**. The list of fields to display. **Those MUST be displayed in order**. |

#### ViewConfigDetail

| Field Name | Type       | Description                                                                        |
| ---------- | ---------- | ---------------------------------------------------------------------------------- |
| type       | `"detail"` | **REQUIRED**. The view type.                                                       |
| fields     | `string[]` | **REQUIRED**. The list of fields to display. **Those MUST be displayed in order**. |

### Workflow

| Field Name  | Type                                    | Description                                                               |
| ----------- | --------------------------------------- | ------------------------------------------------------------------------- |
| name        | `string`                                | **REQUIRED**. The workflow name.                                          |
| description | `string`                                | The workflow description.                                                 |
| trigger     | [`WorkflowTrigger`](#workflowtrigger)   | **REQUIRED**. The workflow's [`WorkflowTrigger`](#workflowtrigger).       |
| actions     | [`WorkflowAction`](#workflowaction)`[]` | **REQUIRED**. The workflow actions. **Those MUST be processed in order**. |

### WorkflowTrigger

| Field Name  | Type                                                      | Description                              |
| ----------- | --------------------------------------------------------- | ---------------------------------------- |
| id          | `string`                                                  | **REQUIRED**. The trigger id.            |
| name        | `string`                                                  | **REQUIRED**. The trigger name.          |
| description | `string`                                                  | The trigger description.                 |
| config      | [`WorkflowTriggerConfigData`](#workflowtriggerconfigdata) | **REQUIRED**. The trigger configuration. |

The `id` field MUST be unique across all workflow triggers.

#### WorkflowTriggerConfigData

A workflow trigger which depends on a data change.

| Field Name | Type                                | Description                                              |
| ---------- | ----------------------------------- | -------------------------------------------------------- |
| type       | `"data"`                            | **REQUIRED**. The trigger type.                          |
| table      | `string`                            | **REQUIRED**. The trigger source [`Table`](#table)'s id. |
| event      | `("add" \| "update" \| "delete")[]` | **REQUIRED**. The list of trigger events.                |

### WorkflowAction

A workflow action is either a `string` as an id for an [`Action`](#action) or as an [`Action`](#action) object itself.

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
