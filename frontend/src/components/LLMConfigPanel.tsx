/**
 * LLM Config Panel - Configure LLM Provider for Debate Engine
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import type { LLMConfig } from "../services/storage";
import { MiniMaxProvider, OpenAIProvider } from "../services/debate/LLMProvider";

export default function LLMConfigPanel() {
  const { llmConfig, setLLMConfig, updateLLMConfig, showNotification } = useStore();
  
  const [formData, setFormData] = useState<LLMConfig>(llmConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData(llmConfig);
  }, [llmConfig]);

  const handleProviderChange = (provider: 'minimax' | 'openai' | 'anthropic') => {
    setFormData({ ...formData, provider });
  };

  const handleEnabledChange = (enabled: boolean) => {
    setFormData({ ...formData, enabled });
  };

  const handleApiKeyChange = (apiKey: string) => {
    setFormData({ ...formData, apiKey });
  };

  const handleModelChange = (model: string) => {
    setFormData({ ...formData, model: model || undefined });
  };

  const handleTemperatureChange = (temperature: number) => {
    setFormData({ ...formData, temperature });
  };

  const handleMaxTokensChange = (maxTokens: number) => {
    setFormData({ ...formData, maxTokens });
  };

  const handleTest = async () => {
    if (!formData.apiKey) {
      setTestResult({ success: false, msg: "请输入 API Key" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      let provider;
      if (formData.provider === 'minimax') {
        provider = new MiniMaxProvider(formData.apiKey, formData.model);
      } else if (formData.provider === 'openai') {
        provider = new OpenAIProvider(formData.apiKey, formData.model);
      } else {
        setTestResult({ success: false, msg: "暂不支持此 Provider" });
        setTesting(false);
        return;
      }

      const response = await provider.chat(
        [{ role: "user", content: "Hello" }],
        { temperature: 0.7, max_tokens: 10 }
      );
      
      clearTimeout(timeoutId);
      
      if (response.error) {
        setTestResult({ success: false, msg: response.error });
      } else {
        setTestResult({ success: true, msg: "连接成功！" });
      }
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      const error = e as Error;
      if (error.name === 'AbortError') {
        setTestResult({ success: false, msg: "连接超时（10秒），请检查网络或降级到规则引擎" });
      } else {
        setTestResult({ success: false, msg: error.message || "测试失败" });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setSaving(true);
    try {
      setLLMConfig(formData);
      showNotification("success", "LLM 配置已保存");
    } catch (e) {
      showNotification("error", "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setFormData({
      enabled: false,
      provider: 'minimax',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 2048,
    });
    setTestResult(null);
  };

  const getModelPlaceholder = () => {
    if (formData.provider === 'minimax') {
      return "abab6.5s-chat (可选)";
    } else if (formData.provider === 'openai') {
      return "gpt-4o (可选)";
    }
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-slate-800 mb-1">LLM 辩论引擎配置</h3>
        <p className="text-xs text-slate-500 mb-4">
          配置 LLM 提供商以驱动 Bull/Bear/Judge 辩论引擎。LLM 调用失败时自动降级到规则引擎。
        </p>

        {/* Enable Switch */}
        <div className="flex items-center gap-3 mb-6">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => handleEnabledChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-sm text-slate-700">
            启用 LLM 模式 {formData.enabled ? "（已启用）" : "（未启用，使用规则引擎）"}
          </span>
        </div>

        {/* Provider Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">LLM 提供商</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'minimax' as const, label: 'MiniMax', desc: '高性价比' },
              { key: 'openai' as const, label: 'OpenAI', desc: 'GPT-4o' },
              { key: 'anthropic' as const, label: 'Anthropic', desc: 'Claude (开发中)', disabled: true },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => !p.disabled && handleProviderChange(p.key)}
                disabled={p.disabled || !formData.enabled}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  formData.provider === p.key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-slate-600 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <div>{p.label}</div>
                <div className="text-xs text-slate-400 font-normal">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            API Key <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            disabled={!formData.enabled}
            placeholder="输入 API Key（仅存储在本地）"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Model */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">模型名称</label>
          <input
            type="text"
            value={formData.model || ""}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!formData.enabled}
            placeholder={getModelPlaceholder()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Temperature & MaxTokens */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Temperature</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={formData.temperature}
              onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
              disabled={!formData.enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">控制随机性 (0-2)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Max Tokens</label>
            <input
              type="number"
              min={100}
              max={8192}
              step={100}
              value={formData.maxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value))}
              disabled={!formData.enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">最大输出长度</p>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {testResult.msg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!formData.enabled || !formData.apiKey || testing}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button
            onClick={handleClear}
            disabled={!formData.enabled || saving}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
          >
            清空
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.enabled}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h4 className="font-semibold text-blue-800 text-sm mb-2">LLM 辩论引擎说明</h4>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Bull Agent：专业分析师，从基本面、技术面、资金面等维度寻找买入理由</li>
          <li>Bear Agent：识别风险和卖出信号，从估值泡沫、业绩下滑等维度警示风险</li>
          <li>Judge Agent：综合双方论点，输出最终投资建议（STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL）</li>
          <li>LLM 调用超时 10 秒自动降级到规则引擎</li>
          <li>API Key 仅存储在浏览器本地，不会上传至服务器</li>
        </ul>
      </div>
    </div>
  );
}