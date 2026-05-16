/**
 * Settings Page - AI Model Configuration + Priority + Data Sources
 */
import { useState, useEffect } from "react";
import { useStore } from "../store";
import { listModelConfigs, saveModelConfig, activateModel, testModel, getActiveModel } from "../services/api";
import { setCurrentModel } from "../services/api";
import ModelPrioritySettings from "../components/ModelPrioritySettings";
import DataSourceSelector from "../components/DataSourceSelector";
import BrokerSettings from "../components/BrokerSettings";
import AutoRunSettings from "../components/AutoRunSettings";
import type { AIModelConfig, APIProtocol } from "../types";

const MODEL_OPTIONS = [
  {
    name: "minimax",
    label: "MiniMax",
    desc: "高性价比，支持中文理解",
    protocols: [
      { value: "anthropic" as const, label: "Anthropic 风格", baseUrl: "https://api.minimaxi.com/anthropic" },
      { value: "openai_compatible" as const, label: "OpenAI 风格", baseUrl: "https://api.minimax.chat/v1" },
    ],
  },
  {
    name: "zhipu",
    label: "智谱 GLM-4",
    desc: "国产大模型，支持长上下文",
    protocols: [
      { value: "openai_compatible" as const, label: "OpenAI 风格", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
    ],
  },
  {
    name: "claude",
    label: "Claude",
    desc: "Anthropic Claude 3.5 Sonnet",
    protocols: [
      { value: "anthropic" as const, label: "Anthropic 风格", baseUrl: "" },
    ],
  },
  {
    name: "gemini",
    label: "Gemini",
    desc: "Google Gemini 2.0 Flash",
    protocols: [
      { value: "google" as const, label: "Google 原生接口", baseUrl: "" },
    ],
  },
];

const getModelOption = (name: string) => MODEL_OPTIONS.find((option) => option.name === name);

const getDefaultProtocol = (name: string): APIProtocol => {
  return getModelOption(name)?.protocols[0]?.value ?? "openai_compatible";
};

const getProtocolOptions = (name: string) => {
  return getModelOption(name)?.protocols ?? [];
};

const getProtocolLabel = (name: string, protocol?: APIProtocol) => {
  const targetProtocol = protocol ?? getDefaultProtocol(name);
  return getProtocolOptions(name).find((item) => item.value === targetProtocol)?.label ?? targetProtocol;
};

const getDefaultBaseUrl = (name: string, protocol?: APIProtocol) => {
  const targetProtocol = protocol ?? getDefaultProtocol(name);
  return getProtocolOptions(name).find((item) => item.value === targetProtocol)?.baseUrl ?? "";
};

export default function SettingsPage() {
  const { setActiveModel, modelConfigs, setModelConfigs, showNotification } = useStore();
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState<APIProtocol>("openai_compatible");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string; detail?: string } | null>(null);
  const [settingsTab, setSettingsTab] = useState<"config" | "priority" | "datasource" | "broker">("config");

  const TABS = [
    { key: "config" as const, label: "模型配置" },
    { key: "priority" as const, label: "AI模型优先级" },
    { key: "datasource" as const, label: "数据源管理" },
    { key: "broker" as const, label: "券商账户" },
    { key: "autorun" as const, label: "无人值守" },
  ];

  useEffect(() => {
    loadConfigs();
    // Check and start auto-run if enabled
    const { getAutoRunConfig, startAutoRunChecker } = require('../services/debate/AutoRunService');
    const autoConfig = getAutoRunConfig();
    if (autoConfig.enabled) {
      startAutoRunChecker();
    }
  }, []);

  const loadConfigs = async () => {
    try {
      const configs = await listModelConfigs();
      setModelConfigs(configs);
      const active = await getActiveModel();
      setActiveModel(active.model_name);
      setSelectedModel(active.model_name);
      const activeConfig = configs.find((c: AIModelConfig) => c.model_name === active.model_name);
      const protocol = activeConfig?.api_protocol || getDefaultProtocol(active.model_name);
      setSelectedProtocol(protocol);
      setBaseUrl(activeConfig?.base_url || getDefaultBaseUrl(active.model_name, protocol));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectModel = (name: string) => {
    const config = modelConfigs.find((item: AIModelConfig) => item.model_name === name);
    const protocol = config?.api_protocol || getDefaultProtocol(name);
    setSelectedModel(name);
    setSelectedProtocol(protocol);
    setBaseUrl(config?.base_url || getDefaultBaseUrl(name, protocol));
    setApiKey("");
    setTestResult(null);
  };

  const handleSelectProtocol = (protocol: APIProtocol) => {
    setSelectedProtocol(protocol);
    setBaseUrl(getDefaultBaseUrl(selectedModel, protocol));
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!selectedModel || !apiKey) return;
    setSaving(true);
    try {
      await saveModelConfig({
        model_name: selectedModel,
        api_key: apiKey,
        base_url: baseUrl,
        api_protocol: selectedProtocol,
        is_active: true,
      });
      await activateModel(selectedModel);
      setActiveModel(selectedModel);
      setCurrentModel(selectedModel);
      showNotification("success", `已保存并激活 ${getModelOption(selectedModel)?.label}`);
      await loadConfigs();
    } catch (e: unknown) {
      showNotification("error", "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedModel || !apiKey) return;
    setTesting(selectedModel);
    setTestResult(null);
    try {
      const result = await testModel(selectedModel, apiKey, baseUrl, selectedProtocol);
      setTestResult(
        result.success
          ? { success: true, msg: result.response || "测试成功" }
          : {
              success: false,
              msg: result.message || result.error || "测试失败",
              detail: result.detail,
            }
      );
    } catch (e: unknown) {
      setTestResult({ success: false, msg: String(e) });
    } finally {
      setTesting("");
    }
  };

  const activeConfig = modelConfigs.find((c: AIModelConfig) => c.is_active);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-gray-100 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSettingsTab(tab.key)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              settingsTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {settingsTab === "config" && (
      <>
      {/* Active Model */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">当前激活的 AI 模型</h2>
        {activeConfig ? (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold">{getModelOption(activeConfig.model_name)?.label || activeConfig.model_name}</p>
              <p className="text-green-100 text-xs">{activeConfig.base_url || "默认API"}</p>
              <p className="text-green-100/90 text-xs mt-1">{getProtocolLabel(activeConfig.model_name, activeConfig.api_protocol)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-2xl">⚙️</span>
            <p className="font-medium">使用默认配置（MiniMax）</p>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-slate-900">
        <h3 className="font-bold text-slate-800 mb-4">配置 AI 模型</h3>

        {/* Model Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {MODEL_OPTIONS.map((opt) => {
            const config = modelConfigs.find((c: AIModelConfig) => c.model_name === opt.name);
            const isActive = activeConfig?.model_name === opt.name;
            const hasKey = config?.has_api_key;

            return (
              <button
                key={opt.name}
                onClick={() => handleSelectModel(opt.name)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedModel === opt.name
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                } ${isActive ? "ring-2 ring-green-400" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800">{opt.label}</span>
                  <div className="flex gap-1">
                    {isActive && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">使用中</span>}
                    {hasKey && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">已配置</span>}
                  </div>
                </div>
                <p className="text-xs text-slate-600">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Config Form */}
        {selectedModel && (
          <div className="space-y-4 border-t border-gray-100 pt-5">
            <div>
              <label className="block text-xs text-slate-700 mb-1">接口风格</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {getProtocolOptions(selectedModel).map((protocol) => (
                  <button
                    key={protocol.value}
                    type="button"
                    onClick={() => handleSelectProtocol(protocol.value)}
                    className={`rounded-lg border px-4 py-2 text-sm text-left transition-colors ${
                      selectedProtocol === protocol.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-slate-700 hover:border-gray-300"
                    }`}
                  >
                    {protocol.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                当前协议将决定测试连接和实际业务调用使用哪种接口格式。
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-700 mb-1">API Key / Token</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入 API Key 或 Token"
                className="w-full bg-white px-4 py-2 border border-gray-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-slate-600 mt-1">API Key 将存储在本地数据库中</p>
            </div>

            {baseUrl && (
              <div>
                <label className="block text-xs text-slate-700 mb-1">API Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="可选：自定义 API 地址"
                  className="w-full bg-white px-4 py-2 border border-gray-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div className={`rounded-lg p-3 text-sm ${testResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                <div>{testResult.success ? "✅ " : "❌ "}{testResult.msg}</div>
                {testResult.detail && !testResult.success && (
                  <p className="mt-1 text-xs text-red-600 break-all">{testResult.detail}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={!apiKey || testing === selectedModel}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {testing === selectedModel ? "测试中..." : "测试连接"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !apiKey}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存并激活"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model Priority Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-slate-900">
        <h4 className="font-semibold text-slate-800 mb-3">AI 模型优先级（可自定义）</h4>
        <div className="space-y-2">
          {MODEL_OPTIONS.map((option, i) => (
            <div key={option.name} className="flex items-center gap-3 text-sm">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
              <span className="text-slate-700">{option.label}</span>
              {i === 0 && <span className="text-xs text-gray-400">（当前默认）</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-3">优先级影响 AI 选股、分析时的默认模型选择。可以在上述配置中切换不同的模型。</p>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
        <p className="text-xs text-yellow-700">
          ⚠️ AI 分析结果仅供参考，不构成投资建议。模型输出可能存在偏差，请自行判断。
          您的 API Key 仅存储在本地，不会上传至任何第三方服务器。
        </p>
      </div>
      </>
      )}

      {settingsTab === "priority" && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-slate-800 mb-1">拖拽调整 AI 模型优先级</h3>
          <p className="text-xs text-slate-500 mb-4">
            拖拽卡片可调整模型调用顺序。优先级高的模型会被优先调用，失败后自动切换。
          </p>
          <ModelPrioritySettings />
        </div>
      )}

      {settingsTab === "datasource" && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-slate-800 mb-1">行情数据源管理</h3>
          <p className="text-xs text-slate-500 mb-4">
            启用/禁用各数据源。禁用后系统自动降级切换到其他可用源。
          </p>
          <DataSourceSelector />
        </div>
      )}

      {settingsTab === "broker" && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-slate-800 mb-1">券商账户配置</h3>
          <p className="text-xs text-slate-500 mb-4">
            配置实盘交易券商账户（Alpaca / 模拟），支持 Paper Trade 和 Live Trading。
          </p>
          <BrokerSettings />
        </div>
      )}

      {settingsTab === "autorun" && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <AutoRunSettings />
        </div>
      )}
    </div>
  );
}
