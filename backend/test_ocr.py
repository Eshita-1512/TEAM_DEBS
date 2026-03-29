import asyncio
from app.services.ocr_pipeline import _easyocr_extract
from PIL import Image, ImageDraw, ImageFont
import os

img_path = "dummy_receipt.jpg"
img = Image.new("RGB", (400, 600), color=(255, 255, 255))
d = ImageDraw.Draw(img)

text = """
CAFE BLUE
123 Main St
03/28/2026

Pasta  22.00
Salad  12.00
Coffee  5.00

Subtotal 39.00
Tax 3.90
Total 42.90
VISA ****1234
"""

try:
    font = ImageFont.truetype("arial.ttf", 20)
except IOError:
    font = ImageFont.load_default()

d.text((20, 20), text, fill=(0, 0, 0), font=font)
img.save(img_path)

print("Running EasyOCR extraction...")
try:
    result = _easyocr_extract(img_path)

    print("\n--- EXTRACTED TEXT ---")
    print(result.get("text", ""))
    print("----------------------")
    print(f"Confidence: {result.get('confidence')}")
    print(f"Time: {result.get('time_ms')} ms")
except Exception as e:
    print(f"Error during extraction: {e}")
finally:
    if os.path.exists(img_path):
        os.remove(img_path)
