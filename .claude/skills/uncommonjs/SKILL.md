---
name: uncommonjs
description: >-
  Author and structure Node.js apps built on @leonid-shutov/uncommonjs (this repo, and
  consumers like tuigram). Use when creating or editing files under an app's src/ tree,
  wiring modules, writing service entries, using the injected node.*/npm.* globals or self,
  the (common)/(getters)/(private) directories, domain errors, or the REST layer. Covers the
  file-as-expression authoring convention and the directory-loading rules.
---

# uncommon-js

`@leonid-shutov/uncommonjs` is a **convention-over-configuration module system for Node.js
built on V8 sandboxing** (`node:vm`). You don't write `require`/`import` in your app files.
Instead you lay code out as a directory tree under `src/`, and `loadApplication()` walks the
tree, runs each file in an isolated VM context, and wires everything into one object graph
(the "sandbox") that it returns. The library's `main` is `uncommon.js`; its only runtime
dependency is `metaschema` (used by the REST layer).

Everything exported by the library — loader, application, REST, and error helpers — is
re-exported from `uncommon.js`.

## 1. The one authoring rule

**Every `.js` app file is a single parenthesized expression that evaluates to its export.**
The file is executed in a VM and its last expression becomes the module's value.

```js
// an object module
({
  title: 'Book',
  create: (name) => db.insert(name),
})
```

```js
// a function module
async (code) => (await db.query('SELECT * FROM book WHERE code = $1', [code])).rows[0] ?? null
```

The loader distinguishes the two by checking whether the source starts with `({` (see
`lib/util.js` `isObjectLiteral`). This matters: object modules and function modules get
slightly different `self` scoping (below). Do **not** use `module.exports`, `export`, or a
bare `{ ... }` block — wrap objects in parentheses.

## 2. Bootstrapping

```js
const { loadApplication } = require('@leonid-shutov/uncommonjs');

// sandbox: initial globals you inject. options.applicationPath defaults to 'src',
// options.rootDir defaults to process.cwd().
const app = await loadApplication({ console, process }, { rootDir: __dirname });

await app.book.create('DUNE');
```

`loadApplication(sandbox = {}, { rootDir, applicationPath = 'src' })` returns the populated
sandbox. Real example from the `tuigram` consumer:

```js
uncommonjs.loadApplication({ tui, process, console }, { rootDir });
```

For a REST app use `loadRestApplication` instead (see §6).

## 3. Globals injected into every file (no imports needed)

`loadApplication` builds the VM context from your `sandbox` plus:

| Global        | What it is |
|---------------|------------|
| `node.*`      | Every Node builtin, e.g. `node.fs`, `node.path`, `node.crypto`, `node.timers`, `node.events` |
| `npm.*`       | Every dependency in your app's `package.json`, keyed by package name: `npm['@mtcute/bun']`, `npm.neovim` |
| error classes | `DomainError`, `NotFoundError`, `AlreadyExistsError`, `ConstraintViolationError`, `AuthorizationError`, `UnexpectedError`, `createDomainError`, and the `PASS` symbol (see §5) |
| `__rootDir`   | The resolved application root |
| your sandbox  | Anything you passed as the first arg to `loadApplication` (e.g. `console`, `tui`) |
| `self`        | The current module's own members (see §4) |

So instead of `const path = require('node:path')` you just use `node.path.join(...)`, and
instead of `require('@mtcute/bun')` you use `npm['@mtcute/bun']`.

## 4. Directory & filename conventions

The tree shape defines the module graph. Rules (from `lib/loader.js`):

- **`N-name` numbered prefix** — controls load order (files/dirs load alphabetically;
  prefixes sort first) and is **stripped** from the resulting key. `1-messenger/` becomes
  `app.messenger`. Use this for layered apps and to force something to load before its peers.
- **`foo/foo.js`** — a file named after its own directory **merges into the module itself**,
  rather than becoming `app.foo.foo`. Use it for the module's "main" members.
- **`(common)/`** *(reserved)* — loaded **first**, into the **parent** context, so its
  members are shared with every sibling module. Put shared helpers/deps here. Each `(common)`
  spawns its own context branch — siblings don't see each other's non-common members.
- **`(getters)/`** *(reserved)* — each file is `() => value` and becomes a **lazy getter**
  property on the module; the function runs on first access, not at load time.
- **`(private)/`** *(reserved)* — files load into the module's `self` **only**. Visible
  internally via `self.x`, but **not** on the module from the outside.
- **`(anythingElse)/`** — any *other* parenthesized directory name is **grouping only**: its
  files load into the module as if they were flat. `(methods)`, `(public)`, `(handlers)` etc.
  are **not** special — they only organize files visually. Only `(common)`, `(getters)`,
  `(private)` are reserved.
- **plain-named dir** — becomes a nested submodule (`user/profile/` → `app.user.profile`).

### `self`

`self` lets a file reach its module's other members without imports:

```js
// methodsDir/(methods)/method.js  — a function module
(x) => {
  console.log(self.foo);              // from methodsDir/methodsDir.js (merged into module)
  console.log(self.anotherModule.bar); // from methodsDir/anotherModule.js (sibling)
  console.log(x);
}
```

Scoping nuance: **function** modules see the whole module through `self`. **Object** modules
get their own `self` scope, so an object module's internal keys are not hoisted onto the
module's `self` for sibling functions. `(private)/` members are reachable via `self` but
absent from the external module object.

## 5. Service entries (auto-wrapped methods)

Any object entry shaped `{ method, description?, expectedErrors? }` is automatically wrapped
into a callable (see `lib/service.js`). The wrapper:

1. logs `description` (a string, or `(...args) => string` for dynamic text) via
   `context.logger` or `context.console` — whichever you injected;
2. runs `method` (sync or async);
3. on throw, looks up `error.code` in `expectedErrors`:
   - value is `PASS` → re-throw the original error unchanged;
   - value is a domain error → throw it with `.cause` set to the original;
   - no match → throw an `UnexpectedError` (with `.cause` set).

```js
({
  create: {
    description: 'Creating a book',
    method: repository.book.create,
    expectedErrors: {
      BOOK_ALREADY_EXISTS: PASS, // let the caller see the raw domain error
    },
  },
  getByCode: {
    description: (code) => `Getting book ${code}`,
    method: async (code) => {
      const book = await repository.book.getByCode(code);
      if (book === null) throw NotFoundError.from('book', { meta: { code } });
      return book;
    },
    expectedErrors: { BOOK_NOT_FOUND: PASS },
  },
})
```

A common pattern is a lower repository layer that maps driver error codes to domain errors:

```js
({
  create: {
    method: ({ code, name }) => db.pg.query('INSERT INTO "Book"(code,name) VALUES($1,$2)', [code, name]),
    expectedErrors: {
      23505: AlreadyExistsError.from('book'), // Postgres unique-violation → domain error
    },
  },
})
```

## 6. Errors (`lib/errors.js`)

- `DomainError` — base class; carries a `.code`.
- `createDomainError(name, { message, code, parent })` — factory for your own error classes.
- Built-ins: `UnexpectedError`, `NotFoundError`, `AlreadyExistsError`,
  `ConstraintViolationError`, `AuthorizationError`.
- `.from(entity, options)` helpers auto-generate messages and codes:
  `NotFoundError.from('book')` → message `book not found`, code `BOOK_NOT_FOUND`;
  `AlreadyExistsError.from('book')` → code `BOOK_ALREADY_EXISTS`. Pass `{ code, meta, cause }`
  in `options` to override.
- `PASS` — a symbol used in `expectedErrors` to re-throw the original error untouched.

## 7. REST layer (`lib/rest.js`)

```js
const { loadRestApplication } = require('@leonid-shutov/uncommonjs');
const router = await loadRestApplication({ console }, { rootDir: __dirname });
```

`loadRestApplication` runs `loadApplication` first, then builds a router from the modules
found under `sandbox.api`. Each API file maps route strings to per-method definitions:

```js
// src/api/books.js
({
  '/books/:id': {
    get: {
      handler: async ({ path }) => app.book.getByCode(path.id),
      response: (book) => ({ id: book.id, title: book.name }),
      status: 200,
    },
  },
  '/books': {
    post: {
      body: { code: 'string', name: 'string' },   // metaschema
      handler: async ({ body }) => app.book.create(body),
      expectedErrors: { BOOK_ALREADY_EXISTS: PASS },
    },
  },
})
```

Definition fields: `handler({ path, query, body, ... })`, `query`/`body` (metaschema schemas
validated before the handler), `response` (value or `(result) => body`), `status` (number or
`(result) => number`, default 200). Helpers exported: `validateRequest`, `createHandler`,
`createRouter`, `getStatus`. Domain errors map to HTTP status via `getStatus`:

| Error | Status |
|-------|--------|
| `ValidationError` | 400 |
| `AuthorizationError` | 401 |
| `NotFoundError` | 404 |
| `AlreadyExistsError` | 409 |
| `ConstraintViolationError` | 422 |
| anything else | 500 |

## 8. Worked example

```
src/
  (common)/
    logger.js            # () => shared, loaded first into the parent context
  book/
    book.js              # merges into the `book` module itself
    create.js            # app.book.create  (service entry)
    (private)/
      validate.js        # reachable via self.validate; NOT on app.book
    (getters)/
      count.js           # lazy: app.book.count computed on access
```

```js
// src/(common)/logger.js
({ info: (m) => console.log(`[app] ${m}`) })

// src/book/book.js
({ table: 'book' })

// src/book/create.js
({
  description: (b) => `Creating ${b.name}`,
  method: (b) => {
    if (!self.validate(b)) throw new Error('invalid');   // (private) helper via self
    logger.info('inserting');                             // (common) helper, no import
    return node.crypto.randomUUID();                      // node builtin, no import
  },
})

// src/book/(private)/validate.js
(b) => typeof b?.name === 'string'

// src/book/(getters)/count.js
() => registry.size
```

Resulting sandbox: `app.book.table`, `app.book.create(...)`, `app.book.count` (getter),
`app.logger.info(...)`. `app.book.validate` is **undefined** (private). `logger`, `node`,
`npm` are available inside every file.

## 9. Gotchas

- Files must be a single **parenthesized** expression (`({...})` or `(...) => ...`). A bare
  `{ ... }` is parsed as a block and exports nothing.
- Put anything shared between siblings in `(common)/` — it loads before the rest, so peers
  can depend on it. Non-common siblings don't see each other except through `self`.
- Numbered prefixes only affect load order and are stripped from keys — don't reference them
  by the prefixed name.
- `(methods)`, `(public)`, `(handlers)`… are just grouping folders; only `(common)`,
  `(getters)`, `(private)` change loading behavior.
- Utilities you see in a consumer app's `src/(common)/` (e.g. tuigram's `risk`, `LinkedList`,
  `Obj`) belong to *that app*, not to uncommon-js. The library ships only the loader, error
  classes, and REST helpers.
```
