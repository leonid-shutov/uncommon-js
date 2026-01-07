# uncommon‑js ⚙️

**uncommon‑js** — a utility library for Node.js that provides a custom module system based on code sandboxing, using isolated V8 contexts.

# Example

```js
({
  create: {
    description: 'Creating a book',
    method: repository.book.create,
    expectedErrors: {
      BOOK_ALREADY_EXISTS: PASS,
    },
  },
  getByCode: {
    description: 'Getting a book by code',
    method: async (code) => {
      const book = await repository.book.getByCode(code);
      if (book === null) throw NotFoundError.from('book', { meta: { code } });
      return book;
    },
    expectedErrors: {
      BOOK_NOT_FOUND: PASS,
    },
  },
});
```

```js
({
  create: {
    method: ({ code, name }) => db.pg.query(`INSERT INTO "public"."Book" (code, name) VALUES ($1, $2)`, [code, name]),
    expectedErrors: {
      23505: AlreadyExistsError.from('book'),
    },
  },
  getByCode: async (code) =>
    (await db.pg.query(`SELECT * FROM "public"."Book" WHERE code = $1`, [code])).rows[0] ?? null,
});
```
