# uncommon-js ⚙️

Convention over configuration for JavaScript.

You don't write `require` or `import` in your files. You lay code out as a directory tree,
and the shape of that tree _is_ the wiring: the loader walks it, runs every file in its own
`node:vm` context, and hands back a single object graph. Builtins, npm packages and your own
shared helpers arrive as globals, so files stay small and say nothing about where their
dependencies live.

Runs on Node, Bun and Deno. No runtime dependencies.

## Install

```sh
npm install @leonid-shutov/uncommonjs
```

## The idea

```
src/
  (common)/
    logger.js        # loaded first, shared with every sibling
  book/
    book.js          # merges into the book module itself
    create.js        # becomes app.book.create
```

```js
// src/(common)/logger.js
({ info: (message) => console.log(`[app] ${message}`) });
```

```js
// src/book/book.js
({ table: 'book' });
```

```js
// src/book/create.js
(name) => {
  logger.info(`inserting into ${self.table}`); // the (common) helper, and the module itself
  return node.crypto.randomUUID(); // a node builtin, no import
};
```

```js
// index.js
const { loadApplication } = require('@leonid-shutov/uncommonjs');

const app = await loadApplication({ console }, { rootDir: __dirname });
await app.book.create('DUNE');
```

The first argument is the sandbox — the globals you want the app to see, like `console`, a
database handle, or a UI toolkit. You get it back, populated. `src` is the default tree;
override it with `applicationPath`.

## The one rule

**A file's last expression is its export.**

```js
({ title: 'Book', create: (name) => db.insert(name) });
```

Anything above that last expression is yours — comments, JSDoc, whatever constants and
helpers the file needs. They stay private to it.

```js
const sql = 'select * from book where code = $1';

async (code) => (await db.query(sql, [code])).rows[0] ?? null;
```

No `module.exports`, no `export`. The only thing to remember is to wrap a returned object in
parentheses: a bare `{ ... }` is a block, and blocks export nothing.

## What every file can see

|              |                                                                            |
| ------------ | -------------------------------------------------------------------------- |
| `node.*`     | every Node builtin — `node.fs`, `node.path`, `node.crypto`, …              |
| `npm.*`      | every dependency from your `package.json` — `npm.pg`, `npm['@mtcute/bun']` |
| `self`       | the module the file belongs to; writes through it land on the module       |
| `__rootDir`  | the resolved application root                                              |
| errors       | `DomainError`, `NotFoundError` and friends (below)                         |
| your sandbox | whatever you passed to `loadApplication`                                   |

## Conventions

|                   |                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `book/`           | a submodule — `app.book`                                                                 |
| `book/book.js`    | named after its own directory, so it merges _into_ the module instead of nesting         |
| `1-config/`       | a numeric prefix sets load order and is stripped from the key — `app.config`             |
| `(common)/`       | loaded first, into the **parent** context, shared with every sibling                     |
| `(getters)/`      | each file is `() => value` and becomes a lazy property, evaluated on first read          |
| `(anythingElse)/` | grouping only, fully transparent: files _and_ subdirectories load as if it weren't there |

Only `(common)` and `(getters)` mean anything to the loader. `(methods)`, `(public)`,
`(private)` and the rest are there for you.

## Errors

`DomainError` is the base class and carries a `.code`. Shipped: `UnexpectedError`,
`NotFoundError`, `AlreadyExistsError`, `ConstraintViolationError`, `AuthorizationError`.

```js
throw NotFoundError.from('book'); // "book not found", code BOOK_NOT_FOUND
```

Build your own with `createDomainError(name, { message, code, parent })`.

## In the wild

[tuigram](https://github.com/leonid-shutov/tuigram), a terminal Telegram client — 180 files
under `src/`, not one import among them.

## Prior art

Inspired by Metarhia's [Impress](https://github.com/metarhia/impress)

## License

MIT © Leonid Shutov
