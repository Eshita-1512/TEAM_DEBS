"""Ollama adapter — abstraction for local LLM inference.

All inference goes through this adapter so the system can:
- Run with a real Ollama instance in production
- Be tested with deterministic stubs in tests
- Switch models without touching pipeline code

Note: Raw OCR extraction is now handled by Tesseract (see ocr_pipeline.py).
This adapter is only responsible for the LLM text stages (interpretation +
structured extraction).

Owned by BE-2.
"""

from __future__ import annotations

import json
import time
import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class OllamaAdapterBase(ABC):
    """Abstract interface for Ollama-backed LLM inference."""

    @abstractmethod
    async def interpret_ocr_text(self, raw_text: str) -> dict[str, Any]:
        """Use an LLM to interpret noisy OCR text and recover semantic meaning.

        Returns: {"text": str, "confidence": float, "model": str, "time_ms": int}
        """
        ...

    @abstractmethod
    async def extract_structured_fields(self, interpreted_text: str) -> dict[str, Any]:
        """Use an LLM to extract structured JSON fields from interpreted text.

        Returns: {"data": dict, "confidence": float, "model": str, "time_ms": int}
        """
        ...


class OllamaHttpAdapter(OllamaAdapterBase):
    """Concrete adapter that calls a real Ollama HTTP API."""

    def __init__(self, base_url: Optional[str] = None, text_model: Optional[str] = None):
        settings = get_settings()
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.text_model = text_model or settings.OLLAMA_TEXT_MODEL

    async def _generate(self, model: str, prompt: str) -> dict[str, Any]:
        """Call Ollama /api/generate endpoint."""
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }

        start = time.monotonic()
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
        elapsed_ms = int((time.monotonic() - start) * 1000)

        result = resp.json()
        return {
            "response": result.get("response", ""),
            "model": model,
            "time_ms": elapsed_ms,
        }

    async def interpret_ocr_text(self, raw_text: str) -> dict[str, Any]:
        prompt = (
            "You are reviewing raw OCR output from a receipt. "
            "The text may contain errors, garbled characters, or misaligned columns. "
            "Clean up the text, fix obvious OCR errors, and recover the likely "
            "original content. Preserve the structure (items, prices, totals). "
            "Return only the cleaned text.\n\n"
            f"OCR Text:\n{raw_text}"
        )

        result = await self._generate(self.text_model, prompt)
        return {
            "text": result["response"],
            "confidence": 0.80,
            "model": result["model"],
            "time_ms": result["time_ms"],
        }

    async def extract_structured_fields(self, interpreted_text: str) -> dict[str, Any]:
        prompt = (
            "Parse this receipt text into structured JSON. "
            "Return a JSON object with these fields:\n"
            '{\n'
            '  "merchant_name": "string or null",\n'
            '  "expense_date": "YYYY-MM-DD or null",\n'
            '  "currency": "3-letter code or null",\n'
            '  "subtotal": "number as string or null",\n'
            '  "tax": "number as string or null",\n'
            '  "total_amount": "number as string or null",\n'
            '  "description_hint": "short description or null",\n'
            '  "line_items": [\n'
            '    {\n'
            '      "name": "item name",\n'
            '      "amount": "number as string",\n'
            '      "quantity": "number as string or null",\n'
            '      "unit_price": "number as string or null"\n'
            '    }\n'
            '  ]\n'
            '}\n'
            "Return ONLY valid JSON, no additional text.\n\n"
            f"Receipt text:\n{interpreted_text}"
        )

        result = await self._generate(self.text_model, prompt)
        raw_response = result["response"]

        # Try to parse JSON from the response
        data = self._parse_json_response(raw_response)

        return {
            "data": data,
            "confidence": 0.78,
            "model": result["model"],
            "time_ms": result["time_ms"],
            "raw_response": raw_response,
        }

    @staticmethod
    def _parse_json_response(text: str) -> dict:
        """Attempt to extract valid JSON from LLM response."""
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block in markdown code fences
        import re
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find anything that looks like a JSON object
        brace_start = text.find('{')
        brace_end = text.rfind('}')
        if brace_start != -1 and brace_end > brace_start:
            try:
                return json.loads(text[brace_start:brace_end + 1])
            except json.JSONDecodeError:
                pass

        logger.warning("Could not parse JSON from LLM response")
        return {}


class OllamaStubAdapter(OllamaAdapterBase):
    """Stub adapter for testing — returns deterministic results without a running Ollama."""

    async def interpret_ocr_text(self, raw_text: str) -> dict[str, Any]:
        return {
            "text": raw_text,
            "confidence": 0.90,
            "model": "stub",
            "time_ms": 10,
        }

    async def extract_structured_fields(self, interpreted_text: str) -> dict[str, Any]:
        return {
            "data": {
                "merchant_name": "Cafe Blue",
                "expense_date": "2026-03-28",
                "currency": "USD",
                "subtotal": "39.00",
                "tax": "3.90",
                "total_amount": "42.90",
                "description_hint": "Restaurant receipt",
                "line_items": [
                    {"name": "Pasta", "amount": "22.00", "quantity": "1", "unit_price": "22.00"},
                    {"name": "Salad", "amount": "12.00", "quantity": "1", "unit_price": "12.00"},
                    {"name": "Coffee", "amount": "5.00", "quantity": "1", "unit_price": "5.00"},
                ],
            },
            "confidence": 0.92,
            "model": "stub",
            "time_ms": 20,
            "raw_response": "{}",
        }


def get_ollama_adapter() -> OllamaAdapterBase:
    """Factory that returns the appropriate Ollama adapter.

    Returns the real HTTP adapter. If Ollama is not reachable,
    callers should handle the error gracefully.
    """
    return OllamaHttpAdapter()
