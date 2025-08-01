#!/usr/bin/env node

import "dotenv/config";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { QueryInterface } from "./query.js";
import { DocumentProcessor } from "./document-processor.js";
import path from "path";
import fs from "fs-extra";

const projectName = process.argv[2];
const docsPath = process.argv[3];

if (!projectName || !docsPath) {
  console.error("Usage: node mcp-server.js <project-name> <docs-path>");
  console.error("Example: node mcp-server.js litres-id /path/to/docs");
  process.exit(1);
}

const server = new Server(
  {
    name: "context1000",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let queryInterface: QueryInterface | null = null;

async function processDocsFromPath(docsPath: string) {
  const processor = new DocumentProcessor();
  return await processor.processDocuments(docsPath);
}

async function getProjectByName(projectName: string) {
  const projectPath = path.join(docsPath, "projects", projectName);
  const projectFile = path.join(projectPath, "project.md");

  if (!(await fs.pathExists(projectFile))) {
    throw new Error(`Project not found: ${projectName}`);
  }

  const documents = await processDocsFromPath(projectPath);
  return documents;
}

async function initializeRAG() {
  if (!queryInterface) {
    console.error(`Initializing global RAG for context1000`);

    queryInterface = new QueryInterface();
    await queryInterface.initialize(`context1000-global`, docsPath);
  }
  return queryInterface;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_project_info_by_name",
        description:
          "Retrieve all files and documentation for a specific project from the context1000 documentation repository. Returns all project files including project.md, stack.md, ADRs, RFCs, guides, and rules within the project directory.",
        inputSchema: {
          type: "object",
          properties: {
            project_name: {
              type: "string",
              description:
                "Name of the project to retrieve information for (e.g., 'litres-id', 'litres-corp-frontend')",
            },
          },
          required: ["project_name"],
        },
      },
      {
        name: "search_documentation",
        description:
          "Search through global context1000 documentation repository (excluding project-specific directories). Searches through global ADRs, RFCs, guides, and rules for architectural decisions, technical guidance, and development standards that apply across all projects.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Natural language search query for finding relevant documentation (e.g., 'authentication patterns', 'database migration rules', 'testing guidelines')",
            },
            type_filter: {
              type: "array",
              items: {
                type: "string",
                enum: ["adr", "rfc", "guide", "rule", "project"],
              },
              description:
                "Filter results by document types: 'adr' (Architecture Decision Records), 'rfc' (Request for Comments), 'guide' (implementation guides), 'rule' (coding/project rules), 'project' (project overviews)",
            },

            max_results: {
              type: "number",
              description: "Maximum number of document chunks to return (default: 10, recommended range: 5-20)",
              minimum: 1,
              maximum: 50,
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const rag = await initializeRAG();

    switch (name) {
      case "get_project_info_by_name": {
        const { project_name } = args as any;
        const project = await getProjectByName(project_name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      }

      case "search_documentation": {
        const { query, type_filter, max_results = 10 } = args as any;

        const results = await rag.queryDocs(query, {
          maxResults: max_results,
          filterByType: type_filter,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("context1000 RAG MCP server running on stdio");
}

runServer().catch((error) => {
  console.error("Failed to run server:", error);
  process.exit(1);
});
