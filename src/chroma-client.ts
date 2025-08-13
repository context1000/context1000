import "dotenv/config";

import { ChromaClient as ChromaApi, Collection } from "chromadb";
import { OpenAIEmbeddingFunction } from "@chroma-core/openai";
import { ProcessedDocument, DocumentChunk, DocumentProcessor } from "./document-processor.js";

export class ChromaClient {
  private client: ChromaApi;
  private collection: Collection | null = null;
  private embeddingFunction: OpenAIEmbeddingFunction;

  constructor() {
    this.client = new ChromaApi({
      path: process.env.CHROMA_URL || "http://localhost:8000",
    });

    this.embeddingFunction = new OpenAIEmbeddingFunction({
      apiKey: process.env.OPENAI_API_KEY || "",
      modelName: "text-embedding-3-small",
    });
  }

  async initialize(collectionName: string = "context1000", docsPath?: string): Promise<void> {
    try {
      this.collection = await this.client.getCollection({
        name: collectionName,
        embeddingFunction: this.embeddingFunction,
      });
      console.log(`Connected to existing collection: ${collectionName}`);
    } catch (error) {
      this.collection = await this.client.createCollection({
        name: collectionName,
        embeddingFunction: this.embeddingFunction,
        metadata: { description: "Documentation RAG collection for code review" },
      });
      console.log(`Created new collection: ${collectionName}`);

      if (docsPath) {
        console.log(`Processing documents from: ${docsPath}`);
        const processor = new DocumentProcessor();
        const chunks = await processor.processDocumentsToChunks(docsPath);
        if (chunks.length > 0) {
          await this.addDocuments(chunks);
          console.log(`Processed and added ${chunks.length} document chunks from ${docsPath}`);
        }
      }
    }
  }

  async addDocuments(items: ProcessedDocument[] | DocumentChunk[]): Promise<void> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const ids = items.map((item) => item.id);
    const texts = items.map((item) => item.content);
    const metadatas = items.map((item) => {
      const baseMetadata = {
        title: item.metadata.title,
        type: item.metadata.type,
        tags: JSON.stringify(item.metadata.tags),
        projects: JSON.stringify(item.metadata.projects),
        status: item.metadata.status || "",
        filePath: item.metadata.filePath,
        related: JSON.stringify(item.metadata.related || {}),
      };

      if ("chunkIndex" in item.metadata) {
        return {
          ...baseMetadata,
          chunkIndex: item.metadata.chunkIndex.toString(),
          totalChunks: item.metadata.totalChunks.toString(),
          sectionType: item.metadata.sectionType || "",
          sectionTitle: item.metadata.sectionTitle || "",
          tokens: item.metadata.tokens.toString(),
        };
      }

      return baseMetadata;
    });

    await this.collection.add({
      ids,
      documents: texts,
      metadatas,
    });

    console.log(`Added ${items.length} items to collection`);
  }

  async queryDocuments(
    query: string,
    nResults: number = 5,
    filters?: Record<string, any>
  ): Promise<{
    documents: string[];
    metadatas: Record<string, any>[];
    distances: number[];
  }> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const queryParams: any = {
      queryTexts: [query],
      nResults,
    };

    if (filters) {
      queryParams.where = filters;
    }

    const results = await this.collection.query(queryParams);

    return {
      documents: (results.documents[0] || []).filter((doc): doc is string => doc !== null),
      metadatas: (results.metadatas[0] || []).filter((meta): meta is Record<string, any> => meta !== null),
      distances: (results.distances?.[0] || []).filter((dist): dist is number => dist !== null),
    };
  }

  async deleteCollection(collectionName: string = "context1000"): Promise<void> {
    try {
      await this.client.deleteCollection({ name: collectionName });
      console.log(`Deleted collection: ${collectionName}`);
    } catch (error) {
      console.warn(`Could not delete collection ${collectionName}:`, error);
    }
  }

  async listCollections(): Promise<string[]> {
    const collections = await this.client.listCollections();
    return collections.map((c: any) => c.name);
  }

  async getCollectionInfo(): Promise<any> {
    if (!this.collection) {
      throw new Error("Collection not initialized");
    }

    const count = await this.collection.count();
    return {
      name: this.collection.name,
      count,
      metadata: this.collection.metadata,
    };
  }
}
