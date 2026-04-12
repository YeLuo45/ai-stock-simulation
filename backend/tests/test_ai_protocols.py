import unittest
from unittest.mock import patch

from ai.chains import AIService


class AIProtocolTests(unittest.TestCase):
    @patch("ai.chains.ChatOpenAI")
    @patch("ai.chains.ChatAnthropic")
    def test_minimax_can_use_anthropic_protocol(self, anthropic_cls, openai_cls) -> None:
        AIService(
            model_name="minimax",
            api_key="anthropic-style-key",
            base_url="https://api.minimaxi.com/anthropic",
            api_protocol="anthropic",
        )

        openai_cls.assert_not_called()
        anthropic_cls.assert_called_once_with(
            model="MiniMax-M2.7",
            anthropic_api_key="anthropic-style-key",
            anthropic_api_url="https://api.minimaxi.com/anthropic",
            temperature=0.3,
        )


if __name__ == "__main__":
    unittest.main()
