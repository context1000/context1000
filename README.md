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

#### Remote server connection (HTTP transport)

Start the MCP server with HTTP transport:

```bash
# Start server on default port 3000
npx context1000 mcp --transport http

# Or specify a custom port
npx context1000 mcp --transport http --port 3001
```

Then add it to Claude Code:

```bash
# Using default port
claude mcp add --transport http context1000 http://localhost:3000/mcp

# Using custom port
claude mcp add --transport http context1000 http://localhost:3001/mcp

# For remote servers (replace with your server's URL)
claude mcp add --transport http context1000 https://myhost:3000/mcp
```
