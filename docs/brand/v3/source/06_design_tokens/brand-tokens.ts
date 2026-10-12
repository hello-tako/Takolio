export const takosanBrand = {
  "name": "Takosan Brand Identity v3 - concept",
  "status": "Design proposal, not deployed",
  "source_reference": "vn-tak/Tako-san (read-only review)",
  "colors": {
    "primary": "#FF7B6B",
    "action": "#2E7D5B",
    "actionHover": "#1D5942",
    "text": "#202C28",
    "background": "#FFF8F3",
    "surface": "#FFFFFF",
    "highlight": "#FFC857",
    "successSoft": "#DFF4E6",
    "danger": "#C93D3D",
    "border": "#E6E5DC"
  },
  "type": {
    "display": "Nunito ExtraBold, fallback Noto Sans Bold",
    "body": "Nunito, fallback Noto Sans",
    "numeric": "Inter, fallback system-ui"
  },
  "spacing": {
    "unit": 4,
    "xs": 4,
    "sm": 8,
    "md": 16,
    "lg": 24,
    "xl": 32,
    "xxl": 48
  },
  "radius": {
    "small": 10,
    "medium": 16,
    "large": 24,
    "xlarge": 32
  },
  "touchTargetMinPx": 44,
  "motion": {
    "fastMs": 140,
    "normalMs": 220,
    "slowMs": 320
  },
  "logo": {
    "symbolSafeMargin": "16% of emblem bounds",
    "minimumHeightPx": {
      "micro": 20,
      "fullSymbol": 36,
      "horizontal": 40
    },
    "doNot": "stretch, rotate, recolor outside approved palette, place coral on similarly colored backgrounds"
  }
} as const;
