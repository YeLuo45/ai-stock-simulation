import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from main import app
from services.ipo_evaluator import evaluate_ipo


class IPORouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_get_evaluate_without_stock_code_returns_usage_hint(self) -> None:
        response = self.client.get("/api/ipo/evaluate?model_name=minimax")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertIn("stock_code", payload["message"])
        self.assertIn("/api/ipo/evaluate?stock_code=", payload["example_get"])

    @patch("routers.ipo.evaluate_ipo")
    def test_post_evaluate_returns_frontend_compatible_data_sources(
        self, evaluate_ipo_mock: Mock
    ) -> None:
        evaluate_ipo_mock.return_value = {
            "stock_code": "301558",
            "stock_name": "测试新股",
            "score": 88,
            "recommendation": "推荐",
            "fundamental": {
                "pe": 18.2,
                "pb": 2.3,
                "roe": 12.5,
                "gross_margin": 28.1,
                "revenue_growth": 21.4,
                "net_profit_growth": 18.6,
                "issue_price": 15.8,
                "circulating_shares": 8000.0,
                "market_cap": 126400.0,
                "listing_date": "20250401",
                "days_since_listing": 12,
            },
            "technical": {
                "trend": "上涨",
                "rsi": 63.5,
                "macd_signal": "多头",
                "macd_value": 1.2,
                "support_level": 18.5,
                "resistance_level": 21.3,
                "ma5": 20.1,
                "ma10": 19.4,
                "ma20": 18.8,
                "current_price": 20.6,
                "change_pct": 3.2,
            },
            "analysis": "趋势向上，估值合理。",
            "data_sources": ["east_money"],
            "requested_model": "minimax",
            "actual_model": "zhipu",
            "fallback_used": True,
            "fallback_reason": "minimax 不可用，已自动切换到 zhipu",
            "evaluated_at": "2026-04-12T12:00:00",
        }

        response = self.client.post(
            "/api/ipo/evaluate?model_name=minimax",
            json={"stock_code": "301558"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data_sources"], ["east_money"])
        self.assertEqual(payload["requested_model"], "minimax")
        self.assertEqual(payload["actual_model"], "zhipu")
        self.assertTrue(payload["fallback_used"])
        self.assertIn("zhipu", payload["fallback_reason"])

    @patch("routers.ipo.evaluate_ipo")
    def test_get_evaluate_passes_database_session_to_service(
        self, evaluate_ipo_mock: Mock
    ) -> None:
        evaluate_ipo_mock.return_value = {
            "stock_code": "301558",
            "stock_name": "测试新股",
            "score": 88,
            "recommendation": "推荐",
            "fundamental": {},
            "technical": {"trend": "上涨", "rsi": 63.5, "macd_signal": "多头"},
            "analysis": "趋势向上，估值合理。",
            "data_sources": ["east_money"],
            "evaluated_at": "2026-04-12T12:00:00",
        }

        response = self.client.get("/api/ipo/evaluate?stock_code=301558&model_name=minimax")

        self.assertEqual(response.status_code, 200)
        _, kwargs = evaluate_ipo_mock.call_args
        self.assertEqual(kwargs["model_name"], "minimax")
        self.assertIsNotNone(kwargs.get("db"))


class IPOEvaluatorServiceTests(unittest.TestCase):
    @patch("services.ipo_evaluator.get_ai_service")
    @patch("services.ipo_evaluator.get_ds_manager")
    def test_evaluate_ipo_handles_wrapped_kline_payload(
        self, get_ds_manager_mock: Mock, get_ai_service_mock: Mock
    ) -> None:
        manager = Mock()
        manager.get_historical_kline.return_value = {
            "success": True,
            "data": {
                "success": True,
                "data": [
                    {"close": 10.0, "volume": 1000},
                    {"close": 10.5, "volume": 1100},
                    {"close": 11.0, "volume": 1200},
                    {"close": 11.3, "volume": 1300},
                    {"close": 11.8, "volume": 1400},
                ],
            },
            "source_used": "east_money",
        }
        manager.get_stock_info.return_value = {
            "success": True,
            "data": {"股票简称": "测试新股"},
            "source_used": "east_money",
        }
        manager.get_realtime_quote.return_value = {
            "success": True,
            "data": {"name": "测试新股", "price": 12.3, "change_pct": 1.8},
            "source_used": "east_money",
        }
        manager.get_financial_data.return_value = {
            "success": True,
            "data": {"pe": 18.2, "pb": 2.3, "roe": 12.5, "gross_margin": 28.1},
            "source_used": "east_money",
        }
        manager.get_ipo_info.return_value = {
            "success": True,
            "data": {"issue_price": 9.8, "listing_date": "20250401"},
            "source_used": "east_money",
        }
        get_ds_manager_mock.return_value = manager

        llm_response = Mock()
        llm_response.content = '{"score": 86, "recommendation": "推荐", "analysis": "综合表现良好"}'
        ai_service = Mock()
        ai_service.llm.invoke.return_value = llm_response
        get_ai_service_mock.return_value = ai_service

        result = evaluate_ipo("301558", model_name="minimax")

        manager.get_historical_kline.assert_called_once_with("301558", period="daily")
        self.assertEqual(result["score"], 86)
        self.assertEqual(result["data_sources"], ["east_money"])
        self.assertEqual(result["technical"]["current_price"], 12.3)

    @patch("services.ipo_evaluator.get_ai_service")
    @patch("services.ipo_evaluator.get_ds_manager")
    def test_evaluate_ipo_falls_back_to_next_available_model(
        self, get_ds_manager_mock: Mock, get_ai_service_mock: Mock
    ) -> None:
        manager = Mock()
        manager.get_historical_kline.return_value = {
            "success": True,
            "data": {
                "success": True,
                "data": [
                    {"close": 10.0, "volume": 1000},
                    {"close": 10.5, "volume": 1100},
                    {"close": 11.0, "volume": 1200},
                    {"close": 11.3, "volume": 1300},
                    {"close": 11.8, "volume": 1400},
                ],
            },
            "source_used": "east_money",
        }
        manager.get_stock_info.return_value = {
            "success": True,
            "data": {"股票简称": "测试新股"},
            "source_used": "east_money",
        }
        manager.get_realtime_quote.return_value = {
            "success": True,
            "data": {"name": "测试新股", "price": 12.3, "change_pct": 1.8},
            "source_used": "east_money",
        }
        manager.get_financial_data.return_value = {
            "success": True,
            "data": {"pe": 18.2, "pb": 2.3, "roe": 12.5, "gross_margin": 28.1},
            "source_used": "east_money",
        }
        manager.get_ipo_info.return_value = {
            "success": True,
            "data": {"issue_price": 9.8, "listing_date": "20250401"},
            "source_used": "east_money",
        }
        get_ds_manager_mock.return_value = manager

        failing_service = Mock()
        failing_service.llm.invoke.side_effect = RuntimeError("your current token plan not support model")
        fallback_response = Mock()
        fallback_response.content = '{"score": 81, "recommendation": "推荐", "analysis": "已切换可用模型并完成评估"}'
        fallback_service = Mock()
        fallback_service.llm.invoke.return_value = fallback_response
        get_ai_service_mock.side_effect = [failing_service, fallback_service]

        result = evaluate_ipo("301558", model_name="minimax")

        self.assertEqual(get_ai_service_mock.call_count, 2)
        self.assertEqual(result["score"], 81)
        self.assertEqual(result["requested_model"], "minimax")
        self.assertEqual(result["actual_model"], "zhipu")
        self.assertTrue(result["fallback_used"])
        self.assertIn("minimax", result["fallback_reason"])


if __name__ == "__main__":
    unittest.main()
