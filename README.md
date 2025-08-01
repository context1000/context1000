# @context1000/rag

## Quick Start

**Install dependencies**:

```bash
npm install
```

**Set up environment**:

```bash
cp .env.example .env
# Edit .env with your OpenAI API key and ChromaDB URL
```

**Start ChromaDB** (if running locally):

```bash
docker run -p 8000:8000 chromadb/chroma
```

**Index your documentation**:

```bash
npm run index </path/to/docs>
```

## MCP Server

### Claude code

```bash
claude mcp add context1000 \
  -e OPENAI_API_KEY=your-key \
  -e CHROMA_URL=http://localhost:8000 \
  -- node /path/to/rag/dist/mcp-server.js project-name /path/to/docs
```
