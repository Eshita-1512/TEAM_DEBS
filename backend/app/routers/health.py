"""Health and capabilities router.

Endpoints:
  GET /api/v1/health
  GET /api/v1/capabilities
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.config import get_settings

router = APIRouter(tags=["Health"])


@router.get("/api/v1/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint."""
    db_status = "unhealthy"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        pass

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "version": "1.0.0",
    }


@router.get("/api/v1/capabilities")
async def capabilities():
    """Report which optional capabilities are available in this deployment."""
    settings = get_settings()

    # Check EasyOCR availability
    easyocr_available = False
    try:
        import easyocr  # noqa: F401
        easyocr_available = True
    except ImportError:
        pass

    # Check Ollama availability
    ollama_url = getattr(settings, "OLLAMA_BASE_URL", None)
    ollama_available = bool(ollama_url)

    return {
        "ocr_available": easyocr_available,
        "easyocr_available": easyocr_available,
        "ollama_parsing_available": ollama_available,
        "export_generation_available": True,
    }
