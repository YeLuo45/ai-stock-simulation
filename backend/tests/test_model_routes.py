import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


class ModelRoutesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_list_configs_returns_success(self) -> None:
        response = self.client.get("/api/models/configs")

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_saved_config_returns_api_protocol_in_config_list(self) -> None:
        self.client.post(
            "/api/models/configs",
            json={
                "model_name": "config-list-protocol-test",
                "api_key": "test-key",
                "base_url": "https://example.com/v1",
                "api_protocol": "anthropic",
                "is_active": False,
            },
        )

        response = self.client.get("/api/models/configs")

        self.assertEqual(response.status_code, 200)
        saved = next(item for item in response.json() if item["model_name"] == "config-list-protocol-test")
        self.assertEqual(saved["api_protocol"], "anthropic")

    @patch("routers.models.AIService")
    def test_model_test_uses_supplied_api_key_for_supported_model(self, ai_service_cls) -> None:
        service = ai_service_cls.return_value
        service.analyze_technicals.return_value = '{"summary":"ok"}'

        response = self.client.post(
            "/api/models/test",
            params={
                "model_name": "zhipu",
                "api_key": "test-zhipu-key",
                "base_url": "https://open.bigmodel.cn/api/paas/v4",
                "api_protocol": "openai_compatible",
            },
        )

        self.assertEqual(response.status_code, 200)
        ai_service_cls.assert_called_once_with(
            model_name="zhipu",
            api_key="test-zhipu-key",
            base_url="https://open.bigmodel.cn/api/paas/v4",
            api_protocol="openai_compatible",
        )

    @patch("routers.models.AIService")
    def test_model_test_reports_failure_when_ai_service_returns_error_summary(self, ai_service_cls) -> None:
        service = ai_service_cls.return_value
        service.analyze_technicals.return_value = (
            '{"summary":"分析失败: invalid api key","trend":"未知","signals":[],"support":0,"resistance":0,"risk_level":"未知"}'
        )

        response = self.client.post(
            "/api/models/test",
            params={
                "model_name": "zhipu",
                "api_key": "bad-key",
                "base_url": "https://open.bigmodel.cn/api/paas/v4",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["success"])
        self.assertIn("invalid api key", response.json()["error"])

    @patch("routers.models.AIService")
    def test_model_test_maps_quota_error_to_friendly_message(self, ai_service_cls) -> None:
        service = ai_service_cls.return_value
        service.analyze_technicals.return_value = (
            '{"summary":"分析失败: Error code: 429 - insufficient balance","trend":"未知","signals":[],"support":0,"resistance":0,"risk_level":"未知"}'
        )

        response = self.client.post(
            "/api/models/test",
            params={
                "model_name": "zhipu",
                "api_key": "quota-key",
                "base_url": "https://open.bigmodel.cn/api/paas/v4",
                "api_protocol": "openai_compatible",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["success"])
        self.assertEqual(response.json()["error_code"], "quota_exceeded")
        self.assertIn("额度不足", response.json()["message"])

    @patch("routers.models.AIService")
    def test_model_test_maps_404_to_protocol_mismatch_message(self, ai_service_cls) -> None:
        service = ai_service_cls.return_value
        service.analyze_technicals.return_value = (
            '{"summary":"分析失败: <html><head><title>404 Not Found</title></head></html>","trend":"未知","signals":[],"support":0,"resistance":0,"risk_level":"未知"}'
        )

        response = self.client.post(
            "/api/models/test",
            params={
                "model_name": "minimax",
                "api_key": "protocol-key",
                "base_url": "https://api.minimaxi.com/anthropic",
                "api_protocol": "openai_compatible",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["success"])
        self.assertEqual(response.json()["error_code"], "endpoint_protocol_mismatch")
        self.assertIn("接口地址不兼容", response.json()["message"])


if __name__ == "__main__":
    unittest.main()
