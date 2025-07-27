import "dotenv/config";

import { ChromaClient } from "./chroma-client.js";

export interface QueryResult {
  document: string;
  metadata: {
    title: string;
    type: string;
    filePath: string;
    tags: string[];
    projects: string[];
    status?: string;
  };
  relevanceScore: number;
}

export class QueryInterface {
  private chromaClient: ChromaClient;

  constructor() {
    this.chromaClient = new ChromaClient();
  }

  async initialize(collectionName: string = "context1000", docsPath?: string): Promise<void> {
    await this.chromaClient.initialize(collectionName, docsPath);
  }

  async queryForCodeReview(
    query: string,
    options: {
      maxResults?: number;
      filterByType?: string[];
      filterByProject?: string[];
      includeRelated?: boolean;
    } = {}
  ): Promise<QueryResult[]> {
    const { maxResults = 5, filterByType, filterByProject, includeRelated = true } = options;

    const filters: Record<string, any> = {};

    if (filterByType && filterByType.length > 0) {
      filters.type = { $in: filterByType };
    }

    const whereClause = Object.keys(filters).length > 0 ? filters : undefined;
    const results = await this.chromaClient.queryDocuments(query, maxResults, whereClause);

    return results.documents
      .map((doc, index) => ({
        document: doc,
        metadata: {
          title: results.metadatas[index].title,
          type: results.metadatas[index].type,
          filePath: results.metadatas[index].filePath,
          tags: JSON.parse(results.metadatas[index].tags || "[]"),
          projects: JSON.parse(results.metadatas[index].projects || "[]"),
          status: results.metadatas[index].status,
        },
        relevanceScore: 1 - (results.distances[index] || 0),
      }))
      .filter((result) => {
        if (filterByProject && filterByProject.length > 0) {
          return result.metadata.projects.some((project: string) => filterByProject.includes(project));
        }
        return true;
      });
  }

  async getSecurityRules(): Promise<QueryResult[]> {
    return this.queryForCodeReview("security rules guidelines", {
      filterByType: ["rule"],
      maxResults: 10,
    });
  }

  async getOAuthGuidelines(): Promise<QueryResult[]> {
    return this.queryForCodeReview("oauth authentication csrf security", {
      filterByType: ["adr", "guide", "rule"],
      maxResults: 10,
    });
  }

  async getProjectSpecificRules(projectName: string): Promise<QueryResult[]> {
    return this.queryForCodeReview("project guidelines rules standards", {
      filterByProject: [projectName],
      maxResults: 10,
    });
  }

  async searchByKeywords(keywords: string[]): Promise<QueryResult[]> {
    const query = keywords.join(" ");
    return this.queryForCodeReview(query, {
      maxResults: 10,
    });
  }

  async getCriticalRules(): Promise<QueryResult[]> {
    return this.queryForCodeReview("critical security requirements", {
      maxResults: 10,
    });
  }
}

async function interactiveQuery() {
  if (process.argv.length < 3) {
    console.log('Usage: npm run query "<search query>"');
    console.log('Example: npm run query "oauth security guidelines"');
    return;
  }

  const query = process.argv.slice(2).join(" ");

  try {
    console.log(`Searching for: "${query}"\n`);

    const queryInterface = new QueryInterface();
    await queryInterface.initialize();

    const results = await queryInterface.queryForCodeReview(query);

    if (results.length === 0) {
      console.log("No relevant documents found.");
      return;
    }

    console.log(`Found ${results.length} relevant documents:\n`);

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.metadata.title}`);
      console.log(`   Type: ${result.metadata.type}`);
      console.log(`   File: ${result.metadata.filePath}`);
      console.log(`   Relevance: ${(result.relevanceScore * 100).toFixed(1)}%`);
      if (result.metadata.tags.length > 0) {
        console.log(`   Tags: ${result.metadata.tags.join(", ")}`);
      }
      if (result.metadata.projects.length > 0) {
        console.log(`   Projects: ${result.metadata.projects.join(", ")}`);
      }
      console.log(`   Content: ${result.document.slice(0, 200)}...`);
      console.log("");
    });
  } catch (error) {
    console.error("Error querying documents:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  interactiveQuery();
}
