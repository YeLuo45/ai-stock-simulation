/**
 * PromptStrategyPanel
 * Prompt模板策略面板：展示和切换各Agent的模板版本
 */

import { useState, useEffect } from 'react';
import { getPromptTemplateEngine } from '../agents/PromptTemplateEngine';
import { Settings2, ChevronDown, Check, RefreshCw } from 'lucide-react';

interface AgentTemplateInfo {
  agentId: string;
  displayName: string;
  currentVersion: string;
  versions: Array<{
    version: string;
    description: string;
  }>;
}

export default function PromptStrategyPanel() {
  const [agents, setAgents] = useState<AgentTemplateInfo[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const engine = getPromptTemplateEngine();

  useEffect(() => {
    loadAgentTemplates();
  }, []);

  const loadAgentTemplates = () => {
    const agentIds = engine.getAgentIds();
    const agentInfos: AgentTemplateInfo[] = agentIds.map(agentId => {
      const versions = engine.listVersions(agentId).map(version => {
        const info = engine.getVersionInfo(agentId, version);
        return {
          version,
          description: info?.description || version
        };
      });
      return {
        agentId,
        displayName: engine.getAgentDisplayName(agentId),
        currentVersion: engine.getCurrentVersion(agentId),
        versions
      };
    });
    setAgents(agentInfos);
  };

  const handleVersionSwitch = (agentId: string, version: string) => {
    setLoading(true);
    try {
      engine.switchVersion(agentId, version);
      loadAgentTemplates();
      setExpandedAgent(null);
    } catch (error) {
      console.error('Failed to switch version:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAgentTemplates();
  };

  if (agents.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-white" />
          <h3 className="text-white font-semibold">Prompt 策略配置</h3>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Agent List */}
      <div className="divide-y divide-gray-100">
        {agents.map(agent => (
          <div key={agent.agentId} className="hover:bg-gray-50 transition-colors">
            {/* Agent Header */}
            <button
              onClick={() => setExpandedAgent(expandedAgent === agent.agentId ? null : agent.agentId)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-cyan-700">
                    {agent.displayName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{agent.displayName}</p>
                  <p className="text-xs text-gray-500">{agent.agentId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">
                  {agent.currentVersion}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedAgent === agent.agentId ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {/* Expanded Version Selector */}
            {expandedAgent === agent.agentId && (
              <div className="px-4 pb-3">
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    选择模板版本
                  </p>
                  {agent.versions.map(v => (
                    <button
                      key={v.version}
                      onClick={() => handleVersionSwitch(agent.agentId, v.version)}
                      disabled={loading}
                      className={`w-full px-3 py-2 rounded-md text-left transition-colors flex items-center justify-between ${
                        v.version === agent.currentVersion
                          ? 'bg-cyan-100 border border-cyan-300'
                          : 'bg-white border border-gray-200 hover:border-cyan-300'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${
                          v.version === agent.currentVersion ? 'text-cyan-700' : 'text-gray-700'
                        }`}>
                          {v.version}
                        </p>
                        <p className="text-xs text-gray-500">{v.description}</p>
                      </div>
                      {v.version === agent.currentVersion && (
                        <Check className="w-4 h-4 text-cyan-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          模板切换实时生效，无需重启服务。版本配置会保存在浏览器本地存储中。
        </p>
      </div>
    </div>
  );
}
