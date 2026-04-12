import unittest
from unittest.mock import patch

from ai.chains import get_ai_service
from database import SessionLocal
from models import AIModelConfig


class AIRuntimeConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = SessionLocal()
        self.model_name = "runtime-config-test"
        self.db.query(AIModelConfig).filter(
            AIModelConfig.model_name == self.model_name
        ).delete()
        self.db.add(
            AIModelConfig(
                model_name=self.model_name,
                api_key="db-test-key",
                base_url="https://runtime-config.example.com",
                is_active=False,
                config_data={"api_protocol": "anthropic"},
            )
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.query(AIModelConfig).filter(
            AIModelConfig.model_name == self.model_name
        ).delete()
        self.db.commit()
        self.db.close()

    @patch("ai.chains.AIService")
    def test_get_ai_service_prefers_database_config(self, ai_service_cls) -> None:
        get_ai_service(model_name=self.model_name, db=self.db)

        ai_service_cls.assert_called_once_with(
            model_name=self.model_name,
            api_key="db-test-key",
            base_url="https://runtime-config.example.com",
            api_protocol="anthropic",
        )


if __name__ == "__main__":
    unittest.main()
