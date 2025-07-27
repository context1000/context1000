import "dotenv/config";

import path from "path";
import { DocumentProcessor } from "./document-processor.js";
import { ChromaClient } from "./chroma-client.js";

async function indexDocuments(docsPath?: string) {
  try {
    console.log("Starting document indexing...");

    const finalDocsPath = docsPath || path.join(process.cwd(), "docs");
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
      console.log(`- ${firstChunk.metadata.title} (${firstChunk.metadata.type}) - ${chunks.length} chunks - ${filePath}`);
    });
  } catch (error) {
    console.error("Error indexing documents:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const docsPath = process.argv[2];
  indexDocuments(docsPath);
}
