# Vasca

Based on `Vasca.ttf`, downloaded from https://www.dafont.com/vasca.font on 2026-11-15 at the project owner's request.

The DaFont listing and downloaded archive do not specify a license or identify an author. The font metadata names the family `VASCA` and records conversion by ALLTYPE; it does not contain a license text. This note documents provenance and does not claim the font is open source or grant redistribution rights.

The old file has overlapping tables and nonzero cmap language IDs, which Chromium's OpenType Sanitizer rejects. The shipped TTF was repacked with fontTools and its cmap language IDs normalized to zero. Glyph outlines and character mappings are preserved. To reproduce from the downloaded original:

```python
from fontTools.ttLib import TTFont

font = TTFont("Vasca-original.ttf")
for table in font["cmap"].tables:
    table.language = 0
font.save("Vasca.ttf")
```
