import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { Sparkles, Loader2, Save, Trash2, Play, Clock, ChevronRight, X, FileText, Bot, Wand2, Brain } from 'lucide-react'
import clsx from 'clsx'
import RLTrainingPanel from '../components/RLTrainingPanel'

const NL_STRATEGIES_KEY = 'nl-strategies'

export interface NLStrategy {
  id: string
  name: string
  natural_language: string
  generated_config: StrategyConfig | null
  created_at: string
}

export interface StrategyConfig {
  entry_conditions: Condition[]
  exit_conditions: Condition[]
  position_size: number
  stop_loss: number
  take_profit: number
}

export interface Condition {
  type: 'price' | 'indicator' | 'volume' | 'pattern'
  field: string
  operator: '>' | '<' | '>=' | '<=' | '==' | 'cross_up' | 'cross_down'
  value: string | number
  indicator?: string
}

interface AutocompleteSuggestion {
  type: 'indicator' | 'operator' | 'value' | 'keyword'
  text: string
  description?: string
}

const INDICATOR_SUGGESTIONS: AutocompleteSuggestion[] = [
  { type: 'keyword', text: 'MA5', description: '5日均线' },
  { type: 'keyword', text: 'MA10', description: '10日均线' },
  { type: 'keyword', text: 'MA20', description: '20日均线' },
  { type: 'keyword', text: 'MA60', description: '60日均线' },
  { type: 'keyword', text: 'RSI', description: '相对强弱指标' },
  { type: 'keyword', text: 'MACD', description: '指数平滑异同移动平均线' },
  { type: 'keyword', text: 'KDJ', description: '随机指标' },
  { type: 'keyword', text: 'BOLL', description: '布林带' },
  { type: 'keyword', text: '成交量', description: '成交量' },
  { type: 'keyword', text: 'PE', description: '市盈率' },
  { type: 'keyword', text: 'PB', description: '市净率' },
  { type: 'keyword', text: 'ROE', description: '净资产收益率' },
]

const OPERATOR_SUGGESTIONS: AutocompleteSuggestion[] = [
  { type: 'operator', text: '大于', description: '>' },
  { type: 'operator', text: '小于', description: '<' },
  { type: 'operator', text: '大于等于', description: '>=' },
  { type: 'operator', text: '小于等于', description: '<=' },
  { type: 'operator', text: '等于', description: '==' },
  { type: 'operator', text: '上穿', description: '金叉/交叉向上' },
  { type: 'operator', text: '下穿', description: '死叉/交叉向下' },
]

const EXAMPLE_QUERIES = [
  '当MA5上穿MA20且RSI低于30时买入，RSI高于70时卖出',
  '价格低于布林下轨时买入，价格高于布林上轨时卖出',
  '当成交量放大2倍且MACD金叉时买入',
  'PE低于15且ROE大于10%的低估价值股',
]

function loadNLStrategies(): NLStrategy[] {
  try {
    return JSON.parse(localStorage.getItem(NL_STRATEGIES_KEY) || '[]')
  } catch {
    return []
  }
}

function saveNLStrategies(strategies: NLStrategy[]) {
  localStorage.setItem(NL_STRATEGIES_KEY, JSON.stringify(strategies))
}

// Mock API for demo mode - in production these would call real backend endpoints
async function nlGenerateStrategy(nlText: string): Promise<{ config: StrategyConfig; reasoning: string }> {
  await new Promise(r => setTimeout(r, 1500))

  // Simple rule-based parsing for demo
  const config: StrategyConfig = {
    entry_conditions: [],
    exit_conditions: [],
    position_size: 0.3,
    stop_loss: 0.05,
    take_profit: 0.15,
  }

  const lowerText = nlText.toLowerCase()

  // Parse entry conditions
  if (lowerText.includes('rsi低于30') || lowerText.includes('rsi<30')) {
    config.entry_conditions.push({ type: 'indicator', field: 'RSI', operator: '<', value: 30, indicator: 'RSI' })
    config.exit_conditions.push({ type: 'indicator', field: 'RSI', operator: '>', value: 70, indicator: 'RSI' })
  }
  if (lowerText.includes('macd金叉') || (lowerText.includes('macd') && lowerText.includes('上穿'))) {
    config.entry_conditions.push({ type: 'indicator', field: 'MACD', operator: 'cross_up', value: 'SIGNAL', indicator: 'MACD' })
  }
  if (lowerText.includes('ma5上穿ma20') || (lowerText.includes('ma5') && lowerText.includes('ma20') && lowerText.includes('上穿'))) {
    config.entry_conditions.push({ type: 'indicator', field: 'MA5', operator: 'cross_up', value: 'MA20', indicator: 'MA' })
    config.exit_conditions.push({ type: 'indicator', field: 'MA5', operator: 'cross_down', value: 'MA20', indicator: 'MA' })
  }
  if (lowerText.includes('成交量放大')) {
    const volMatch = nlText.match(/成交量放大(\d+)倍/)
    config.entry_conditions.push({ type: 'volume', field: 'volume_ratio', operator: '>=', value: volMatch ? parseInt(volMatch[1]) : 2 })
  }
  if (lowerText.includes('价格低于布林下轨')) {
    config.entry_conditions.push({ type: 'price', field: 'close', operator: '<', value: 'BOLL_LOWER', indicator: 'BOLL' })
  }
  if (lowerText.includes('价格高于布林上轨')) {
    config.exit_conditions.push({ type: 'price', field: 'close', operator: '>', value: 'BOLL_UPPER', indicator: 'BOLL' })
  }
  if (lowerText.includes('pe低于15')) {
    config.entry_conditions.push({ type: 'indicator', field: 'PE', operator: '<', value: 15, indicator: 'PE' })
  }
  if (lowerText.includes('roe大于10%') || lowerText.includes('roe>10')) {
    config.entry_conditions.push({ type: 'indicator', field: 'ROE', operator: '>', value: 10, indicator: 'ROE' })
  }

  // Parse position/stop/take profit
  const stopMatch = nlText.match(/止损(\d+)%/)
  if (stopMatch) config.stop_loss = parseInt(stopMatch[1]) / 100

  const profitMatch = nlText.match(/止盈(\d+)%/)
  if (profitMatch) config.take_profit = parseInt(profitMatch[1]) / 100

  const reasoning = `已解析您的策略需求：${nlText}。生成条件：买入条件${config.entry_conditions.length}个，卖出条件${config.exit_conditions.length}个，仓位${(config.position_size * 100).toFixed(0)}%，止损${(config.stop_loss * 100).toFixed(0)}%，止盈${(config.take_profit * 100).toFixed(0)}%。`

  return { config, reasoning }
}

async function autocompleteNL(input: string): Promise<AutocompleteSuggestion[]> {
  await new Promise(r => setTimeout(r, 100))

  const suggestions: AutocompleteSuggestion[] = []
  const lastWord = input.split(/\s+/).pop() || ''

  if (!lastWord) return suggestions

  const lowerLast = lastWord.toLowerCase()

  // Suggest indicators
  INDICATOR_SUGGESTIONS.forEach(s => {
    if (s.text.toLowerCase().startsWith(lowerLast) || s.description?.toLowerCase().includes(lowerLast)) {
      suggestions.push(s)
    }
  })

  // Suggest operators if user is typing one
  OPERATOR_SUGGESTIONS.forEach(s => {
    if (s.text.toLowerCase().startsWith(lowerLast)) {
      suggestions.push(s)
    }
  })

  return suggestions.slice(0, 6)
}

export default function StrategyBuilderPage() {
  const { showNotification } = useStore()
  const [activeTab, setActiveTab] = useState<'new' | 'saved' | 'rl'>('new')
  const [nlInput, setNlInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedConfig, setGeneratedConfig] = useState<StrategyConfig | null>(null)
  const [reasoning, setReasoning] = useState('')
  const [savedStrategies, setSavedStrategies] = useState<NLStrategy[]>(loadNLStrategies)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAutocomplete = async (value: string) => {
    if (value.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const results = await autocompleteNL(value)
    setSuggestions(results)
    setShowSuggestions(results.length > 0)
    setSelectedSuggestion(-1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setNlInput(val)
    handleAutocomplete(val)
  }

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    const words = nlInput.split(/\s+/)
    words.pop()
    words.push(suggestion.text)
    setNlInput(words.join(' ') + ' ')
    setShowSuggestions(false)
    setSuggestions([])
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestion(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedSuggestion >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[selectedSuggestion])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleGenerate = async () => {
    if (!nlInput.trim()) {
      showNotification('error', '请输入策略描述')
      return
    }
    setGenerating(true)
    setGeneratedConfig(null)
    setReasoning('')
    try {
      const result = await nlGenerateStrategy(nlInput)
      setGeneratedConfig(result.config)
      setReasoning(result.reasoning)
      showNotification('success', '策略生成成功')
    } catch (err: any) {
      showNotification('error', err?.message ?? '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = () => {
    if (!strategyName.trim()) {
      showNotification('error', '请输入策略名称')
      return
    }
    if (!generatedConfig) {
      showNotification('error', '请先生成策略')
      return
    }
    const newStrategy: NLStrategy = {
      id: Date.now().toString(),
      name: strategyName,
      natural_language: nlInput,
      generated_config: generatedConfig,
      created_at: new Date().toISOString(),
    }
    const updated = [newStrategy, ...savedStrategies]
    saveNLStrategies(updated)
    setSavedStrategies(updated)
    setShowSaveModal(false)
    setStrategyName('')
    showNotification('success', '策略已保存')
  }

  const handleDelete = (id: string) => {
    const updated = savedStrategies.filter(s => s.id !== id)
    saveNLStrategies(updated)
    setSavedStrategies(updated)
    showNotification('info', '策略已删除')
  }

  const handleLoadStrategy = (strategy: NLStrategy) => {
    setNlInput(strategy.natural_language)
    setGeneratedConfig(strategy.generated_config)
    setActiveTab('new')
    showNotification('info', `已加载策略: ${strategy.name}`)
  }

  const handleExampleClick = (example: string) => {
    setNlInput(example)
    setGeneratedConfig(null)
    setReasoning('')
  }

  const handleClear = () => {
    setNlInput('')
    setGeneratedConfig(null)
    setReasoning('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const formatCondition = (c: Condition) => {
    const ops: Record<string, string> = {
      '>': '>', '<': '<', '>=': '≥', '<=': '≤', '==': '=',
      'cross_up': '上穿', 'cross_down': '下穿',
    }
    if (c.operator === 'cross_up' || c.operator === 'cross_down') {
      return `${c.indicator || c.field}${ops[c.operator]}${c.value}`
    }
    return `${c.field} ${ops[c.operator]} ${c.value}`
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
          <Sparkles size={22} className="text-accent-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI策略助手</h1>
          <p className="text-text-muted text-sm">用自然语言描述交易策略，AI帮您生成</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden">
        <div className="flex border-b border-border-color">
          <button
            onClick={() => setActiveTab('new')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'new'
                ? 'text-accent-primary bg-accent-primary/5'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Wand2 size={16} />
              新建策略
            </div>
            {activeTab === 'new' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'saved'
                ? 'text-accent-primary bg-accent-primary/5'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText size={16} />
              我的策略 ({savedStrategies.length})
            </div>
            {activeTab === 'saved' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />}
          </button>
          <button
            onClick={() => setActiveTab('rl')}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
              activeTab === 'rl'
                ? 'text-accent-primary bg-accent-primary/5'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Brain size={16} />
              RL训练
            </div>
            {activeTab === 'rl' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary" />}
          </button>
        </div>

        {/* New Strategy Tab */}
        {activeTab === 'new' && (
          <div className="p-6 space-y-6">
            {/* Input Section */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={16} className="text-accent-secondary" />
                <span className="text-sm font-medium">描述您的交易策略</span>
              </div>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={nlInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="例如：当MA5上穿MA20且RSI低于30时买入，RSI高于70时卖出"
                  className="w-full bg-bg-tertiary border border-border-color rounded-lg px-4 py-3 pr-20 text-sm focus:outline-none focus:border-accent-primary/50 transition-colors"
                  disabled={generating}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {nlInput && (
                    <button
                      onClick={handleClear}
                      className="p-1 text-text-muted hover:text-text-primary transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <Sparkles size={18} className="text-accent-secondary" />
                </div>
              </div>

              {/* Autocomplete Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionRef}
                  className="absolute z-50 mt-1 w-full bg-bg-secondary border border-border-color rounded-lg shadow-xl overflow-hidden"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className={clsx(
                        'w-full text-left px-4 py-2.5 text-sm hover:bg-bg-tertiary transition-colors flex items-center justify-between',
                        i === selectedSuggestion && 'bg-bg-tertiary'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          s.type === 'indicator' ? 'bg-accent-primary/20 text-accent-primary' :
                          s.type === 'operator' ? 'bg-accent-secondary/20 text-accent-secondary' :
                          'bg-bg-tertiary text-text-muted'
                        )}>
                          {s.type === 'keyword' ? '指标' : s.type}
                        </span>
                        <span className="font-mono">{s.text}</span>
                      </div>
                      {s.description && (
                        <span className="text-text-muted text-xs">{s.description}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || !nlInput.trim()}
                className="px-6 py-3 bg-accent-secondary text-bg-primary font-medium rounded-lg hover:bg-accent-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {generating ? 'AI分析中...' : '生成策略'}
              </button>
              {generatedConfig && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-6 py-3 bg-bg-tertiary text-text-primary font-medium rounded-lg hover:bg-border-color transition-colors flex items-center gap-2 border border-border-color"
                >
                  <Save size={18} />
                  保存策略
                </button>
              )}
            </div>

            {/* Example Queries */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted text-xs">试试：</span>
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  className="px-3 py-1 bg-bg-tertiary rounded-full text-xs text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                >
                  {q.length > 20 ? q.slice(0, 20) + '...' : q}
                </button>
              ))}
            </div>

            {/* Generated Result */}
            {generating && (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <Loader2 size={40} className="animate-spin mb-4 text-accent-secondary" />
                <p>AI正在分析并生成策略...</p>
              </div>
            )}

            {reasoning && !generating && (
              <div className="bg-bg-tertiary/50 rounded-xl border border-border-color/50 p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Bot size={14} className="text-accent-secondary" />
                  AI分析结果
                </h4>
                <p className="text-text-secondary text-sm leading-relaxed">{reasoning}</p>
              </div>
            )}

            {generatedConfig && !generating && (
              <div className="space-y-4">
                {/* Strategy Config Display */}
                <div className="bg-bg-tertiary/30 rounded-xl border border-border-color/50 p-5 space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles size={14} className="text-accent-primary" />
                    策略配置
                  </h4>

                  {/* Entry Conditions */}
                  <div>
                    <div className="text-xs text-text-muted mb-2 flex items-center gap-1">
                      <ChevronRight size={12} />
                      买入条件 ({generatedConfig.entry_conditions.length}个)
                    </div>
                    {generatedConfig.entry_conditions.length === 0 ? (
                      <span className="text-text-muted text-sm">未设置</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {generatedConfig.entry_conditions.map((c, i) => (
                          <span key={i} className="px-3 py-1.5 bg-accent-success/15 text-accent-success rounded-lg text-xs font-mono">
                            {formatCondition(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Exit Conditions */}
                  <div>
                    <div className="text-xs text-text-muted mb-2 flex items-center gap-1">
                      <ChevronRight size={12} />
                      卖出条件 ({generatedConfig.exit_conditions.length}个)
                    </div>
                    {generatedConfig.exit_conditions.length === 0 ? (
                      <span className="text-text-muted text-sm">未设置</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {generatedConfig.exit_conditions.map((c, i) => (
                          <span key={i} className="px-3 py-1.5 bg-accent-danger/15 text-accent-danger rounded-lg text-xs font-mono">
                            {formatCondition(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Position & Risk */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border-color/30">
                    <div className="text-center">
                      <div className="text-xs text-text-muted mb-1">仓位</div>
                      <div className="font-mono font-semibold text-accent-primary">{(generatedConfig.position_size * 100).toFixed(0)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-text-muted mb-1">止损</div>
                      <div className="font-mono font-semibold text-accent-danger">{(generatedConfig.stop_loss * 100).toFixed(0)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-text-muted mb-1">止盈</div>
                      <div className="font-mono font-semibold text-accent-success">{(generatedConfig.take_profit * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    className="px-6 py-3 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 transition-colors flex items-center gap-2"
                  >
                    <Play size={18} />
                    开始回测
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Saved Strategies Tab */}
        {activeTab === 'saved' && (
          <div className="p-6">
            {savedStrategies.length === 0 ? (
              <div className="text-center py-16">
                <FileText size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
                <p className="text-text-muted text-lg mb-2">暂无保存的策略</p>
                <p className="text-text-muted text-sm">使用AI策略助手生成并保存策略</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedStrategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="bg-bg-tertiary/50 rounded-xl border border-border-color/50 p-4 hover:border-accent-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => handleLoadStrategy(strategy)}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{strategy.name}</span>
                          <span className="text-text-muted text-xs flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(strategy.created_at).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-text-secondary text-sm line-clamp-2">{strategy.natural_language}</p>
                        {strategy.generated_config && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="px-2 py-0.5 bg-accent-success/15 text-accent-success rounded text-xs">
                              买入{strategy.generated_config.entry_conditions.length}个条件
                            </span>
                            <span className="px-2 py-0.5 bg-accent-danger/15 text-accent-danger rounded text-xs">
                              卖出{strategy.generated_config.exit_conditions.length}个条件
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleLoadStrategy(strategy)}
                          className="p-2 text-text-muted hover:text-accent-primary transition-colors"
                          title="加载"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(strategy.id)}
                          className="p-2 text-text-muted hover:text-accent-danger transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RL Training Tab */}
        {activeTab === 'rl' && (
          <div className="p-6">
            <RLTrainingPanel />
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl border border-border-color p-6 w-96 space-y-4">
            <h3 className="font-semibold text-lg">保存策略</h3>
            <input
              type="text"
              value={strategyName}
              onChange={e => setStrategyName(e.target.value)}
              placeholder="输入策略名称"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent-primary/50"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowSaveModal(false); setStrategyName('') }}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-primary"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-accent-primary text-bg-primary font-medium rounded-lg hover:bg-accent-primary/90 text-sm"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
