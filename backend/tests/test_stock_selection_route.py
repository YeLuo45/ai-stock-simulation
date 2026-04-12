import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


class StockSelectionRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    @patch("routers.stock_selection.get_ai_service")
    @patch("routers.stock_selection.get_realtime_quotes")
    @patch("routers.stock_selection.get_stock_list")
    def test_selection_response_includes_company_name_and_market(
        self, get_stock_list_mock, get_realtime_quotes_mock, get_ai_service_mock
    ) -> None:
        get_stock_list_mock.return_value = [
            {"symbol": "001211", "name": "双枪科技", "exchange": "SZ"},
            {"symbol": "00700", "name": "腾讯控股", "exchange": "HK"},
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "US"},
        ]
        get_realtime_quotes_mock.return_value = [
            {
                "symbol": "001211",
                "name": "001211",
                "price": 32.44,
                "change_pct": 4.95,
                "volume": 2539140.0,
                "pe": 27.56,
                "pb": 1.92,
                "roe": None,
                "market_cap": 2655.71,
            }
        ]
        ai_service = get_ai_service_mock.return_value
        ai_service.parse_stock_query.return_value = '{"selected": ["001211"], "reasoning": "test"}'

        response = self.client.post(
            "/api/stocks/selection?model_name=minimax",
            json={"query": "近一年涨幅超过50%的科技股"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["stocks"][0]["symbol"], "001211")
        self.assertEqual(payload["stocks"][0]["name"], "双枪科技")
        self.assertEqual(payload["stocks"][0]["market"], "A股")


if __name__ == "__main__":
    unittest.main()
