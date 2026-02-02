# SchemaFX Schema

## SchemaFX Object

| Field | Type | Description |
| ----- | ---- | ----------- |
| schemaVersion | `string` | **REQUIRED**. Specifies which version of the definition to use. |
| app | [`Metadata`](#metadata) | **REQUIRED**.  |
| connectors | `Map<string, `[`Connector`](#connector)`>` | **REQUIRED**. Defines the available connection sources. |
| tables | `Map<string, `[`Table`](#table)`>` | **REQUIRED**. Structures the data through tables. |
| views | [`View`](#view)`[]` | Outlines the list of definitions of the different views in an application. |
| workflows | `Map<string, `[`Workflow`](#workflow)`>` | Describe the automated workflows runnable from the application. |

## Metadata

Configures metadata for the application.

| Field | Type | Description |
| ----- | ---- | ----------- |
| name | `string` | **REQUIRED**. The application name. |
| description | `string` | The application description. |
| version | `string` | **REQUIRED**. The application version. |
| branding | [`Branding`](#branding) | **REQUIRED**.  |

## Branding

The application's branding configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| primaryColor | `string` | **REQUIRED**. The Hex color code for the primary color. |
| secondaryColor | `string` | The Hex color code for the secondary color. |

## Connector

Defines a connection source.

| Field | Type | Description |
| ----- | ---- | ----------- |
| name | `string` | **REQUIRED**. The connector name. |
| description | `string` | The connector description. |
| config | [`ConnectorConfig`](#connectorconfig) | **REQUIRED**.  |
| auth | [`ConnectorAuth`](#connectorauth) |  |

## ConnectorConfig

One of: [`ConnectorConfigOpenAPI`](#connectorconfigopenapi) | [`ConnectorConfigSQL`](#connectorconfigsql) | [`ConnectorConfigFile`](#connectorconfigfile) | [`ConnectorConfigGraphQL`](#connectorconfiggraphql) | [`ConnectorConfigREST`](#connectorconfigrest) | [`ConnectorConfigOData`](#connectorconfigodata)

## ConnectorConfigOpenAPI

OpenAPI connector configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"openapi"` | **REQUIRED**. The connector type. |
| configUrl | `string` | **REQUIRED**. The URL pointing to the OpenAPI configuration document. |

## ConnectorConfigSQL

SQL connector configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"sql"` | **REQUIRED**. The connector type. |
| dialect | `string` | **REQUIRED**. The SQL dialect. |

## ConnectorConfigFile

File connector configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"file"` | **REQUIRED**. The connector type. |
| format | `string` | **REQUIRED**. The file format. |
| delimiter | `string` | The delimiter used in the file. |

## ConnectorConfigGraphQL

GraphQL connector configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"graphql"` | **REQUIRED**. The connector type. |
| endpoint | `string` | **REQUIRED**. The URL of the GraphQL endpoint. |

## ConnectorConfigREST

REST connector configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"rest"` | **REQUIRED**. The connector type. |
| baseUrl | `string` | **REQUIRED**. The base URL for the API. |

## ConnectorConfigOData

OData connector configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"odata"` | **REQUIRED**. The connector type. |
| serviceUrl | `string` | **REQUIRED**. The base URL of the OData service. |
| version | `string` | The OData version. |

## ConnectorAuth

One of: [`ConnectorAuthBasic`](#connectorauthbasic) | [`ConnectorAuthToken`](#connectorauthtoken) | [`ConnectorAuthOAuth2`](#connectorauthoauth2) | [`ConnectorAuthApiKey`](#connectorauthapikey)

## ConnectorAuthBasic

Basic authentication configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"basic"` | **REQUIRED**. The connector auth type. |
| fields | [`Field`](#field)`[]` | **REQUIRED**. The available auth fields. |

## ConnectorAuthToken

Token authentication configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"token"` | **REQUIRED**. The connector auth type. |
| tokenUrl | `string` | **REQUIRED**. The URL to fetch the token. |
| scopes | `string[]` | The scopes required for the token. |

## ConnectorAuthOAuth2

OAuth2 authentication configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"oauth2"` | **REQUIRED**. The connector auth type. |
| authUrl | `string` | **REQUIRED**. The URL for authorization. |
| tokenUrl | `string` | **REQUIRED**. The URL to fetch the token. |
| scopes | `string[]` | The scopes required for the token. |

## ConnectorAuthApiKey

API Key authentication configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"apikey"` | **REQUIRED**. The connector auth type. |
| keyName | `string` | **REQUIRED**. The name of the API key. |
| location | `("header" \| "query")` | **REQUIRED**. Where to pass the key. |

## Table

Structures data through a table.

| Field | Type | Description |
| ----- | ---- | ----------- |
| name | `string` | **REQUIRED**. The table name. |
| description | `string` | The table description. |
| connector | `string` | **REQUIRED**. The source connector. |
| path | `string[]` | **REQUIRED**. The path from the connector. |
| fields | [`Field`](#field)`[]` | The list of available fields. |
| actions | [`Action`](#action)`[]` | The list of available actions. |

## Field

Defines a field.

| Field | Type | Description |
| ----- | ---- | ----------- |
| id | `string` | **REQUIRED**. The field id. Must be unique across all fields. |
| name | `string` | **REQUIRED**. The field name. |
| description | `string` | The field description. |
| primary | `boolean` | Whether the field is a key. |
| required | `boolean` | Whether the field is required. |
| config | [`FieldConfig`](#fieldconfig) | **REQUIRED**.  |

## FieldConfig

One of: [`FieldConfigString`](#fieldconfigstring) | [`FieldConfigNumber`](#fieldconfignumber) | [`FieldConfigBoolean`](#fieldconfigboolean) | [`FieldConfigDate`](#fieldconfigdate) | [`FieldConfigJSON`](#fieldconfigjson)

## FieldConfigString

String field configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"string"` | **REQUIRED**. The field type. |

## FieldConfigNumber

Number field configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"number"` | **REQUIRED**. The field type. |

## FieldConfigBoolean

Boolean field configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"boolean"` | **REQUIRED**. The field type. |

## FieldConfigDate

Date field configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"date"` | **REQUIRED**. The field type. |

## FieldConfigJSON

JSON field configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"json"` | **REQUIRED**. The field type. |

## Action

Defines an action.

| Field | Type | Description |
| ----- | ---- | ----------- |
| id | `string` | **REQUIRED**. The action id. Must be unique across all actions. |
| name | `string` | **REQUIRED**. The action name. |
| description | `string` | The action description. |
| config | [`ActionConfig`](#actionconfig) | **REQUIRED**.  |

## ActionConfig

One of: [`ActionConfigAdd`](#actionconfigadd) | [`ActionConfigUpdate`](#actionconfigupdate) | [`ActionConfigDelete`](#actionconfigdelete) | [`ActionConfigProcess`](#actionconfigprocess) | [`ActionConfigWorkflow`](#actionconfigworkflow)

## ActionConfigAdd

Add action configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"add"` | **REQUIRED**. The action type. |

## ActionConfigUpdate

Update action configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"update"` | **REQUIRED**. The action type. |
| fields | `string[]` | The fields to avail for quick edit. |

## ActionConfigDelete

Delete action configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"delete"` | **REQUIRED**. The action type. |

## ActionConfigProcess

Process action configuration. A process action is an action which processes multiple actions.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"process"` | **REQUIRED**. The action type. |
| actions | `string[]` | **REQUIRED**. A list of actions to run. Those MUST be processed in order. |

## ActionConfigWorkflow

Workflow action configuration. A workflow action is an action which runs a workflow.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"workflow"` | **REQUIRED**. The action type. |
| workflow | `string` | **REQUIRED**. The workflow to run. |

## View

Defines a view.

| Field | Type | Description |
| ----- | ---- | ----------- |
| id | `string` | **REQUIRED**. The view id. Must be unique across all views. |
| name | `string` | **REQUIRED**. The view name. |
| description | `string` | The view description. |
| table | `string` | **REQUIRED**. The view source Table's id. |
| config | [`ViewConfig`](#viewconfig) | **REQUIRED**.  |

## ViewConfig

One of: [`ViewConfigTable`](#viewconfigtable) | [`ViewConfigForm`](#viewconfigform) | [`ViewConfigDetail`](#viewconfigdetail)

## ViewConfigTable

Table view configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"table"` | **REQUIRED**. The view type. |
| fields | `string[]` | **REQUIRED**. The list of fields to display. Those MUST be displayed in order. |

## ViewConfigForm

Form view configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"form"` | **REQUIRED**. The view type. |
| fields | `string[]` | **REQUIRED**. The list of fields to display. Those MUST be displayed in order. |

## ViewConfigDetail

Detail view configuration.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"detail"` | **REQUIRED**. The view type. |
| fields | `string[]` | **REQUIRED**. The list of fields to display. Those MUST be displayed in order. |

## Workflow

Describes an automated workflow runnable from the application.

| Field | Type | Description |
| ----- | ---- | ----------- |
| name | `string` | **REQUIRED**. The workflow name. |
| description | `string` | The workflow description. |
| trigger | [`WorkflowTrigger`](#workflowtrigger) | **REQUIRED**.  |
| actions | [`WorkflowAction`](#workflowaction)`[]` | **REQUIRED**. The workflow actions. Those MUST be processed in order. |

## WorkflowTrigger

Defines a workflow trigger.

| Field | Type | Description |
| ----- | ---- | ----------- |
| id | `string` | **REQUIRED**. The trigger id. Must be unique across all workflow triggers. |
| name | `string` | **REQUIRED**. The trigger name. |
| description | `string` | The trigger description. |
| config | [`WorkflowTriggerConfig`](#workflowtriggerconfig) | **REQUIRED**.  |

## WorkflowTriggerConfig

One of: [`WorkflowTriggerConfigData`](#workflowtriggerconfigdata)

## WorkflowTriggerConfigData

A workflow trigger which depends on a data change.

| Field | Type | Description |
| ----- | ---- | ----------- |
| type | `"data"` | **REQUIRED**. The trigger type. |
| table | `string` | **REQUIRED**. The trigger source Table's id. |
| event | `("add" \| "update" \| "delete")[]` | **REQUIRED**. The list of trigger events. |

## WorkflowAction

One of: `string` | [`Action`](#action)

