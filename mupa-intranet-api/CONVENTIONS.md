# Backend Conventions

## Stack

* Node.js
* Express
* TypeScript
* Drizzle ORM
* Zod
* PostgreSQL
* Feature-based architecture

## Project Structure

```text
src/
├── app.ts
├── server.ts
│
├── config/
│   ├── env.ts
│   └── database.ts
│
├── database/
│   ├── schema/
│   └── migrations/
│
├── shared/
│   ├── errors/
│   │   ├── domain-error.ts
│   │   └── validation-error.ts
│   │
│   ├── middlewares/
│   │   ├── error-handler.middleware.ts
│   │   └── validate.middleware.ts
│   │
│   └── services/
│       ├── email.service.ts
│       └── ...
│
└── features/
    ├── users/
    │   ├── users.routes.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   ├── users.repository.ts
    │   └── dtos/
    │       ├── create-user.dto.ts
    │       ├── update-user.dto.ts
    │       └── user-response.dto.ts
    │
    └── <feature>/
        ├── <feature>.routes.ts
        ├── <feature>.controller.ts
        ├── <feature>.service.ts
        ├── <feature>.repository.ts
        └── dtos/
```

## General Rules

* Organize application code by *feature*, not by technical layer.
* Keep the architecture simple:

  * Route → Controller → Service → Repository → Database
* Prefer simple code over unnecessary abstractions.
* Do not introduce architectural patterns unless there is a concrete need.
* Features should be as independent as reasonably possible.
* Shared code belongs in shared/ only when genuinely reusable across features.
* Avoid turning shared/ into a dumping ground.

## Routes

* Define HTTP endpoints.
* Attach required middlewares.
* Delegate requests to controllers.
* Must not contain business logic.
* Must not access repositories or Drizzle directly.

```text
Route → Middleware → Controller
```

## Controllers

* Handle the HTTP layer only.
* Read body, params, query, headers, etc.
* Call services.
* Return HTTP responses and status codes.
* Keep controllers small and predictable.
* Must not contain business logic.
* Must not access repositories directly.
* Must never use Drizzle directly.

```text
HTTP → Controller → Service → HTTP Response
```

## DTOs

* Use Zod schemas for request and response DTOs.
* Keep DTOs inside the corresponding feature.
* Use DTOs to validate:

  * Required fields.
  * Types.
  * Formats.
  * Simple structural constraints.
* Do not perform database queries from DTOs.
* Do not call services or repositories from DTOs.
* Business rules should generally live in services.

Examples:

```text
Invalid email format        → DTO validation
Missing required field      → DTO validation
Invalid data type           → DTO validation

Email already registered    → Service / DomainError
User cannot enroll          → Service / DomainError
Course is already closed    → Service / DomainError
```

## Validation

* Use a reusable validation middleware.
* Do not manually call Zod validation inside every controller.
* Validation failures must produce a ValidationError.
* Return all invalid fields, not only the first one.

Example response:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "fields": [
    {
      "field": "email",
      "message": "Invalid email"
    }
  ]
}
```

## Repositories

* Repositories are the *only application layer allowed to use Drizzle directly*.
* Repositories contain database/persistence operations only.
* Typical methods:

  * findById()
  * findMany()
  * findByEmail()
  * create()
  * update()
  * delete()
  * exists()
* Repositories may contain:

  * Queries.
  * Joins.
  * Filters.
  * Pagination.
  * Persistence-related transaction operations.
* Repositories must not:

  * Contain business rules.
  * Send emails.
  * Call services.
  * Know about Express.
  * Receive Request or Response.

```text
Repository → Drizzle → Database
```

## Services

* Services contain and orchestrate business logic.
* Services may call:

  * Repositories.
  * Other services.
  * Shared infrastructure services.
* Services must not depend on Express.
* Services must not receive Request or Response.
* Services must not use Drizzle directly.
* Expected business failures should throw DomainError.

Example:

```ts
if (existingUser) {
  throw new DomainError(
    "A user with this email already exists",
    409,
    "EMAIL_ALREADY_EXISTS"
  );
}
```

## Infrastructure Services

* Non-business services may exist for reusable infrastructure behavior.
* Examples:

  * EmailService
  * StorageService
  * HashService
  * TokenService
* Business services may consume these services.
* Keep external provider-specific logic out of business services.

```text
UsersService
├── UsersRepository
└── EmailService
```

## Domain Errors

* Use DomainError for expected business-rule failures.
* Domain error messages are safe to expose to API clients.
* A domain error should support:

  * message
  * statusCode
  * code

Example:

```ts
throw new DomainError(
  "User not found",
  404,
  "USER_NOT_FOUND"
);
```

Response:

```json
{
  "error": "USER_NOT_FOUND",
  "message": "User not found"
}
```

## Error Handling

* Use one global Express error-handling middleware.
* All uncaught application errors must reach this middleware.

### ValidationError

* Return 400.
* Expose validation details.
* Include all invalid fields.

### DomainError

* Return its configured HTTP status.
* Expose its message and error code.

### Unexpected/Internal Error

* Return 500.
* Never expose internal details.
* Log the original error using console.error() or the configured logger.

Example:

```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred"
}
```

Never expose:

* Stack traces.
* SQL errors.
* Database credentials.
* Drizzle internals.
* Connection strings.
* Internal exception messages.

## Dependency Rules

Allowed:

```text
Routes      → Controllers
Controllers → Services
Services    → Services
Services    → Repositories
Services    → Infrastructure Services
Repositories → Drizzle
Drizzle     → Database
```

Avoid:

```text
Controller → Repository
Controller → Drizzle

Service → Drizzle

Repository → Service
Repository → Controller

DTO → Service
DTO → Repository
```

* Do not skip layers for convenience.
* Lower-level layers must not depend on higher-level layers.

## Cross-Feature Communication

* Prefer communicating with another feature through its service.

Prefer:

```text
EnrollmentService
    ↓
CoursesService
    ↓
CoursesRepository
```

Avoid directly reaching into another feature's repository unless there is a clear architectural reason.

## Transactions

* Services determine when a business operation requires atomicity.
* Database transaction mechanics belong to the persistence layer.
* Multiple writes that represent one business operation should be atomic when necessary.

## API Responses

* Do not unnecessarily wrap successful responses.

Prefer:

```json
{
  "id": 1,
  "name": "John"
}
```

Instead of:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John"
  }
}
```

* Error responses must follow a consistent structure.

## Naming

Feature files:

```text
users.routes.ts
users.controller.ts
users.service.ts
users.repository.ts
```

DTOs:

```text
create-user.dto.ts
update-user.dto.ts
user-response.dto.ts
```

Classes:

```text
UsersController
UsersService
UsersRepository

DomainError
ValidationError
```

Repository methods should use predictable names:

```text
findById()
findMany()
findByEmail()
exists()
create()
update()
delete()
```

## Simplicity Rules

* Do not introduce abstractions without a real need.
* Do not create interfaces for every repository/service by default.
* Do not create one class per use case by default.
* Avoid unnecessary:

  * Use-case classes.
  * Ports/adapters.
  * Commands/handlers.
  * CQRS.
  * Event buses. **Exception (approved by Daniel):** `shared/services/event-bus.service.ts`, an in-process bus (`node:events`, no Redis/queues) so that `requests` emits `solicitud.creada` without knowing `notifications` (SSE) or `audit` (table `event_audit`, listens to every event with `onAny`). New events go in its `Eventos` map and in the README table. It only works with a single API instance.
  * Repository interfaces.
  * Domain entities/value objects.
  * Mappers for trivial transformations.
* Add complexity only when the feature actually requires it.
* A complex feature may evolve internally without forcing the entire application to adopt the same complexity.

## Core Principle

Keep the default architecture:

```text
Request
   ↓
Route
   ↓
Middleware
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
Drizzle
   ↓
Database
```

Optimize for *simplicity, clear responsibilities, predictable structure, and incremental scalability*.
