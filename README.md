# arweave-gateway

Ingests Arweave transactions by tag.

Exposes API to query transactions by tag.

## Migrations

Run `npm run migrate up` to run PostgreSQL migrations.

## Running API server and ingestion service

```bash
node --experimental-modules --es-module-specifier-resolution=node src/runner.js
node --experimental-modules --es-module-specifier-resolution=node src/server.js
```

## API

Example queries:

```bash
curl localhost:4000/transactions/app-name/scribe-alpha-00
curl localhost:4000/user/1Q7RzrvlUvhVQDY9wirNwoQR-59qV7gdbZstBcDZpZo/transactions
curl localhost:4000/user/1Q7RzrvlUvhVQDY9wirNwoQR-59qV7gdbZstBcDZpZo/app-name/scribe-alpha-00/transactions
curl localhost:4000/transaction/5YAkcCCp9pZ-AiLJCi8RZ9GgpgHAFZ4lZ7ANmPlpCLw/content
```
