# Future improvements

Work that should land before or shortly after `1.0.0`, ordered by how much it hurts a user
who installs the package today. Behavior that is already wrong but shipped is tracked
separately in [known limitations](./known-limitations.md).

## 1. Dependency failures point at the library, not the application

A package listed in the application's `package.json` but not installed fails inside
`lib/deps.js`, and the message names this library's path rather than anything the user wrote:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'heavy-pkg'
    imported from .../uncommon-js/lib/deps.js
```

Packages already resolve through `rootDir`, but a name that does not resolve at all falls back
to an `import()` from this library (see
[ESM dependencies are loaded eagerly](./known-limitations.md#esm-dependencies-are-loaded-eagerly)).
Throwing an error that names the package and `rootDir` there would fix the attribution.

## 2. Missing configuration is reported as a raw filesystem error

Two setup mistakes surface as unhandled low-level errors rather than as guidance:

| Mistake                        | What the user sees                                        |
| ------------------------------ | --------------------------------------------------------- |
| no `package.json` at `rootDir` | `MODULE_NOT_FOUND: Cannot find module '.../package.json'` |
| no tree directory              | `ENOENT: no such file or directory, scandir '.../src'`    |

That `loadTree` requires a `package.json` at `rootDir` is undocumented, and the `src`
default is easy to miss. Both deserve a thrown error naming the option that would fix them
(`rootDir`, `treePath`).

## 3. No published types

`typescript` and `@types/node` are development dependencies, but there is no `tsconfig.json`,
no `.d.ts`, and no `types` field in `package.json`, so editors give consumers nothing for
`loadTree`'s options object. Either ship hand-written declarations for the three exported
functions and point `types` at them, or drop the two dependencies.

## 4. Bun and Deno are not tested

CI runs the linter on Node 26 and the suite on Node 20, 22, 24 and 26, so the `engines` floor
(`node >= 20`) is verified. The Bun and Deno support the README advertises is not, and on Bun
it does not fully hold: `bun test ./test/test.js` fails 2 of the 9 tests on Bun 1.4.3.

- Bun ignores `vm.Script`'s `lineOffset`, so an error names the right file but a line two
  below the real one.
- Bun's `require()` loads an ES module even when it uses top-level await, and returns its
  namespace, so `npm.*` holds `{ default }` instead of the package's export. This one is not
  Bun's alone: Node does the same for an ES module without top-level await, which the suite
  does not cover.

Deno has not been tried. A CI job per runtime would turn the claim into something verified.

## 5. README does not link this directory

Neither this file nor the known limitations are reachable from the README, so a reader on
npm never learns that ESM dependencies load eagerly until one's import side effect
surprises them. A short "Caveats" section linking both would fix it.

## 6. Bare `node --test` collects fixtures

The `test` script pins the runner to `test/test.js`, but a plain `node --test` still treats
the 17 fixture files under `test/application/` as test files. They pass trivially and inflate
the reported count from 5 to 23. Moving the fixtures out of the runner's default glob — or
naming the real suite `*.test.js` and letting the runner find it — keeps the count honest.
