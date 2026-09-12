# Future improvements

Work that should land before or shortly after `1.0.0`, ordered by how much it hurts a user
who installs the package today. Behavior that is already wrong but shipped is tracked
separately in [known limitations](./known-limitations.md).

## 1. Errors from application files have no file name

`lib/vm.js:9` builds the script without a `filename`, so every failure inside the tree —
syntax error, thrown exception, undefined global — is reported against
`evalmachine.<anonymous>`:

```
evalmachine.<anonymous>:2
undefinedThing.boom();
^

ReferenceError: undefinedThing is not defined
    at evalmachine.<anonymous>:2:1
```

This is the most damaging gap for a loader whose whole premise is that files never name each
other: there is no import graph to trace a stack back through by hand, so a single typo in
one of a few hundred files gives no clue which file it was in. Line numbers are also off by
one, because `runInContext` prepends `'use strict';\n` to the source.

### Planned

Pass the path and compensate for the prepended line:

```js
const script = new vm.Script(code, { filename: filePath, lineOffset: -1 });
```

That alone restores both the name and the correct line:

```
/app/src/bad.js:1
undefinedThing.boom();
```

## 2. Deprecation warnings on every startup

Building the builtin table eagerly (`lib/deps.js:25-34`) touches deprecated and experimental
modules, so a hello-world application prints five warnings on Node and eight on Deno before
any user code runs:

```
(node:135821) [DEP0192] DeprecationWarning: The _tls_common module is deprecated...
(node:135821) [DEP0040] DeprecationWarning: The `punycode` module is deprecated...
(node:135821) ExperimentalWarning: WASI is an experimental feature...
```

Nothing is broken, but it is the first thing a new user sees.

### Planned

The filter and laziness already described under
[`node.*` contains stray keys](./known-limitations.md#node-contains-stray-keys). Filtering
`_`-prefixed entries is enough to silence most of it; making `node.*` lazy silences the rest,
since nothing would touch `punycode` or `sys` unless an application asked for them.

## 3. Dependency failures point at the library, not the application

A package listed in the application's `package.json` but not installed fails inside
`lib/deps.js`, and the message names this library's path rather than anything the user wrote:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'heavy-pkg'
    imported from .../uncommon-js/lib/deps.js
```

Combined with item 1, neither of the two most common failures points at the user's code.
Resolving through `rootDir` (see
[`npm.*` is loaded eagerly](./known-limitations.md#npm-is-loaded-eagerly)) and deferring the
failure to first use fixes the attribution along with the eagerness.

## 4. Missing configuration is reported as a raw filesystem error

Two setup mistakes surface as unhandled low-level errors rather than as guidance:

| Mistake                        | What the user sees                                        |
| ------------------------------ | --------------------------------------------------------- |
| no `package.json` at `rootDir` | `MODULE_NOT_FOUND: Cannot find module '.../package.json'` |
| no tree directory              | `ENOENT: no such file or directory, scandir '.../src'`    |

That `loadTree` requires a `package.json` at `rootDir` is undocumented, and the `src`
default is easy to miss. Both deserve a thrown error naming the option that would fix them
(`rootDir`, `treePath`).

## 5. No published types

`typescript` and `@types/node` are development dependencies, but there is no `tsconfig.json`,
no `.d.ts`, and no `types` field in `package.json`, so editors give consumers nothing for
`loadTree`'s options object. Either ship hand-written declarations for the three exported
functions and point `types` at them, or drop the two dependencies.

## 6. No continuous integration

`npm test` and `npm run lint` are not run anywhere on push. The `engines` floor
(`node >= 20`) is likewise a claim rather than a tested guarantee — the suite has only been
exercised on Node 26, and the Bun and Deno support the README advertises is not covered
either. A matrix across the three runtimes would turn all of it into something verified.

## 7. README does not link this directory

Neither this file nor the known limitations are reachable from the README, so a reader on
npm never learns about the eager `npm.*` loading until a dependency's import side effect
surprises them. A short "Caveats" section linking both would fix it.

## 8. Bare `node --test` collects fixtures

The `test` script pins the runner to `test/test.js`, but a plain `node --test` still treats
the 17 fixture files under `test/application/` as test files. They pass trivially and inflate
the reported count from 5 to 23. Moving the fixtures out of the runner's default glob — or
naming the real suite `*.test.js` and letting the runner find it — keeps the count honest.
