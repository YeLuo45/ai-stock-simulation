/**
 * Researcher Types - Data and News researcher specializations
 */

export enum ResearcherType {
  DATA = 'DATA',
  NEWS = 'NEWS',
}

export interface ResearcherConfig {
  type: ResearcherType;
  enabled: boolean;
  sources: string[];
  refreshInterval: number; // milliseconds
}

export interface DataQuery {
  symbol: string;
  metrics: string[];
  startDate?: string;
  endDate?: string;
  interval: '1d' | '1wk' | '1mo';
}

export interface DataResult {
  symbol: string;
  metric: string;
  value: number | string | boolean;
  timestamp: number;
  source: string;
  quality: 'high' | 'medium' | 'low';
}

export interface DataResearchResponse {
  type: ResearcherType.DATA;
  stockCode: string;
  queries: DataQuery[];
  results: DataResult[];
  summary: string;
  timestamp: number;
}

export interface NewsQuery {
  symbol: string;
  keywords?: string[];
  sources?: string[];
  startDate?: string;
  endDate?: string;
  maxResults: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt: number;
  sentiment?: {
    score: number; // -1 to 1
    label: 'positive' | 'negative' | 'neutral';
  };
  relevance: number; // 0 to 1
}

export interface NewsResearchResponse {
  type: ResearcherType.NEWS;
  stockCode: string;
  queries: NewsQuery[];
  articles: NewsItem[];
  sentiment: {
    overall: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  keyThemes: string[];
  timestamp: number;
}

export type ResearchResponse = DataResearchResponse | NewsResearchResponse;

export interface ResearcherPayload {
  stockCode: string;
  query: DataQuery | NewsQuery;
  context?: Record<string, unknown>;
}

export interface ResearcherResponse {
  type: ResearcherType;
  stockCode: string;
  data: ResearchResponse;
  confidence: number;
  timestamp: number;
}