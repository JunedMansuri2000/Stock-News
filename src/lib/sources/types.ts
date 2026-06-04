export interface NormalizedArticle {
  externalId: string;
  title: string;
  description: string | null;
  snippet: string | null;
  url: string;
  imageUrl: string | null;
  source: string;
  language: string | null;
  keywords: string | null;
  publishedAt: Date;
}
