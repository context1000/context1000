# context1000

## Prepare and index your documentation

### Create documentation

Use special docs template from: <https://github.com/context1000/docs>.

```bash
git clone https://github.com/context1000/docs my-cool-docs
```

on your local machine in /path/to/my-cool-docs create documentation for your projects in `docs` directory. (see README <https://github.com/context1000/docs>)

### Install context1000

```bash
npm i context1000 -g
```

### Set up environment

```bash
touch .env
echo "CHROMA_URL=http://localhost:8000" >> .env
echo "OPENAI_API_KEY=your-key" >> .env
```

### Start ChromaDB

```bash
docker run -p 8000:8000 chromadb/chroma
```

### Index your documentation

Use special docs template from: <https://github.com/context1000/docs>.

```bash
npx context1000 index /path/to/docs
```

## Use your documentation with MCP

### Claude Code

#### Local server connection (stdio transport)

```bash
claude mcp add context1000 \
  -e OPENAI_API_KEY=your-key \
  -e CHROMA_URL=http://localhost:8000 \
  -- npx context1000 mcp
```

#### Remote server connection (HTTP/SSE transport)

Note: dont forget about env variables OPENAI_API_KEY and OPENAI_API_KEY

Start the MCP server with HTTP or SSE transport:

```bash
# Start server on default port 3000 with HTTP transport
npx context1000 mcp --transport http

# Start server with SSE transport
npx context1000 mcp --transport sse

# Or specify a custom port
npx context1000 mcp --transport http --port 3001
npx context1000 mcp --transport sse --port 3001
```

Then add it to Claude Code:

```bash
# Using HTTP transport (default port)
claude mcp add --transport http context1000 http://localhost:3000/mcp

# Using SSE transport
claude mcp add --transport sse context1000 http://localhost:3000/sse

# Using custom port
claude mcp add --transport http context1000 http://localhost:3001/mcp
claude mcp add --transport sse context1000 http://localhost:3001/sse

# For remote servers (replace with your server's URL)
claude mcp add --transport http context1000 https://myhost:3000/mcp
claude mcp add --transport sse context1000 https://myhost:3000/sse
```
