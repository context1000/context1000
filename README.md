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
npm i -G context1000
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

```bash
npx context1000 index /path/to/docs
```

## Use your documentation with MCP

### Claude Code

In your target project run:

```bash
claude mcp add context1000 \
  -e OPENAI_API_KEY=your-key \
  -e CHROMA_URL=http://localhost:8000 \
  -- npx context1000 mcp <project-name>
```
