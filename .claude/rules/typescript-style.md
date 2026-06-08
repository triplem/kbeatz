# Rule: TypeScript Style

## tsconfig Requirements

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

## Naming

- Interfaces: PascalCase, no `I` prefix (`UserRepository` not `IUserRepository`)
- Type aliases: PascalCase
- Enums: PascalCase, values SCREAMING_SNAKE_CASE
- Constants: SCREAMING_SNAKE_CASE at module level, camelCase in function scope
- Files: kebab-case (`user.service.ts`, `create-user.dto.ts`)

## Imports

Prefer named imports. No default exports. Use path aliases:

```typescript
// tsconfig paths
"paths": {
  "@/users/*": ["./src/users/*"],
  "@/shared/*": ["./src/shared/*"]
}

// Usage
import { UserService } from '@/users/user.service';
```

## Async/Await

Always `await` Promises. Never ignore with `void` without an explicit comment. Always handle rejections:

```typescript
// BAD
doSomethingAsync(); // fire and forget without tracking

// GOOD — fire and forget with explicit intent
void sendAnalyticsEvent(event).catch(err =>
  logger.warn({ err }, 'analytics event failed — non-critical'));
```

## Immutability

```typescript
// Prefer readonly
interface User {
  readonly id: UserId;
  readonly email: Email;
  readonly name: string;
}

// Immutable arrays
const ids: ReadonlyArray<UserId> = [createUserId(1), createUserId(2)];

// As const for literal types
const STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
type Status = typeof STATUS[keyof typeof STATUS];
```

## Branded Types

Use branded types to prevent primitive value substitution errors at compile time:

```typescript
type Brand<T, B> = T & { readonly _brand: B };
type UserId = Brand<number, 'UserId'>;
type Email = Brand<string, 'Email'>;

const createEmail = (raw: string): Email => {
  if (!raw.includes('@')) throw new Error(`Invalid email: ${raw}`);
  return raw as Email;
};
```

## Result Types

Use a `Result<T, E>` sealed type instead of throwing for expected business outcomes:

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

async function findUser(id: UserId): Promise<Result<User, 'NOT_FOUND'>> {
  const user = await db.users.findById(id);
  return user ? ok(user) : err('NOT_FOUND');
}
```

## Discriminated Unions

Use discriminated unions for state variants (prefer over class hierarchies):

```typescript
type UserEvent =
  | { type: 'CREATED'; user: User; timestamp: Date }
  | { type: 'UPDATED'; userId: UserId; changes: Partial<User> }
  | { type: 'DELETED'; userId: UserId };

function handle(event: UserEvent) {
  switch (event.type) {
    case 'CREATED': return onCreated(event.user);
    case 'UPDATED': return onUpdated(event.userId, event.changes);
    case 'DELETED': return onDeleted(event.userId);
  }
}
```

## Module Boundaries

Each feature folder exposes a barrel `index.ts` with explicit named exports. Internal types/classes are not re-exported.

```typescript
// users/index.ts
export type { User } from './user.entity';
export { UserService } from './user.service';
export type { CreateUserDto, UserResponse } from './user.dto';
// Do NOT export: UserRepository, UserMapper (internal)
```
