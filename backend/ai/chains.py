"""AI Chain service using LangChain for unified multi-model access."""
import json
import re
from typing import Optional, Dict, Any, List

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy.orm import Session

from config import settings


class AIService:
    """Unified AI service supporting multiple LLM providers via LangChain."""

    SUPPORTED_MODELS = {
        "minimax": {
            "provider": "openai_compatible",
            "model": "MiniMax-Text-01",
            "protocol_models": {
                "openai_compatible": "MiniMax-Text-01",
                "anthropic": "MiniMax-M2.7",
            },
        },
        "zhipu": {"provider": "openai_compatible", "model": "glm-4"},
        "claude": {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"},
        "gemini": {"provider": "google", "model": "gemini-2.0-flash"},
    }

    def __init__(
        self,
        model_name: str = "minimax",
        api_key: str = "",
        base_url: str = "",
        api_protocol: str = "",
    ):
        self.model_name = model_name
        self.api_protocol = api_protocol or self._get_default_protocol(model_name)
        model_info = self.SUPPORTED_MODELS.get(model_name, self.SUPPORTED_MODELS["minimax"])
        runtime_model = self._get_runtime_model(model_name, self.api_protocol)

        if self.api_protocol == "openai_compatible":
            effective_key = api_key or self._get_api_key(model_name)
            effective_url = base_url or self._get_base_url(model_name)
            self.llm = ChatOpenAI(
                model=runtime_model,
                api_key=effective_key,
                base_url=effective_url,
                temperature=0.3,
            )
        elif self.api_protocol == "anthropic":
            self.llm = ChatAnthropic(
                model=runtime_model,
                anthropic_api_key=api_key or settings.anthropic_api_key,
                anthropic_api_url=base_url or None,
                temperature=0.3,
            )
        elif self.api_protocol == "google":
            self.llm = ChatGoogleGenerativeAI(
                model=runtime_model,
                google_api_key=api_key or settings.google_api_key,
                temperature=0.3,
            )
        else:
            raise ValueError(f"Unsupported API protocol: {self.api_protocol}")

    def _get_api_key(self, model_name: str) -> str:
        if model_name == "minimax":
            return settings.minimax_api_key
        elif model_name == "zhipu":
            return settings.zhipu_api_key
        return ""

    def _get_base_url(self, model_name: str) -> str:
        if model_name == "minimax":
            return settings.minimax_base_url
        elif model_name == "zhipu":
            return settings.zhipu_base_url
        return ""

    def _get_default_protocol(self, model_name: str) -> str:
        model_info = self.SUPPORTED_MODELS.get(model_name, self.SUPPORTED_MODELS["minimax"])
        return str(model_info["provider"])

    def _get_runtime_model(self, model_name: str, api_protocol: str) -> str:
        model_info = self.SUPPORTED_MODELS.get(model_name, self.SUPPORTED_MODELS["minimax"])
        protocol_models = model_info.get("protocol_models", {})
        if isinstance(protocol_models, dict):
            protocol_model = protocol_models.get(api_protocol)
            if isinstance(protocol_model, str) and protocol_model:
                return protocol_model
        return str(model_info["model"])

    def parse_stock_query(self, query: str, stock_data: List[Dict]) -> str:
        """Parse natural language stock selection query and return filtering logic."""
        system_prompt = """你是一个专业的A股选股分析师。用户会用自然语言描述选股条件，你需要：
1. 理解用户的选股意图
2. 提取关键筛选条件（PE、PB、ROE、涨幅、市值、行业等）
3. 结合提供的股票数据，分析哪些股票符合条件
4. 用JSON格式返回选股理由和结果

返回格式：
{
  "reasoning": "选股逻辑说明",
  "selected": ["股票代码列表"]
}

注意：只返回沪深A股数据中的股票，不虚构数据。"""

        stock_summary = "\n".join([
            f"{s.get('symbol','')} {s.get('name','')}: "
            f"价格={s.get('price',0)}, 涨跌幅={s.get('change_pct',0)}%, "
            f"PE={s.get('pe','N/A')}, PB={s.get('pb','N/A')}, "
            f"ROE={s.get('roe','N/A')}, 市值={s.get('market_cap','N/A')}亿"
            for s in stock_data[:100]
        ])

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"用户条件：{query}\n\n候选股票数据：\n{stock_summary}\n\n请按要求分析并返回JSON格式结果。")
        ]

        try:
            response = self.llm.invoke(messages)
            return self._extract_json(str(response.content))
        except Exception as e:
            return json.dumps({"reasoning": f"AI解析失败: {str(e)}", "selected": []})

    def generate_strategy(self, description: str, stock_data: List[Dict]) -> str:
        """Generate trading strategy from natural language description."""
        system_prompt = """你是一个量化策略分析师。根据用户描述的交易策略，生成策略规则说明。
返回JSON格式：
{
  "strategy_name": "策略名称",
  "rules": ["规则1", "规则2"],
  "indicators": ["使用的技术指标"],
  "risk_notes": "风险提示"
}"""

        stock_summary = "\n".join([
            f"{s.get('symbol','')} {s.get('name','')}: "
            f"价格={s.get('price',0)}, 涨跌幅={s.get('change_pct',0)}%"
            for s in stock_data[:50]
        ])

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"策略描述：{description}\n\n市场概况：\n{stock_summary}")
        ]

        try:
            response = self.llm.invoke(messages)
            return self._extract_json(str(response.content))
        except Exception as e:
            return json.dumps({"strategy_name": "策略", "rules": [], "indicators": [], "risk_notes": str(e)})

    def analyze_technicals(self, symbol: str, data: Dict) -> str:
        """AI technical analysis for a stock."""
        system_prompt = """你是一个专业A股技术分析师。请根据K线数据和技术指标，对股票进行技术面分析。
返回JSON格式：
{
  "summary": "综合技术面简评（100字内）",
  "trend": "趋势判断（多头/空头/震荡）",
  "signals": ["信号1", "信号2"],
  "support": 支撑位,
  "resistance": 压力位,
  "risk_level": "低/中/高"
}"""

        kline_summary = f"股票{symbol}，数据：{json.dumps(data, ensure_ascii=False)[:2000]}"

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=kline_summary)
        ]

        try:
            response = self.llm.invoke(messages)
            return self._extract_json(str(response.content))
        except Exception as e:
            return json.dumps({"summary": f"分析失败: {str(e)}", "trend": "未知", "signals": [], "support": 0, "resistance": 0, "risk_level": "未知"})

    def explain_backtest(self, backtest_results: Dict, strategy_name: str) -> str:
        """Explain backtest results in natural language."""
        system_prompt = """你是一个量化投资顾问。请用通俗易懂的语言解释回测结果，并给出投资建议。
返回JSON格式：
{
  "explanation": "回测结果解读",
  "pros": ["优点1", "优点2"],
  "cons": ["缺点1", "缺点2"],
  "recommendation": "建议（仅供参考，不构成投资建议）"
}"""

        results_summary = f"策略名称：{strategy_name}\n{json.dumps(backtest_results, ensure_ascii=False)[:2000]}"

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=results_summary)
        ]

        try:
            response = self.llm.invoke(messages)
            return self._extract_json(str(response.content))
        except Exception as e:
            return json.dumps({"explanation": f"解读失败: {str(e)}", "pros": [], "cons": [], "recommendation": "请自行判断"})

    @staticmethod
    def _extract_json(text: str) -> str:
        """Extract JSON from LLM response, handling markdown code blocks."""
        text = text.strip()
        # Try to find JSON in code blocks
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            return match.group(1)
        # Try to find raw JSON object
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return match.group(0)
        return text

def get_runtime_model_config(model_name: str = "minimax", db: Optional[Session] = None) -> Dict[str, str]:
    """Resolve runtime config from database first, then settings defaults."""
    model_info = AIService.SUPPORTED_MODELS.get(model_name, AIService.SUPPORTED_MODELS["minimax"])
    resolved = {
        "model_name": model_name,
        "api_key": "",
        "base_url": "",
        "api_protocol": str(model_info["provider"]),
    }

    if db is not None:
        from models import AIModelConfig

        config = db.query(AIModelConfig).filter(
            AIModelConfig.model_name == model_name
        ).first()
        if config:
            config_data = config.config_data if isinstance(config.config_data, dict) else {}
            resolved["api_key"] = config.api_key or ""
            resolved["base_url"] = config.base_url or ""
            resolved["api_protocol"] = str(config_data.get("api_protocol") or resolved["api_protocol"])
            return resolved

    service = AIService(model_name=model_name)
    resolved["api_key"] = service._get_api_key(model_name)
    resolved["base_url"] = service._get_base_url(model_name)
    return resolved


def get_ai_service(model_name: str = "minimax", db: Optional[Session] = None) -> AIService:
    """Factory function to get AI service instance."""
    runtime_config = get_runtime_model_config(model_name=model_name, db=db)
    return AIService(
        model_name=runtime_config["model_name"],
        api_key=runtime_config["api_key"],
        base_url=runtime_config["base_url"],
        api_protocol=runtime_config["api_protocol"],
    )
