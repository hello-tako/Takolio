/** Canonical V3 identity. Legacy pose names are compatibility aliases, not new artwork. */
const BASE = '/takosan/v3';
export const TAKOSAN_BRAND = {
  name: 'Takosan',
  tagline: 'Bữa ngon, nhẹ đầu.',
  supportingLine: 'Less planning. More living.',
  motto: 'Bữa ngon, nhẹ đầu.',
  base: BASE,
  logos: {
    horizontal: `${BASE}/logo/horizontal-primary.svg`,
    horizontalWhite: `${BASE}/logo/horizontal-mono-white.svg`,
    stacked: `${BASE}/logo/stacked-primary.svg`,
    stackedWhite: `${BASE}/logo/stacked-mono-white.svg`,
  },
  wordmark: `${BASE}/logo/wordmark-primary.svg`,
  symbol: `${BASE}/logo/symbol-primary.svg`,
  symbolMicro: `${BASE}/logo/symbol-micro.svg`,
  og: `${BASE}/social/og-1200x630.png`,
  mascot: {
    happy: `${BASE}/mascot/tako-happy.svg`,
    neutral: `${BASE}/mascot/tako-happy.svg`,
    wave: `${BASE}/mascot/tako-happy.svg`,
    thinking: `${BASE}/mascot/tako-thinking.svg`,
    wink: `${BASE}/mascot/tako-wink.svg`,
    celebrate: `${BASE}/mascot/tako-celebrate.svg`,
    fridge: `${BASE}/mascot/tako-thinking.svg`,
    recipe: `${BASE}/mascot/tako-thinking.svg`,
    cooking: `${BASE}/mascot/tako-happy.svg`,
    calendar: `${BASE}/mascot/tako-thinking.svg`,
    shopping: `${BASE}/mascot/tako-happy.svg`,
  },
  appIcons: {
    favicon: `${BASE}/app-icons/favicon.svg`,
    icon180: `${BASE}/app-icons/icon-180.png`,
    icon192: `${BASE}/app-icons/icon-192.png`,
    icon512: `${BASE}/app-icons/icon-512.png`,
    maskable512: `${BASE}/app-icons/icon-maskable-512.png`,
  },
  uiIcons: {
    home: `${BASE}/ui-icons/home.svg`, fridge: `${BASE}/ui-icons/fridge.svg`,
    scan: `${BASE}/ui-icons/scan.svg`, recipe: `${BASE}/ui-icons/recipe.svg`,
    mealPlan: `${BASE}/ui-icons/planner.svg`, calendar: `${BASE}/ui-icons/planner.svg`,
    shopping: `${BASE}/ui-icons/shopping.svg`, profile: `${BASE}/ui-icons/profile.svg`,
  },
  colors: { coral: '#FF7B6B', green: '#2E7D5B', navy: '#202C28', cream: '#FFF8F3', mint: '#DFF4E6', yellow: '#FFC857' },
} as const;
export type TakosanMascotPose = keyof typeof TAKOSAN_BRAND.mascot;
