# uncommon‑js ⚙️

**uncommon‑js** — a convention‑over‑configuration module system for Node.js built on V8
sandboxing (`node:vm`).

You don't write `require`/`import` in your app files. Instead you lay code out as a directory
tree under `src/`, and `loadApplication()` walks the tree, runs each file in an isolated VM
context, and wires everything into a single object graph (the "sandbox") that it returns.
Shared dependencies, Node builtins, npm packages, and error helpers are injected as globals —
so app files stay tiny and focused on logic.

The only runtime dependency is [`metaschema`](https://github.com/metarhia/metaschema) (used by
the optional REST layer).

## Install

```sh
npm install @leonid-shutov/uncommonjs
```

## Quick start

```
src/
  (common)/
    logger.js          # shared with every sibling, loaded first
  book/
    book.js            # merges into the `book` module itself
    create.js          # becomes app.book.create
```

```js
// src/(common)/logger.js
({ info: (m) => console.log(`[app] ${m}`) })(
  // src/book/book.js
  { table: 'book' },
)(
  // src/book/create.js
  {
    method: (name) => {
      logger.info('inserting'); // (common) helper — no import
      return node.crypto.randomUUID(); // node builtin — no import
    },
  },
);
```

```js
// index.js
const { loadApplication } = require('@leonid-shutov/uncommonjs');

const app = await loadApplication({ console }, { rootDir: __dirname });
await app.book.create('DUNE');
```

## The one authoring rule

**Every `.js` app file is a single parenthesized expression that evaluates to its export.**
The file is executed in a VM and its last expression becomes the module's value.

```js
// object module
({ title: 'Book', create: (name) => db.insert(name) });
```

```js
// function module
async (code) => (await db.query('SELECT * FROM book WHERE code = $1', [code])).rows[0] ?? null;
```

Don't use `module.exports`, `export`, or a bare `{ ... }` block — wrap objects in parentheses
(a bare `{ ... }` is parsed as a block and exports nothing).

## Bootstrapping

```js
loadApplication(sandbox = {}, { rootDir = process.cwd(), applicationPath = 'src' })
```

Returns the populated sandbox object. `sandbox` holds the globals you want to inject
(e.g. `console`, `process`, or your own UI/db handles).

## Injected globals

Available inside every file, no imports required:

| Global        | What it is                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node.*`      | Every Node builtin: `node.fs`, `node.path`, `node.crypto`, `node.timers`, …                                                                                           |
| `npm.*`       | Every dependency in your app's `package.json`, keyed by package name: `npm['@mtcute/bun']`, `npm.neovim`                                                              |
| error classes | `DomainError`, `NotFoundError`, `AlreadyExistsError`, `ConstraintViolationError`, `AuthorizationError`, `UnexpectedError`, `createDomainError`, and the `PASS` symbol |
| `__rootDir`   | The resolved application root                                                                                                                                         |
| your sandbox  | Anything you passed as the first argument to `loadApplication`                                                                                                        |
| `self`        | The current module's own members (see below)                                                                                                                          |

## Directory & filename conventions

The tree shape defines the module graph:

| Pattern                       | Behavior                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `N-name` (e.g. `1-messenger`) | Sets load order; the numeric prefix is **stripped** from the key (`app.messenger`).                                     |
| `foo/foo.js`                  | A file named after its directory **merges into the module itself** instead of nesting.                                  |
| `(common)/` _(reserved)_      | Loaded **first**, into the **parent** context — shared with every sibling module.                                       |
| `(getters)/` _(reserved)_     | Each file is `() => value` and becomes a **lazy getter** (runs on first access).                                        |
| `(private)/` _(reserved)_     | Files load into the module's `self` only — internal, hidden from the outside.                                           |
| `(anythingElse)/`             | Any other parenthesized name is **grouping only**; files load in flat. `(methods)`, `(handlers)`, etc. are not special. |
| plain-named dir               | Becomes a nested submodule (`user/profile/` → `app.user.profile`).                                                      |

Only `(common)`, `(getters)`, and `(private)` are reserved.

### `self`

`self` lets a file reach its module's other members without imports:

```js
// book/(methods)/report.js
() => {
  console.log(self.table); // from book/book.js (merged into the module)
  console.log(self.create.name); // sibling file book/create.js
};
```

Function modules see the whole module through `self`; object modules get their own `self`
scope. `(private)/` members are reachable via `self` but absent from the external module.

## Service entries

Any object entry shaped `{ method, description?, expectedErrors? }` is automatically wrapped
into a callable that logs, runs the method (sync or async), and maps thrown errors:

```js
({
  create: {
    description: 'Creating a book',
    method: repository.book.create,
    expectedErrors: {
      BOOK_ALREADY_EXISTS: PASS, // re-throw the original error unchanged
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
});
```

On throw, `error.code` is looked up in `expectedErrors`:

- value is `PASS` → the original error is re-thrown untouched;
- value is a domain error → it is thrown with `.cause` set to the original;
- no match → an `UnexpectedError` is thrown (with `.cause` set).

`description` (a string or `(...args) => string`) is logged via the `logger` or `console` you
injected. A lower repository layer commonly maps driver codes to domain errors:

```js
({
  create: {
    method: ({ code, name }) => db.pg.query('INSERT INTO "Book"(code,name) VALUES($1,$2)', [code, name]),
    expectedErrors: {
      23505: AlreadyExistsError.from('book'), // Postgres unique-violation
    },
  },
  getByCode: async (code) => (await db.pg.query('SELECT * FROM "Book" WHERE code = $1', [code])).rows[0] ?? null,
});
```

## Errors

- `DomainError` — base class carrying a `.code`.
- `createDomainError(name, { message, code, parent })` — factory for your own error classes.
- Built-ins: `UnexpectedError`, `NotFoundError`, `AlreadyExistsError`,
  `ConstraintViolationError`, `AuthorizationError`.
- `.from(entity, options)` helpers auto-generate message and code:
  `NotFoundError.from('book')` → code `BOOK_NOT_FOUND`;
  `AlreadyExistsError.from('book')` → code `BOOK_ALREADY_EXISTS`. Override with
  `{ code, meta, cause }`.
- `PASS` — symbol used in `expectedErrors` to re-throw the original error.

## REST layer

`loadRestApplication(sandbox, options)` runs `loadApplication` first, then builds a router
from the modules under `sandbox.api`:

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
      body: { code: 'string', name: 'string' }, // metaschema
      handler: async ({ body }) => app.book.create(body),
      expectedErrors: { BOOK_ALREADY_EXISTS: PASS },
    },
  },
});
```

```js
const { loadRestApplication } = require('@leonid-shutov/uncommonjs');
const router = await loadRestApplication({ console }, { rootDir: __dirname });
```

Definition fields: `handler({ path, query, body, ... })`, `query`/`body` (metaschema schemas
validated before the handler runs), `response` (a value or `(result) => body`), and `status`
(a number or `(result) => number`, default `200`). Domain errors map to HTTP status:

| Error                      | Status |
| -------------------------- | ------ |
| `ValidationError`          | 400    |
| `AuthorizationError`       | 401    |
| `NotFoundError`            | 404    |
| `AlreadyExistsError`       | 409    |
| `ConstraintViolationError` | 422    |
| anything else              | 500    |

## API

Everything is re-exported from the package entry point (`uncommon.js`):

- **Loader** — `loadFile`, `loadDir`
- **Application** — `loadApplication`
- **REST** — `loadRestApplication`
- **Errors** — `PASS`, `DomainError`, `createDomainError`, `UnexpectedError`,
  `NotFoundError`, `AlreadyExistsError`, `ConstraintViolationError`, `AuthorizationError`

## License

MIT © Leonid Shutov
