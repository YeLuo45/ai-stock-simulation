/**
 * NewsResearcher - 新闻研究员
 * Gathers and analyzes news articles, headlines, and media sentiment
 */

import { createAgentMessage } from '../../../agents/messages';
import type { AgentMessage } from '../../../agents/messages';
import type { ResearcherPayload, ResearcherResponse, ResearcherType, NewsItem } from '../types/ResearcherType';

export const NewsResearcher = {
  name: 'news_researcher' as const,

  async process(message: AgentMessage): Promise<AgentMessage> {
    const startTime = Date.now();
    try {
      if (message.type !== 'request') {
        return createAgentMessage('news_researcher', message.from as any, 'error',
          { error: 'NewsResearcher expects request type' }, message.traceId);
      }

      const payload = message.payload as ResearcherPayload;
      const { stockCode, query } = payload;

      if (!stockCode) {
        return createAgentMessage('news_researcher', 'supervisor', 'response',
          { error: 'No stock code provided' }, message.traceId);
      }

      // Simulate news research with fallback data
      const articles: NewsItem[] = [
        {
          id: '1',
          title: `${stockCode}发布年度业绩预告，净利润同比增长20%`,
          summary: '公司发布了年度业绩预告，预计净利润同比增长20%，超出市场预期。',
          source: '财经网',
          url: 'https://example.com/news/1',
          publishedAt: Date.now() - 86400000,
          sentiment: { score: 0.7, label: 'positive' },
          relevance: 0.9,
        },
        {
          id: '2',
          title: `分析师上调${stockCode}目标价至150元`,
          summary: '某券商发布研报，上调公司目标价至150元，维持"买入"评级。',
          source: '券商研报',
          url: 'https://example.com/news/2',
          publishedAt: Date.now() - 172800000,
          sentiment: { score: 0.6, label: 'positive' },
          relevance: 0.85,
        },
        {
          id: '3',
          title: `${stockCode}所在行业获政策支持`,
          summary: '国务院发布行业支持政策，公司将受益于政策红利。',
          source: '政府网站',
          url: 'https://example.com/news/3',
          publishedAt: Date.now() - 259200000,
          sentiment: { score: 0.5, label: 'positive' },
          relevance: 0.75,
        },
      ];

      return createAgentMessage('news_researcher', 'supervisor', 'response', {
        type: 'NEWS' as ResearcherType,
        stockCode,
        queries: [query as any],
        articles,
        sentiment: {
          overall: 0.6,
          positive: 0.7,
          negative: 0.1,
          neutral: 0.2,
        },
        keyThemes: ['业绩增长', '政策利好', '分析师看好'],
        timestamp: Date.now(),
      }, message.traceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return createAgentMessage('news_researcher', 'supervisor', 'error',
        { error: errorMsg }, message.traceId);
    }
  },
};