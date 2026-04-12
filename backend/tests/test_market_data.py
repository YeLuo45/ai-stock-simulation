import unittest

from data.market_data import calculate_technicals


class MarketDataTests(unittest.TestCase):
    def test_calculate_technicals_handles_nine_kline_rows(self) -> None:
        kline_data = [
            {
                "date": f"2026-04-{index + 1:02d}",
                "open": 10 + index * 0.1,
                "high": 10.5 + index * 0.1,
                "low": 9.5 + index * 0.1,
                "close": 10.2 + index * 0.1,
                "volume": 1_000_000 + index * 10_000,
            }
            for index in range(9)
        ]

        result = calculate_technicals(kline_data)

        self.assertIn("KDJ_K", result)
        self.assertIn("KDJ_D", result)
        self.assertIn("KDJ_J", result)


if __name__ == "__main__":
    unittest.main()
