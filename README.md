# clipboard-serverless

A personal clipboard service running on Cloudflare Workers, backed by KV (metadata) and R2 (content).

## Features

- Push text, files, or any binary content to a remote clipboard
- Retrieve the latest clip or list all clips
- Create shareable public links with configurable TTL
- Automatic garbage collection via scheduled cron
- Bearer token authentication

## Setup

1. Copy the config template and fill in your KV namespace ID:

   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create the KV namespace and R2 bucket (if not already done):

   ```bash
   npx wrangler kv namespace create CLIPBOARD
   npx wrangler r2 bucket create clipboard-serverless
   ```

4. Set the auth token secret:

   ```bash
   npx wrangler secret put AUTH_TOKEN
   ```

5. Deploy:

   ```bash
   npx wrangler deploy
   ```

## API

All endpoints except `GET /s/:shareId` require `Authorization: Bearer <token>` or `?token=<token>`.

### Clips

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/clip` | Push a new clip (body = content, `Content-Type` header sets MIME type, optional `X-Filename` and `X-Device` headers) |
| `GET` | `/api/clip` | List clips (`?limit=50&before=<id>`) |
| `GET` | `/api/clip/latest` | Get the latest clip content (`?meta=true` for metadata only) |
| `GET` | `/api/clip/:id` | Get clip metadata |
| `GET` | `/api/clip/:id/raw` | Get clip raw content |
| `DELETE` | `/api/clip/:id` | Delete a clip |

### Share Links

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/clip/latest/share` | Create a share link for the latest clip |
| `POST` | `/api/clip/:id/share` | Create a share link for a specific clip (optional `{"ttl": <seconds>}` body) |
| `GET` | `/s/:shareId` | Access a shared clip (public) |

### Maintenance

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/gc` | Trigger garbage collection manually |

## Development

```bash
npx wrangler dev
```

## License

MIT
