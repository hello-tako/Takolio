import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_CATALOG,
  normalizeLocale,
  type SupportedLocale,
  type UnitSystem,
} from '../../shared/locales';

export const TAKOLIO_LOCALE_STORAGE_KEY = 'takolio_locale';
export const TAKOLIO_UNIT_SYSTEM_STORAGE_KEY = 'takolio_unit_system';
const LEGACY_PLANNER_LOCALE_KEY = 'frigo_planner_locale';
const UI_LOCALE_STORAGE_KEY = 'takolio.ui_locale';

function toTier1UiCode(locale: SupportedLocale): 'en' | 'ja' | 'vi' {
  if (locale === 'vi' || locale === 'ja') return locale;
  return 'en';
}

function persistLocaleEverywhere(next: SupportedLocale, notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TAKOLIO_LOCALE_STORAGE_KEY, next);
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, toTier1UiCode(next));
    window.localStorage.setItem(LEGACY_PLANNER_LOCALE_KEY, next === 'vi' ? 'vi' : 'en');
  } catch {
    // Ignore storage access restrictions
  }
  if (notify) {
    try {
      window.dispatchEvent(new CustomEvent('takolio:app-locale', { detail: next }));
    } catch {
      // Ignore event errors
    }
  }
}

export interface AppChromeCopy {
  nav: {
    home: string;
    fridge: string;
    planner: string;
    shopping: string;
    me: string;
  };
  planner: {
    title: string;
    subtitleDefault: string;
    createNew: string;
    shoppingList: string;
    weekdays: readonly [string, string, string, string, string, string, string];
    sundayFull: string;
    dayPrefix: string;
    mealsLabel: string;
    viewDetails: string;
    weekGridHeading: string;
  };
  settings: {
    languageHeading: string;
    languageDesc: string;
    unitHeading: string;
    unitMetric: string;
    unitImperial: string;
    savedNotice: string;
  };
}

const APP_COPY: Readonly<Record<SupportedLocale, AppChromeCopy>> = {
  vi: {
    nav: { home: 'Trang chủ', fridge: 'Tủ lạnh', planner: 'Thực đơn', shopping: 'Mua sắm', me: 'Cá nhân' },
    planner: {
      title: 'Thực đơn 7 ngày',
      subtitleDefault: 'Cân bằng dinh dưỡng cho cả gia đình',
      createNew: 'Tạo thực đơn mới',
      shoppingList: 'Danh sách mua sắm',
      weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
      sundayFull: 'Chủ nhật',
      dayPrefix: 'Thứ',
      mealsLabel: 'món',
      viewDetails: 'Xem chi tiết thực đơn',
      weekGridHeading: 'Lịch chi tiết cả tuần',
    },
    settings: {
      languageHeading: 'Ngôn ngữ & Đơn vị đo lường',
      languageDesc: 'Đồng bộ xuyên suốt ứng dụng, thực đơn tuần, trợ lý giọng nói và liên kết từ takolio.com.',
      unitHeading: 'Hệ đơn vị hiển thị',
      unitMetric: 'Hệ mét (g, kg, ml, lít, °C)',
      unitImperial: 'Hệ Mỹ (oz, lb, cup, °F)',
      savedNotice: 'Đã lưu tùy chọn ngôn ngữ và đơn vị.',
    },
  },
  en: {
    nav: { home: 'Home', fridge: 'Fridge', planner: 'Meal Plan', shopping: 'Shopping', me: 'Profile' },
    planner: {
      title: '7-Day Meal Plan',
      subtitleDefault: 'Balanced family nutrition all week',
      createNew: 'New meal plan',
      shoppingList: 'Shopping list',
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      sundayFull: 'Sunday',
      dayPrefix: 'Day',
      mealsLabel: 'dishes',
      viewDetails: 'View meal plan details',
      weekGridHeading: 'Full weekly schedule',
    },
    settings: {
      languageHeading: 'Language & Measurement Units',
      languageDesc: 'Synced across app navigation, meal planner, voice assistant, and takolio.com links.',
      unitHeading: 'Display unit system',
      unitMetric: 'Metric (g, kg, ml, L, °C)',
      unitImperial: 'US Imperial (oz, lb, cup, °F)',
      savedNotice: 'Saved language and unit preferences.',
    },
  },
  ja: {
    nav: { home: 'ホーム', fridge: '冷蔵庫', planner: '献立', shopping: '買い物', me: 'マイページ' },
    planner: {
      title: '7日間の献立',
      subtitleDefault: '家族みんなの栄養バランス',
      createNew: '新しい献立を作成',
      shoppingList: '買い物リスト',
      weekdays: ['月', '火', '水', '木', '金', '土', '日'],
      sundayFull: '日曜日',
      dayPrefix: '曜日',
      mealsLabel: '品',
      viewDetails: '献立の詳細を見る',
      weekGridHeading: '1週間の詳細スケジュール',
    },
    settings: {
      languageHeading: '言語と単位設定',
      languageDesc: 'アプリ全体、献立、音声ガイド、takolio.com からの連携に反映されます。',
      unitHeading: '表示単位',
      unitMetric: 'メートル法 (g, ml, °C)',
      unitImperial: '米国単位 (oz, cup, °F)',
      savedNotice: '言語と単位の設定を保存しました。',
    },
  },
  ko: {
    nav: { home: '홈', fridge: '냉장고', planner: '식단', shopping: '장보기', me: '내 정보' },
    planner: {
      title: '7일 식단',
      subtitleDefault: '온 가족을 위한 균형 잡힌 식단',
      createNew: '새 식단 만들기',
      shoppingList: '장보기 목록',
      weekdays: ['월', '화', '수', '목', '금', '토', '일'],
      sundayFull: '일요일',
      dayPrefix: '요일',
      mealsLabel: '메뉴',
      viewDetails: '식단 상세 보기',
      weekGridHeading: '주간 전체 일정',
    },
    settings: {
      languageHeading: '언어 및 계량 단위',
      languageDesc: '앱 메뉴, 주간 식단, 음성 가이드 및 takolio.com 연동에 자동 적용됩니다.',
      unitHeading: '표시 단위',
      unitMetric: '미터법 (g, ml, °C)',
      unitImperial: '미국 단위 (oz, cup, °F)',
      savedNotice: '언어 및 단위 설정이 저장되었습니다.',
    },
  },
  th: {
    nav: { home: 'หน้าแรก', fridge: 'ตู้เย็น', planner: 'แผนอาหาร', shopping: 'ซื้อของ', me: 'โปรไฟล์' },
    planner: {
      title: 'แผนอาหาร 7 วัน',
      subtitleDefault: 'สมดุลโภชนาการสำหรับทั้งครอบครัว',
      createNew: 'สร้างแผนใหม่',
      shoppingList: 'รายการซื้อของ',
      weekdays: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'],
      sundayFull: 'วันอาทิตย์',
      dayPrefix: 'วัน',
      mealsLabel: 'เมนู',
      viewDetails: 'ดูรายละเอียดแผนอาหาร',
      weekGridHeading: 'ตารางอาหารทั้งสัปดาห์',
    },
    settings: {
      languageHeading: 'ภาษาและหน่วยวัด',
      languageDesc: 'ซิงก์ทั่วทั้งแอป แผนอาหาร ผู้ช่วยเสียง และลิงก์จาก takolio.com',
      unitHeading: 'ระบบหน่วยที่แสดง',
      unitMetric: 'เมตริก (กรัม, มล., °C)',
      unitImperial: 'อิมพีเรียล (oz, ถ้วย, °F)',
      savedNotice: 'บันทึกการตั้งค่าภาษาและหน่วยวัดแล้ว',
    },
  },
  zh: {
    nav: { home: '首页', fridge: '冰箱', planner: '周菜单', shopping: '采购', me: '我的' },
    planner: {
      title: '7天家庭菜单',
      subtitleDefault: '为全家均衡搭配每日营养',
      createNew: '新建周菜单',
      shoppingList: '采购清单',
      weekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      sundayFull: '周日',
      dayPrefix: '星期',
      mealsLabel: '道菜',
      viewDetails: '查看菜单详情',
      weekGridHeading: '一周完整排期',
    },
    settings: {
      languageHeading: '语言与计量单位',
      languageDesc: '跨应用导航、周菜单、语音助手及 takolio.com 链接自动同步。',
      unitHeading: '显示单位制',
      unitMetric: '公制 (克, 毫升, °C)',
      unitImperial: '英美制 (oz, 杯, °F)',
      savedNotice: '已保存语言与单位偏好设置。',
    },
  },
  it: {
    nav: { home: 'Home', fridge: 'Dispensa', planner: 'Menu', shopping: 'Spesa', me: 'Profilo' },
    planner: {
      title: 'Menu 7 giorni',
      subtitleDefault: 'Nutrizione equilibrata per tutta la famiglia',
      createNew: 'Nuovo menu',
      shoppingList: 'Lista spesa',
      weekdays: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
      sundayFull: 'Domenica',
      dayPrefix: 'Giorno',
      mealsLabel: 'piatti',
      viewDetails: 'Vedi dettagli del menu',
      weekGridHeading: 'Programma settimanale completo',
    },
    settings: {
      languageHeading: 'Lingua e Unità di Misura',
      languageDesc: 'Sincronizzato tra app, menu settimanale, guida vocale e collegamenti da takolio.com.',
      unitHeading: 'Sistema di misura',
      unitMetric: 'Metrico (g, ml, °C)',
      unitImperial: 'Imperiale (oz, cup, °F)',
      savedNotice: 'Preferenze di lingua e unità salvate.',
    },
  },
};

export interface AppLocaleContextValue {
  locale: SupportedLocale;
  unitSystem: UnitSystem;
  copy: AppChromeCopy;
  setLocale: (next: SupportedLocale) => void;
  setUnitSystem: (next: UnitSystem) => void;
  isProvided?: boolean;
}

function readInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    // 1. Highest priority: explicit cross-domain `?lang=` handoff from takolio.com
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('lang');
    if (fromQuery) {
      const normalized = normalizeLocale(fromQuery, DEFAULT_LOCALE);
      persistLocaleEverywhere(normalized, true);
      return normalized;
    }
    // 2. Stored user preference (unified across all three historical keys)
    const stored =
      window.localStorage.getItem(TAKOLIO_LOCALE_STORAGE_KEY) ||
      window.localStorage.getItem(UI_LOCALE_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_PLANNER_LOCALE_KEY);
    if (stored) {
      const normalized = normalizeLocale(stored, DEFAULT_LOCALE);
      persistLocaleEverywhere(normalized, true);
      return normalized;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return DEFAULT_LOCALE;
}

function readInitialUnitSystem(locale: SupportedLocale): UnitSystem {
  if (typeof window === 'undefined') return LOCALE_CATALOG[locale].defaultUnitSystem;
  try {
    const stored = window.localStorage.getItem(TAKOLIO_UNIT_SYSTEM_STORAGE_KEY);
    if (stored === 'metric' || stored === 'imperial') return stored;
  } catch {
    // Ignore
  }
  return LOCALE_CATALOG[locale].defaultUnitSystem;
}

export function getActiveAppLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('lang');
    if (fromQuery) return normalizeLocale(fromQuery, DEFAULT_LOCALE);
    const stored =
      window.localStorage.getItem(TAKOLIO_LOCALE_STORAGE_KEY) ||
      window.localStorage.getItem(UI_LOCALE_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_PLANNER_LOCALE_KEY);
    if (stored) return normalizeLocale(stored, DEFAULT_LOCALE);
  } catch {
    // Ignore
  }
  return DEFAULT_LOCALE;
}

export function getActiveUnitSystem(locale: SupportedLocale = getActiveAppLocale()): UnitSystem {
  return readInitialUnitSystem(locale);
}

const defaultValue: AppLocaleContextValue = {
  locale: DEFAULT_LOCALE,
  unitSystem: 'metric',
  copy: APP_COPY.vi,
  setLocale: () => {},
  setUnitSystem: () => {},
  isProvided: false,
};

const AppLocaleContext = createContext<AppLocaleContextValue>(defaultValue);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(readInitialLocale);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => readInitialUnitSystem(locale));

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = LOCALE_CATALOG[locale];
    document.documentElement.lang = meta.bcp47;
    document.documentElement.dir = meta.dir;
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('takolio:app-locale', { detail: locale }));
      } catch {
        // Ignore
      }
    }
  }, [locale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUiLocale = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      const normalized = normalizeLocale(detail, DEFAULT_LOCALE);
      setLocaleState((prev) => (prev === normalized ? prev : normalized));
      try {
        window.localStorage.setItem(TAKOLIO_LOCALE_STORAGE_KEY, normalized);
        window.localStorage.setItem(LEGACY_PLANNER_LOCALE_KEY, normalized === 'vi' ? 'vi' : 'en');
      } catch {
        // Ignore
      }
    };
    const onPopState = () => {
      const fromQuery = new URLSearchParams(window.location.search).get('lang');
      if (fromQuery) {
        const normalized = normalizeLocale(fromQuery, DEFAULT_LOCALE);
        persistLocaleEverywhere(normalized, true);
        setLocaleState(normalized);
      }
    };
    window.addEventListener('takolio:ui-locale', onUiLocale);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('takolio:ui-locale', onUiLocale);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    persistLocaleEverywhere(next, true);
    // Also default unit system when user hasn't explicitly overridden it
    try {
      if (!window.localStorage.getItem(TAKOLIO_UNIT_SYSTEM_STORAGE_KEY)) {
        setUnitSystemState(LOCALE_CATALOG[next].defaultUnitSystem);
      }
    } catch {
      // Ignore
    }
    // Best-effort sync to server user_preferences.language ('vi' | 'en') when signed in
    const serverLang: 'vi' | 'en' = next === 'vi' ? 'vi' : 'en';
    void fetch('/api/v1/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Takolio-Locale': next },
      body: JSON.stringify({ language: serverLang, locale: next }),
    }).catch(() => {});
  }, []);

  const setUnitSystem = useCallback((next: UnitSystem) => {
    setUnitSystemState(next);
    try {
      window.localStorage.setItem(TAKOLIO_UNIT_SYSTEM_STORAGE_KEY, next);
    } catch {
      // Ignore
    }
  }, []);

  const value = useMemo<AppLocaleContextValue>(
    () => ({
      locale,
      unitSystem,
      copy: APP_COPY[locale] ?? APP_COPY.vi,
      setLocale,
      setUnitSystem,
      isProvided: true,
    }),
    [locale, unitSystem, setLocale, setUnitSystem],
  );

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
};

export function useAppLocale(): AppLocaleContextValue {
  return useContext(AppLocaleContext);
}
