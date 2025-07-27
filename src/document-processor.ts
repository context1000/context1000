import "dotenv/config";

import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    title: string;
    type: "adr" | "rfc" | "guide" | "rule" | "project";
    tags: string[];
    projects: string[];
    status?: string;
    filePath: string;
    chunkIndex: number;
    totalChunks: number;
    sectionType?: string;
    sectionTitle?: string;
    tokens: number;
    related?: {
      adrs?: string[];
      rfcs?: string[];
      guides?: string[];
      rules?: string[];
    };
  };
}

export interface ProcessedDocument {
  id: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    title: string;
    type: "adr" | "rfc" | "guide" | "rule" | "project";
    tags: string[];
    projects: string[];
    status?: string;
    filePath: string;
    related?: {
      adrs?: string[];
      rfcs?: string[];
      guides?: string[];
      rules?: string[];
    };
  };
}

export class DocumentProcessor {
  private readonly MAX_CHUNK_TOKENS = 800;
  private readonly OVERLAP_TOKENS = 150;

  async processDocuments(docsPath: string): Promise<ProcessedDocument[]> {
    const documents: ProcessedDocument[] = [];
    await this.processDirectory(docsPath, documents);
    return documents;
  }

  async processDocumentsToChunks(docsPath: string): Promise<DocumentChunk[]> {
    const documents = await this.processDocuments(docsPath);
    const chunks: DocumentChunk[] = [];

    for (const doc of documents) {
      chunks.push(...doc.chunks);
    }

    return chunks;
  }

  private async processDirectory(dirPath: string, documents: ProcessedDocument[]): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.processDirectory(fullPath, documents);
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
        try {
          const doc = await this.processMarkdownFile(fullPath);
          if (doc) {
            documents.push(doc);
          }
        } catch (error) {
          console.warn(`Error processing ${fullPath}:`, error);
        }
      }
    }
  }

  private async processMarkdownFile(filePath: string): Promise<ProcessedDocument | null> {
    const content = await fs.readFile(filePath, "utf-8");
    const { data: frontmatter, content: markdownContent } = matter(content);

    if (!markdownContent.trim()) {
      return null;
    }

    const type = this.inferDocumentType(filePath, frontmatter);
    const id = this.generateDocumentId(filePath);

    const baseMetadata = {
      title: frontmatter.title || frontmatter.name || path.basename(filePath, ".md"),
      type,
      tags: frontmatter.tags || [],
      projects: (frontmatter.related?.projects || []),
      status: frontmatter.status,
      filePath: filePath,
      related: frontmatter.related || {},
    };

    const chunks = this.createDocumentChunks(id, markdownContent.trim(), baseMetadata);

    return {
      id,
      content: markdownContent.trim(),
      chunks,
      metadata: baseMetadata,
    };
  }

  private createDocumentChunks(documentId: string, content: string, baseMetadata: any): DocumentChunk[] {
    const sections = this.extractSections(content);
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, documentId, chunkIndex, baseMetadata);
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }

    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  private extractSections(content: string): Array<{ title: string; content: string; type: string }> {
    const sections: Array<{ title: string; content: string; type: string }> = [];
    const lines = content.split("\n");
    let currentSection = { title: "", content: "", type: "content" };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }

        const title = headingMatch[2];
        const type = this.inferSectionType(title);

        currentSection = {
          title,
          content: line + "\n",
          type,
        };
      } else {
        currentSection.content += line + "\n";
      }
    }

    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections.length > 0 ? sections : [{ title: "Content", content, type: "content" }];
  }

  private inferSectionType(title: string): string {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("context")) return "context";
    if (lowerTitle.includes("decision")) return "decision";
    if (lowerTitle.includes("consequence")) return "consequences";
    if (lowerTitle.includes("summary")) return "summary";
    if (lowerTitle.includes("background")) return "background";
    if (lowerTitle.includes("implementation")) return "implementation";
    return "content";
  }

  private chunkSection(
    section: { title: string; content: string; type: string },
    documentId: string,
    startIndex: number,
    baseMetadata: any
  ): DocumentChunk[] {
    const tokens = this.estimateTokens(section.content);

    if (tokens <= this.MAX_CHUNK_TOKENS) {
      return [
        {
          id: `${documentId}_chunk_${startIndex}`,
          content: section.content.trim(),
          metadata: {
            ...baseMetadata,
            chunkIndex: startIndex,
            totalChunks: 0,
            sectionType: section.type,
            sectionTitle: section.title,
            tokens,
          },
        },
      ];
    }

    return this.splitLargeSection(section, documentId, startIndex, baseMetadata);
  }

  private splitLargeSection(
    section: { title: string; content: string; type: string },
    documentId: string,
    startIndex: number,
    baseMetadata: any
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const words = section.content.split(/\s+/);
    const wordsPerChunk = Math.floor(this.MAX_CHUNK_TOKENS * 0.75);
    const overlapWords = Math.floor(this.OVERLAP_TOKENS * 0.75);

    let currentIndex = startIndex;

    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkContent = chunkWords.join(" ");
      const tokens = this.estimateTokens(chunkContent);

      chunks.push({
        id: `${documentId}_chunk_${currentIndex}`,
        content: chunkContent,
        metadata: {
          ...baseMetadata,
          chunkIndex: currentIndex,
          totalChunks: 0,
          sectionType: section.type,
          sectionTitle: section.title,
          tokens,
        },
      });

      currentIndex++;
    }

    return chunks;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  private inferDocumentType(filePath: string, _frontmatter: any): ProcessedDocument["metadata"]["type"] {
    const fileName = path.basename(filePath);
    
    if (fileName.endsWith(".adr.md")) return "adr";
    if (fileName.endsWith(".rfc.md")) return "rfc";
    if (fileName.endsWith(".guide.md")) return "guide";
    if (fileName.endsWith(".rules.md")) return "rule";
    
    if (filePath.includes("/adr/")) return "adr";
    if (filePath.includes("/rfc/")) return "rfc";
    if (filePath.includes("/guides/")) return "guide";
    if (filePath.includes("/rules/")) return "rule";
    if (filePath.includes("/projects/")) return "project";
    
    return "guide";
  }

  private generateDocumentId(filePath: string): string {
    return path.relative(process.cwd(), filePath).replace(/\//g, "_").replace(".md", "");
  }
}
