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

  async queryDocs(
    query: string,
    options: {
      maxResults?: number;
      filterByType?: string[];
      filterByProject?: string[];
    } = {}
  ): Promise<QueryResult[]> {
    const { maxResults = 5, filterByType, filterByProject } = options;

    const filters: Record<string, any> = {};

    if (filterByType && filterByType.length > 0) {
      filters.type = { $in: filterByType };
    }

    if (filterByProject && filterByProject.length > 0) {
      filters.projects = { $in: filterByProject };
    }

    const whereClause = Object.keys(filters).length > 0 ? filters : undefined;
    const results = await this.chromaClient.queryDocuments(query, maxResults, whereClause);

    return results.documents.map((doc, index) => ({
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
    }));
  }
}
