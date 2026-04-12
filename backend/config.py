"""Application settings and configuration."""
from pydantic_settings import BaseSettings
from pathlib import Path
import os


class Settings(BaseSettings):
    # AI Model API Keys
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.chat/v1"
    zhipu_api_key: str = ""
    zhipu_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    anthropic_api_key: str = ""
    google_api_key: str = ""

    # Default AI model
    default_model: str = "minimax"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Data paths
    base_dir: Path = Path(__file__).parent
    data_dir: Path = base_dir / "data"
    db_path: Path = base_dir / "stock_sim.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
settings.data_dir.mkdir(exist_ok=True)
