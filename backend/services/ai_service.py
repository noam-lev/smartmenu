from __future__ import annotations

import os

from openai import AsyncOpenAI

from models.schemas import ParsedMenu

_SYSTEM_PROMPT = (
    "You are an expert data extractor for restaurant menus. "
    "Extract all categories, items, and prices from the image. "
    "Return ONLY schema-compliant JSON.\n\n"
    "CRITICAL STRUCTURE RULES:\n"
    "1) A category is a section header (for example: Starters, Mains, Drinks), not a dish line.\n"
    "2) An item is a dish/beverage line, usually with a price.\n"
    "3) NEVER treat an item line as a category.\n"
    "4) If a line has a price, it should almost always be an item, not a category.\n"
    "5) Categories must contain items. Do not create empty categories.\n"
    "6) Group items under their nearest logical section header.\n\n"
    "SEMANTIC GROUPING RULES:\n"
    "- Use domain judgment to group similar dishes under coherent category names when the menu layout is messy.\n"
    "- Example: cakes, ice cream, and sweet pastries should usually be grouped under a dessert/sweets category.\n"
    "- Example: espresso, cappuccino, latte, tea should usually be grouped under hot drinks.\n"
    "- If multiple nearby lines are clearly item names (and not headers), do NOT create one category per item.\n"
    "- Prefer fewer, meaningful categories over many one-item categories when evidence supports grouping.\n\n"
    "CRITICAL BILINGUAL RULE:\n"
    "- If the menu has both Hebrew and English, map them to their respective `_he` and `_en` fields.\n"
    "- If the menu is ONLY in Hebrew, extract to the `_he` fields, AND act as a professional culinary translator "
    "to automatically generate high-quality translations for the `_en` fields.\n\n"
    "PRICE RULE:\n"
    "- Ensure `base_price` is a clean float with no currency symbol.\n\n"
    "QUALITY RULE:\n"
    "- Do not hallucinate items.\n"
    "- Before finalizing, self-check that category names are section names and not dish names.\n"
    "- Before finalizing, self-check that each category has at least one item and that one-item categories "
    "only exist when the source clearly indicates a true standalone section."
)


async def parse_menu_image(base64_image_data: str) -> ParsedMenu:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    client = AsyncOpenAI(api_key=api_key)
    completion = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Parse this menu image into the requested structured schema. "
                            "Important: keep true section headers as categories, and put dish lines under those categories."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": base64_image_data}},
                ],
            },
        ],
        response_format=ParsedMenu,
    )

    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise RuntimeError("Failed to parse AI response into ParsedMenu.")
    return parsed
