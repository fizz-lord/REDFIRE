import sys

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./redfire.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

if settings.secret_key in ("change-me", "change-me-to-a-real-secret-key", ""):
    print("FATAL: SECRET_KEY must be set in .env to a strong random value.")
    print("  Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\"")
    sys.exit(1)
