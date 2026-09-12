# uncommon‑js ⚙️

**uncommon‑js** — a convention‑over‑configuration module system for Node.js built on V8
sandboxing (`node:vm`).

You don't write `require`/`import` in your app files. Instead you lay code out as a directory
tree under `src/`, and `loadApplication()` walks the tree, runs each file in an isolated VM
context, and wires everything into a single object graph (the "sandbox") that it returns.
Shared dependencies, Node builtins, npm packages, and error helpers are injected as globals —
so app files stay tiny and focused on logic.

The library has no runtime dependencies.

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
({ info: (m) => console.log(`[app] ${m}`) });
```

```js
// src/book/book.js
({ table: 'book' });
```

```js
// src/book/create.js
(name) => {
  logger.info('inserting'); // (common) helper — no import
  return node.crypto.randomUUID(); // node builtin — no import
};
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
| error classes | `DomainError`, `NotFoundError`, `AlreadyExistsError`, `ConstraintViolationError`, `AuthorizationError`, `UnexpectedError`, and `createDomainError` |
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
| `(anythingElse)/`             | Any other parenthesized name is **grouping only** and fully transparent; its files _and_ subdirectories load in flat, as if they lived in the parent. `(methods)`, `(handlers)`, etc. are not special. |
| plain-named dir               | Becomes a nested submodule (`user/profile/` → `app.user.profile`).                                                      |

Only `(common)` and `(getters)` are reserved.

### `self`

`self` lets a file reach its module's other members without imports:

```js
// book/(methods)/report.js
() => {
  console.log(self.table); // from book/book.js (merged into the module)
  console.log(self.create.name); // sibling file book/create.js
};
```

Writes go through too — `self.prop = 2` sets `prop` on the module itself.

Function modules see the whole module through `self`; object modules get their own `self`
scope.

## Errors

- `DomainError` — base class carrying a `.code`.
- `createDomainError(name, { message, code, parent })` — factory for your own error classes.
- Built-ins: `UnexpectedError`, `NotFoundError`, `AlreadyExistsError`,
  `ConstraintViolationError`, `AuthorizationError`.
- `.from(entity, options)` helpers auto-generate message and code:
  `NotFoundError.from('book')` → code `BOOK_NOT_FOUND`;
  `AlreadyExistsError.from('book')` → code `BOOK_ALREADY_EXISTS`. Override with
  `{ code, meta, cause }`.

## API

Everything is re-exported from the package entry point (`uncommon.js`):

- **Loader** — `loadFile`, `loadDir`
- **Application** — `loadApplication`
- **Errors** — `DomainError`, `createDomainError`, `UnexpectedError`,
  `NotFoundError`, `AlreadyExistsError`, `ConstraintViolationError`, `AuthorizationError`

## License

MIT © Leonid Shutov
