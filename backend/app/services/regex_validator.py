"""Regex validation and correction for OCR-extracted fields.

Validates and normalises date, amount, currency, and numeric formatting
from OCR output. This is the final automated validation layer before
employee review (§11 Pipeline Stage 4).

Owned by BE-2.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---- Currency symbols to code mapping ----
CURRENCY_SYMBOLS: dict[str, str] = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY",
    "₹": "INR", "₩": "KRW", "₽": "RUB", "R$": "BRL",
    "A$": "AUD", "C$": "CAD", "CHF": "CHF", "kr": "SEK",
}


def validate_and_correct(structured_data: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Validate and correct structured extraction output.

    Returns (corrected_data, warnings).
    """
    warnings: list[str] = []
    corrected = dict(structured_data)

    # ---- Date validation ----
    corrected["expense_date"], date_warnings = _validate_date(corrected.get("expense_date"))
    warnings.extend(date_warnings)

    # ---- Amount validation ----
    for field in ("total_amount", "subtotal", "tax"):
        corrected[field], field_warnings = _validate_amount(corrected.get(field), field)
        warnings.extend(field_warnings)

    # ---- Currency validation ----
    corrected["currency"], curr_warnings = _validate_currency(corrected.get("currency"))
    warnings.extend(curr_warnings)

    # ---- Line items validation ----
    if "line_items" in corrected and isinstance(corrected["line_items"], list):
        validated_lines = []
        for i, line in enumerate(corrected["line_items"]):
            v_line, line_warnings = _validate_line_item(line, i)
            validated_lines.append(v_line)
            warnings.extend(line_warnings)
        corrected["line_items"] = validated_lines

        # Check line total vs receipt total
        total_warnings = _check_line_total_consistency(corrected)
        warnings.extend(total_warnings)

    return corrected, warnings


def _validate_date(raw_date: Any) -> tuple[Optional[str], list[str]]:
    """Try to parse date into YYYY-MM-DD format."""
    warnings: list[str] = []
    if not raw_date:
        return None, ["No date found in extraction"]

    raw_str = str(raw_date).strip()

    # Try common date formats
    date_formats = [
        "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y",
        "%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y",
        "%m/%d/%y", "%d/%m/%y",
    ]

    for fmt in date_formats:
        try:
            parsed = datetime.strptime(raw_str, fmt).date()
            return parsed.isoformat(), []
        except ValueError:
            continue

    # Try regex extraction for common patterns
    date_patterns = [
        (r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', "%m/%d/%Y"),
        (r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})', "%Y-%m-%d"),
    ]
    for pattern, _ in date_patterns:
        match = re.search(pattern, raw_str)
        if match:
            try:
                groups = match.groups()
                if len(groups[0]) == 4:
                    parsed = date(int(groups[0]), int(groups[1]), int(groups[2]))
                else:
                    parsed = date(int(groups[2]), int(groups[0]), int(groups[1]))
                return parsed.isoformat(), []
            except (ValueError, IndexError):
                continue

    warnings.append(f"Could not parse date: {raw_str}")
    return raw_str, warnings


def _validate_amount(raw_amount: Any, field_name: str) -> tuple[Optional[str], list[str]]:
    """Validate and normalise a monetary amount string."""
    warnings: list[str] = []
    if raw_amount is None:
        return None, []

    raw_str = str(raw_amount).strip()

    # Remove currency symbols and whitespace
    cleaned = re.sub(r'[^\d.,\-]', '', raw_str)

    # Handle European comma-decimal format (e.g., 1.234,56)
    if re.match(r'^\d{1,3}(\.\d{3})*(,\d{2})$', cleaned):
        cleaned = cleaned.replace('.', '').replace(',', '.')
    # Handle simple comma as decimal (e.g., 42,90)
    elif ',' in cleaned and '.' not in cleaned:
        cleaned = cleaned.replace(',', '.')

    try:
        amount = Decimal(cleaned)
        if amount < 0:
            warnings.append(f"{field_name} is negative: {amount}")
        return str(amount.quantize(Decimal("0.01"))), warnings
    except (InvalidOperation, ValueError):
        warnings.append(f"Could not parse {field_name}: {raw_str}")
        return raw_str, warnings


def _validate_currency(raw_currency: Any) -> tuple[Optional[str], list[str]]:
    """Validate and normalise a currency code."""
    warnings: list[str] = []
    if not raw_currency:
        return None, ["No currency detected"]

    raw_str = str(raw_currency).strip()

    # Direct 3-letter code
    if re.match(r'^[A-Z]{3}$', raw_str.upper()):
        return raw_str.upper(), []

    # Try symbol lookup
    if raw_str in CURRENCY_SYMBOLS:
        return CURRENCY_SYMBOLS[raw_str], []

    warnings.append(f"Unrecognized currency: {raw_str}")
    return raw_str.upper()[:3] if raw_str else None, warnings


def _validate_line_item(line: dict, index: int) -> tuple[dict, list[str]]:
    """Validate a single extracted line item."""
    warnings: list[str] = []
    v_line = dict(line)

    if not v_line.get("name"):
        warnings.append(f"Line {index + 1}: missing item name")
        v_line["name"] = f"Item {index + 1}"

    for field in ("amount", "unit_price"):
        if v_line.get(field) is not None:
            v_line[field], field_warnings = _validate_amount(v_line[field], f"Line {index + 1} {field}")
            warnings.extend(field_warnings)

    return v_line, warnings


def _check_line_total_consistency(data: dict) -> list[str]:
    """Check if sum of line item amounts matches the total."""
    warnings: list[str] = []
    try:
        total = Decimal(str(data.get("total_amount", "0") or "0"))
        line_sum = sum(
            Decimal(str(line.get("amount", "0") or "0"))
            for line in data.get("line_items", [])
        )
        if total > 0 and line_sum > 0 and abs(total - line_sum) > Decimal("0.02"):
            warnings.append(
                f"Total does not match sum of extracted line items "
                f"(total={total}, line_sum={line_sum}, diff={abs(total - line_sum)})"
            )
    except (InvalidOperation, ValueError):
        pass
    return warnings
