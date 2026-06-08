# Rule: OpenAPI

All service APIs must have an OpenAPI 3.1 specification.

## Mandatory Fields

Every spec must include:

```yaml
openapi: "3.1.0"
info:
  title: "Service Name API"
  version: "1.0.0"
  description: "What this service does"
  contact:
    name: "Team Name"
    email: "team@example.com"
servers:
  - url: "https://api.example.com/api/v1"
    description: Production
tags:
  - name: Users
    description: User management operations
```

## Schema Requirements

- All schemas must have `required` arrays for mandatory fields.
- All properties must have `description`.
- All string fields must have `example`.
- Numeric fields must specify `format` (`int32`, `int64`, `float`, `double`).
- Date/time fields must use `format: date-time` (ISO 8601).

## Operation Requirements

Every operation must have:
- `operationId` (camelCase, unique)
- `summary` (one line)
- `tags` (at least one)
- `responses` (all expected status codes, including error responses)
- `security` (explicit, even if `[]`)

## Standard Schemas

Always define these reusable schemas in `components/schemas/`:

```yaml
ErrorResponse:
  type: object
  required: [code, message]
  properties:
    code: { type: string, example: USER_NOT_FOUND }
    message: { type: string }
    details:
      type: array
      items:
        type: object
        properties:
          field: { type: string }
          message: { type: string }

PagedResponse:
  type: object
  required: [content, page, totalElements, totalPages]
  properties:
    content: { type: array, items: {} }
    page: { type: integer }
    size: { type: integer }
    totalElements: { type: integer, format: int64 }
    totalPages: { type: integer }
```

## Operation Template

```yaml
/users/{userId}:
  get:
    operationId: getUserById
    summary: Get a user by ID
    tags: [Users]
    security:
      - BearerAuth: []
    parameters:
      - name: userId
        in: path
        required: true
        schema: { type: integer, format: int64 }
        description: The user's unique identifier
    responses:
      '200':
        description: User found
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UserResponse' }
      '404':
        description: User not found
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ErrorResponse' }
```

## Naming Conventions

- Paths: kebab-case plural nouns - `/user-profiles`, `/order-items`
- Operation IDs: camelCase verb+noun - `createUser`, `getUserById`
- Schemas: PascalCase - `User`, `CreateUserRequest`, `PagedResponse`

## HTTP Status Codes

`200` GET/PUT/PATCH success - `201` POST create (+ `Location` header) - `204` DELETE - `400` validation - `401` unauthenticated - `403` forbidden - `404` not found - `409` conflict - `422` business rule violation - `429` rate limited - `500` unexpected

## CI Enforcement

```yaml
# .github/workflows/api-check.yml
- name: Lint OpenAPI spec
  run: spectral lint openapi/openapi.yaml --ruleset .spectral.yaml

- name: Check breaking changes
  if: github.event_name == 'pull_request'
  run: oasdiff breaking origin/main:openapi/openapi.yaml openapi/openapi.yaml
```

## Spectral Config

```yaml
# .spectral.yaml
extends: ["spectral:oas"]
rules:
  operation-operationId: error
  operation-tags: error
  info-contact: warn
```

## SDK Generation

Run code generation as part of the build, not as a manual step. Generated code is committed to source control so diffs are visible in PRs.
