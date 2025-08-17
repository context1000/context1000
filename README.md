# context1000

**context1000** is a documentation format for software systems, designed for integration with
artificial intelligence tools. The key artifacts are ADRs and RFCs, enriched with formalized links between documents.

This project demonstrates an implementation of a context portal and consists of two parts:

1. Documentation format (<a href="https://github.com/context1000/docs" target="_blank">@context1000/docs</a>)
2. <a href="https://github.com/context1000/context1000" target="_blank">Simple RAG</a> (Retrieval Augmented Generation) for this format with the ability to run locally.

## Getting started

### Install

Install context1000 package globally:

```bash
npm i context1000 -g
```

### Set up environment

In the project where you use agents, create a `.env` file in the root directory of the project.

```bash
touch .env
echo "CHROMA_URL=http://localhost:8000" >> .env
echo "OPENAI_API_KEY=your-key" >> .env
```

### Start ChromaDB

```bash
docker run -p 8000:8000 chromadb/chroma
```

### Prepare documentation

Start with special docs template: <https://github.com/context1000/templates>. Or grab a raw template from <https://github.com/context1000/docs>.

### Index your documentation

It will be vectorized and stored documentation content in ChromaDB.

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
