from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./redfire.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
