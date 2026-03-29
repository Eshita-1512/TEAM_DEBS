"""Application configuration loaded from environment variables."""

from dataclasses import dataclass
from functools import lru_cache
import os
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()


def _parse_list(raw_value: Optional[str], default: List[str]) -> List[str]:
    if raw_value is None:
        return default
    return [item.strip() for item in raw_value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    ALGORITHM: str
    CORS_ORIGINS: List[str]
    OLLAMA_BASE_URL: str
    OLLAMA_TEXT_MODEL: str
    UPLOAD_DIR: str
    MAX_RECEIPT_SIZE_MB: int
    ALLOWED_RECEIPT_TYPES: List[str]


@lru_cache()
def get_settings() -> Settings:
    return Settings(
        DATABASE_URL=os.getenv(
            "DATABASE_URL",
            "sqlite+aiosqlite:///./test.db",
        ),
        SECRET_KEY=os.getenv("SECRET_KEY", "dev-secret-key-change-in-production"),
        ACCESS_TOKEN_EXPIRE_MINUTES=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
        ALGORITHM=os.getenv("ALGORITHM", "HS256"),
        CORS_ORIGINS=_parse_list(
            os.getenv("CORS_ORIGINS"),
            ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        ),
        OLLAMA_BASE_URL=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        OLLAMA_TEXT_MODEL=os.getenv("OLLAMA_TEXT_MODEL", "mistral"),
        UPLOAD_DIR=os.getenv("UPLOAD_DIR", "uploads/receipts"),
        MAX_RECEIPT_SIZE_MB=int(os.getenv("MAX_RECEIPT_SIZE_MB", "10")),
        ALLOWED_RECEIPT_TYPES=_parse_list(
            os.getenv("ALLOWED_RECEIPT_TYPES"),
            ["image/jpeg", "image/png", "application/pdf"],
        ),
    )
