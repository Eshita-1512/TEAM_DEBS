"""Pydantic schemas for health and capabilities endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str
    version: str = "1.0.0"


class CapabilitiesResponse(BaseModel):
    ocr_available: bool
    easyocr_available: bool
    ollama_parsing_available: bool
    export_generation_available: bool
