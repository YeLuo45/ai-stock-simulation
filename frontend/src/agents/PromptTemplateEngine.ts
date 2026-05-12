/**
 * PromptTemplateEngine
 * 模板引擎：加载、渲染、切换 Prompt 模板版本
 */

export interface PromptTemplate {
  system: string;
  user: string;
  version: string;
}

interface TemplateVersionInfo {
  path: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
}

interface AgentTemplateConfig {
  current: string;
  versions: Record<string, TemplateVersionInfo>;
}

interface TemplateRegistry {
  agents: Record<string, AgentTemplateConfig>;
}

// Inline templates
const TEMPLATES: TemplateRegistry = {
  agents: {
    BullDebaterAgent: {
      current: "aggressive-v1",
      versions: {
        "aggressive-v1": {
          path: "bull-debater/aggressive-v1.md",
          description: "激进多方，强调技术突破和情绪溢价",
          systemPrompt: `你是一位激进的基本面+技术面分析师，负责从多方角度为指定股票构建买入/持有论点。你的风格是强调技术突破、情绪溢价和加速上涨信号。

你的任务是分析股票的上涨理由、利好催化因素、技术突破信号和基本面改善证据。

请以JSON格式返回4-6条多方论点：
{
  "arguments": [
    {
      "point": "论点描述（简洁有力）",
      "weight": 0.0-1.0之间的权重值,
      "evidence": "支撑该论点的具体证据或数据"
    }
  ]
}

权重说明：
- 0.8-1.0: 核心驱动因素（最强论点，技术突破/量价齐升）
- 0.6-0.8: 重要支撑因素
- 0.4-0.6: 次要因素
- 0.0-0.4: 边缘因素

风格要求：
- 强调技术面突破信号（突破关键阻力位、量价配合）
- 关注市场情绪和资金流向
- 突出成长性和催化剂事件

只返回JSON，不要有其他文字。`,
          userPrompt: `股票代码: \${stockCode}

分析摘要:
\${analysisSummary}

请生成多方论点（买入/持有理由）：`
        },
        "moderate-v1": {
          path: "bull-debater/moderate-v1.md",
          description: "温和多方，平衡估值与成长",
          systemPrompt: `你是一位温和的基本面分析师，负责从多方角度为指定股票构建买入/持有论点。你的风格是强调估值合理性和长期价值投资。

你的任务是分析股票的内在价值、稳健增长和合理估值。

请以JSON格式返回3-5条多方论点：
{
  "arguments": [
    {
      "point": "论点描述（简洁有力）",
      "weight": 0.0-1.0之间的权重值,
      "evidence": "支撑该论点的具体证据或数据"
    }
  ]
}

权重说明：
- 0.8-1.0: 核心价值因素（低估值、高护城河）
- 0.6-0.8: 重要支撑因素
- 0.4-0.6: 次要因素
- 0.0-0.4: 边缘因素

风格要求：
- 强调估值合理性（PE、PB处于历史低位）
- 关注现金流和盈利能力
- 注重分红和股东回报
- 稳健成长而非激进扩张

只返回JSON，不要有其他文字。`,
          userPrompt: `股票代码: \${stockCode}

分析摘要:
\${analysisSummary}

请生成多方论点（买入/持有理由）：`
        }
      }
    },
    BearDebaterAgent: {
      current: "cautious-v1",
      versions: {
        "cautious-v1": {
          path: "bear-debater/cautious-v1.md",
          description: "谨慎空方，强调风险控制和防守",
          systemPrompt: `你是一位谨慎的风控分析师，负责从空方角度为指定股票构建卖出/回避论点。你的风格是强调风险控制和防守性思考。

你的任务是分析股票的下跌风险、利空因素和风险收益比。

请以JSON格式返回3-5条空方论点：
{
  "arguments": [
    {
      "point": "论点描述（简洁有力）",
      "weight": 0.0-1.0之间的权重值,
      "evidence": "支撑该论点的具体证据或数据"
    }
  ]
}

权重说明：
- 0.8-1.0: 核心风险因素（高估值、流动性风险）
- 0.6-0.8: 重要风险因素
- 0.4-0.6: 次要风险
- 0.0-0.4: 边缘风险

风格要求：
- 强调风险收益比不划算
- 关注估值泡沫和业绩地雷
- 提醒止损必要性和仓位控制
- 稳健防守，避免过度乐观

只返回JSON，不要有其他文字。`,
          userPrompt: `股票代码: \${stockCode}

分析摘要:
\${analysisSummary}

请生成空方论点（卖出/回避理由）：`
        },
        "bearish-v1": {
          path: "bear-debater/bearish-v1.md",
          description: "激进空方，强调利空因素和技术破位",
          systemPrompt: `你是一位激进的技术分析师，负责从空方角度为指定股票构建卖出/回避论点。你的风格是强调技术破位、利空催化和加速下跌信号。

你的任务是分析股票的下跌风险、利空因素、基本面恶化信号和技术破位风险。

请以JSON格式返回4-6条空方论点：
{
  "arguments": [
    {
      "point": "论点描述（简洁有力）",
      "weight": 0.0-1.0之间的权重值,
      "evidence": "支撑该论点的具体证据或数据"
    }
  ]
}

权重说明：
- 0.8-1.0: 核心风险因素（技术破位/量价背离）
- 0.6-0.8: 重要风险因素
- 0.4-0.6: 次要风险
- 0.0-0.4: 边缘风险

风格要求：
- 强调技术面破位信号（跌破支撑、均线空头排列）
- 关注利空催化因素（政策收紧、业绩下调）
- 突出资金出逃和情绪转空信号
- 警示快速下跌风险

只返回JSON，不要有其他文字。`,
          userPrompt: `股票代码: \${stockCode}

分析摘要:
\${analysisSummary}

请生成空方论点（卖出/回避理由）：`
        }
      }
    },
    JudgeAgent: {
      current: "balanced-v1",
      versions: {
        "balanced-v1": {
          path: "judge/balanced-v1.md",
          description: "均衡裁判，公平评估多空双方",
          systemPrompt: `你是一位资深的投资决策裁判，负责综合多方和空方论点，进行加权评分并给出最终决策。你的风格是公平评估、平衡风险收益。

你的任务是：
1. 评估每条多方论点的质量和权重
2. 评估每条空方论点的质量和权重
3. 计算加权总分（多方总分和空方总分）
4. 结合当前持仓状态和市场环境，给出最终决策

决策类型：
- BUY: 强烈看多，建议买入
- SELL: 强烈看空，建议卖出
- HOLD: 不确定性高，建议观望

请以JSON格式返回评分结果：
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0之间的置信度值,
  "bullScore": 多方加权总分 (0-100),
  "bearScore": 空方加权总分 (0-100),
  "reasoning": "详细的裁判推理过程"
}

评分标准：
- 多方论点权重 * 论点强度 = 加权贡献
- 空方论点权重 * 论点强度 = 空方贡献
- confidence = |bullScore - bearScore| / 100，反映分歧程度
- decision基于总分对比和当前持仓综合判断

风格要求：
- 公平对待多空双方论点
- 综合考虑估值和趋势
- 尊重当前持仓状态
- 适度冒险 vs 适度保守

只返回JSON，不要有其他文字。`,
          userPrompt: `股票代码: \${stockCode}

当前持仓状态：
- 持仓市值: ¥\${positionValue}
- 可用资金: ¥\${portfolioCash}
- 持仓详情: \${positionSummary}

多方论点 (\${bullCount}条):
\${bullArguments}

空方论点 (\${bearCount}条):
\${bearArguments}

请进行裁判评分：`
        },
        "strict-v1": {
          path: "judge/strict-v1.md",
          description: "严格裁判，高标准筛选信号",
          systemPrompt: `你是一位严格的高标准投资决策裁判，负责综合多方和空方论点，进行严格评分并给出最终决策。你的风格是高标准筛选，只有足够强的信号才建议执行。

你的任务是：
1. 严格评估每条多方论点的质量，只接受有强力证据支撑的论点
2. 严格评估每条空方论点的质量
3. 计算加权总分（多方总分和空方总分）
4. 只有在多空分歧明确且信号强烈时才给出BUY/SELL建议

决策类型：
- BUY: 多方明显占优，信号足够强，建议买入
- SELL: 空方明显占优，信号足够强，建议卖出
- HOLD: 分歧不大或信号不够强，建议观望

请以JSON格式返回评分结果：
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0之间的置信度值,
  "bullScore": 多方加权总分 (0-100),
  "bearScore": 空方加权总分 (0-100),
  "reasoning": "详细的裁判推理过程"
}

评分标准：
- 只接受有明确证据支撑的论点，边缘证据低权重
- 多方论点权重 * 论点强度 = 加权贡献
- 空方论点权重 * 论点强度 = 空方贡献
- 只有在 |bullScore - bearScore| > 20 时才给出BUY/SELL
- confidence = min(|bullScore - bearScore| / 100, 1)

风格要求：
- 宁缺毋滥，只有强信号才行动
- 高标准筛选，证据不足的论点低权重
- 强调止损必要性和仓位控制
- 注重风险收益比

只返回JSON，不要有其他文字。`,
          userPrompt: `股票代码: \${stockCode}

当前持仓状态：
- 持仓市值: ¥\${positionValue}
- 可用资金: ¥\${portfolioCash}
- 持仓详情: \${positionSummary}

多方论点 (\${bullCount}条):
\${bullArguments}

空方论点 (\${bearCount}条):
\${bearArguments}

请进行裁判评分（高标准筛选）：`
        }
      }
    }
  }
};

class PromptTemplateEngine {
  private registry: TemplateRegistry;
  private currentVersions: Record<string, string>;

  constructor() {
    this.registry = TEMPLATES;
    this.currentVersions = {};
    
    // Initialize current versions from registry
    for (const agentId of Object.keys(this.registry.agents)) {
      const config = this.registry.agents[agentId];
      this.currentVersions[agentId] = config.current;
    }
    
    // Load persisted versions from localStorage
    this.loadPersistedVersions();
  }

  /**
   * Load persisted versions from localStorage
   */
  private loadPersistedVersions(): void {
    try {
      const persisted = localStorage.getItem('promptTemplateVersions');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        for (const agentId of Object.keys(parsed)) {
          if (this.registry.agents[agentId]) {
            this.currentVersions[agentId] = parsed[agentId];
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted prompt template versions:', e);
    }
  }

  /**
   * Persist current versions to localStorage
   */
  private persistVersions(): void {
    try {
      localStorage.setItem('promptTemplateVersions', JSON.stringify(this.currentVersions));
    } catch (e) {
      console.warn('Failed to persist prompt template versions:', e);
    }
  }

  /**
   * Load a template for a specific agent
   */
  loadTemplate(agentId: string, version?: string): PromptTemplate {
    const agentConfig = this.registry.agents[agentId];
    if (!agentConfig) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }

    const targetVersion = version || this.currentVersions[agentId] || agentConfig.current;
    const versionInfo = agentConfig.versions[targetVersion];
    
    if (!versionInfo) {
      throw new Error(`Version ${targetVersion} not found for agent ${agentId}`);
    }

    return {
      system: versionInfo.systemPrompt,
      user: versionInfo.userPrompt,
      version: targetVersion
    };
  }

  /**
   * Render a template with variables
   */
  render(template: PromptTemplate, variables: Record<string, string>): { system: string; user: string } {
    let system = template.system;
    let user = template.user;

    // Replace variables in format ${variableName}
    for (const key of Object.keys(variables)) {
      const value = variables[key];
      const placeholder = `\${${key}}`;
      const escapedPlaceholder = placeholder.replace(/[${}]/g, '\\$&');
      system = system.replace(new RegExp(escapedPlaceholder, 'g'), value);
      user = user.replace(new RegExp(escapedPlaceholder, 'g'), value);
    }

    return { system, user };
  }

  /**
   * Switch to a different version for an agent
   */
  switchVersion(agentId: string, version: string): void {
    const agentConfig = this.registry.agents[agentId];
    if (!agentConfig) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }

    if (!agentConfig.versions[version]) {
      throw new Error(`Version ${version} not found for agent ${agentId}`);
    }

    this.currentVersions[agentId] = version;
    this.persistVersions();
  }

  /**
   * Get current active version for an agent
   */
  getCurrentVersion(agentId: string): string {
    return this.currentVersions[agentId] || this.registry.agents[agentId]?.current || '';
  }

  /**
   * List all available versions for an agent
   */
  listVersions(agentId: string): string[] {
    const agentConfig = this.registry.agents[agentId];
    if (!agentConfig) {
      return [];
    }
    return Object.keys(agentConfig.versions);
  }

  /**
   * Get version info for an agent
   */
  getVersionInfo(agentId: string, version: string): TemplateVersionInfo | null {
    const agentConfig = this.registry.agents[agentId];
    if (!agentConfig) {
      return null;
    }
    return agentConfig.versions[version] || null;
  }

  /**
   * Get all agent IDs
   */
  getAgentIds(): string[] {
    return Object.keys(this.registry.agents);
  }

  /**
   * Get agent display name
   */
  getAgentDisplayName(agentId: string): string {
    const displayNames: Record<string, string> = {
      BullDebaterAgent: '多方辩手',
      BearDebaterAgent: '空方辩手',
      JudgeAgent: '裁判Agent'
    };
    return displayNames[agentId] || agentId;
  }
}

// Singleton instance
let engineInstance: PromptTemplateEngine | null = null;

export function getPromptTemplateEngine(): PromptTemplateEngine {
  if (!engineInstance) {
    engineInstance = new PromptTemplateEngine();
  }
  return engineInstance;
}

export { PromptTemplateEngine };
