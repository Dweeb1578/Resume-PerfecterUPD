import { Pinecone } from '@pinecone-database/pinecone';

const apiKey = process.env.PINECONE_API_KEY;

if (!apiKey) {
  throw new Error("PINECONE_API_KEY missing");
}

export const pinecone = new Pinecone({
  apiKey,
});

export const indexName = "resume-bullets";
