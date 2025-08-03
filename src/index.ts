#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import path from "path";
import { DocumentProcessor } from "./document-processor.js";
import { ChromaClient } from "./chroma-client.js";
import packageJson from "../package.json";

const program = new Command();

program.name("context1000").description("CLI for context1000 RAG system").version(packageJson.version);

program
  .command("index")
  .description("Index documents for RAG system")
  .argument("<docs-path>", "Path to documents directory")
  .action(async (docsPath: string) => {
    try {
      console.log("Starting document indexing...");

      const finalDocsPath = path.resolve(docsPath);
      console.log(`Processing documents from: ${finalDocsPath}`);

      const processor = new DocumentProcessor();
      const chunks = await processor.processDocumentsToChunks(finalDocsPath);

      console.log(`Processed ${chunks.length} document chunks`);

      if (chunks.length === 0) {
        console.log("No document chunks to index");
        return;
      }

      const chromaClient = new ChromaClient();
      await chromaClient.initialize("context1000");

      await chromaClient.deleteCollection("context1000");
      await chromaClient.initialize("context1000");

      await chromaClient.addDocuments(chunks);

      const info = await chromaClient.getCollectionInfo();
      console.log("Collection info:", info);

      console.log("Document indexing completed successfully!");

      console.log("\nIndexed document chunks:");
      const documentsMap = new Map<string, any[]>();
      chunks.forEach((chunk) => {
        const docId = chunk.metadata.filePath;
        if (!documentsMap.has(docId)) {
          documentsMap.set(docId, []);
        }
        documentsMap.get(docId)!.push(chunk);
      });

      documentsMap.forEach((chunks, filePath) => {
        const firstChunk = chunks[0];
        console.log(
          `- ${firstChunk.metadata.title} (${firstChunk.metadata.type}) - ${chunks.length} chunks - ${filePath}`
        );
      });
    } catch (error) {
      console.error("Error indexing documents:", error);
      process.exit(1);
    }
  });

program
  .command("mcp")
  .description("Start MCP server")
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", "3000")
  .action(async (options) => {
    try {
      const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
      const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
      const { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } = await import(
        "@modelcontextprotocol/sdk/types.js"
      );
      const { QueryInterface } = await import("./query.js");

      const transport = options.transport || "stdio";
      const port = parseInt(options.port) || 3000;

      const server = new Server(
        {
          name: "context1000",
          version: packageJson.version,
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      let queryInterface: any = null;

      async function initializeRAG() {
        if (!queryInterface) {
          console.error(`Initializing global RAG for context1000`);

          queryInterface = new QueryInterface();
          await queryInterface.initialize(`context1000`);
        }
        return queryInterface;
      }

      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: [
            {
              name: "search_documentation",
              description:
                "Search through context1000 documentation repository. Can search globally or within specific projects. Searches through ADRs, RFCs, guides, rules, and project-specific documentation.",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description:
                      "Natural language search query for finding relevant documentation (e.g., 'authentication patterns', 'database migration rules', 'testing guidelines')",
                  },
                  project: {
                    type: "string",
                    description:
                      "Optional project name to search within specific project documentation (e.g., 'project1', 'project2'). If not provided, searches globally.",
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
            case "search_documentation": {
              const { query, project, type_filter, max_results = 10 } = args as any;

              if (!query) {
                throw new McpError(ErrorCode.InvalidParams, "query is required");
              }

              const options: any = {
                maxResults: max_results,
                filterByType: type_filter,
              };

              if (project) {
                options.filterByProject = [project];
              }

              const results = await rag.queryDocs(query, options);

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

      if (transport === "stdio") {
        const stderrTransport = new StdioServerTransport();
        await server.connect(stderrTransport);
        console.error("context1000 RAG MCP server running on stdio");
      } else if (transport === "http") {
        const http = await import("http");
        const url = await import("url");

        const httpServer = http.createServer(async (req, res) => {
          const parsedUrl = url.parse(req.url || "", true);

          // CORS headers
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");

          if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
          }

          if (parsedUrl.pathname === "/mcp" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk.toString();
            });

            req.on("end", async () => {
              try {
                const request = JSON.parse(body);
                const response = await server.request(request);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(response));
              } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Internal server error" }));
              }
            });
          } else if (parsedUrl.pathname === "/ping") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", server: "context1000" }));
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
          }
        });

        const startServer = (currentPort: number, maxAttempts = 10) => {
          httpServer.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE" && currentPort < port + maxAttempts) {
              console.warn(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
              startServer(currentPort + 1, maxAttempts);
            } else {
              console.error(`Failed to start server: ${err.message}`);
              process.exit(1);
            }
          });

          httpServer.listen(currentPort, () => {
            console.error(`context1000 RAG MCP server running on http://localhost:${currentPort}/mcp`);
          });
        };

        startServer(port);
      } else {
        throw new Error(`Unsupported transport: ${transport}`);
      }
    } catch (error) {
      console.error("Failed to run MCP server:", error);
      process.exit(1);
    }
  });

program.parse();
