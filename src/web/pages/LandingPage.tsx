import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowRight, Check, ChevronDown, Clock, Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { PublicLayout } from './public/PublicLayout';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  BudgetCoinJarIcon,
  ChopsticksBowlIcon,
  ClaypotBraiseIcon,
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  MultiTimerIcon,
  NavFridgeIcon,
  NavScanApertureIcon,
  NavShoppingIcon,
  ReceiptScanIcon,
  StockpotSoupIcon,
  VoiceWaveTakoIcon,
  WakeLockSunIcon,
  WokFlameIcon,
} from '../design-system/icons';
import {
  ActiveCookwareStage3D,
  HeroKitchenDiorama3D,
  type BurnerHeatLevel,
  type CulinaryTechnique,
  type HeroHotspotId,
} from '../components/3d';

interface PlaygroundIngredient {
  id: string;
  label: string;
  expiryHint: string;
  savedVnd: number;
}

interface PlaygroundDish {
  role: 'Món Mặn' | 'Món Canh' | 'Món Xào';
  title: string;
  subtitle: string;
  cookMinutes: number;
  image: string;
  matchedIds: string[];
}

interface RegionalHeritageCard {
  regionCode: string;
  regionLabelVi: string;
  characterVi: string;
  dishTitle: string;
  descriptionVi: string;
  cookMinutes: number;
  signatureTagVi: string;
  imageSrc: string;
}

const REGIONAL_HERITAGE_STRIP: readonly RegionalHeritageCard[] = [
  {
    regionCode: 'MIỀN BẮC',
    regionLabelVi: 'Thanh Tao & Tinh Tế',
    characterVi: 'Cân bằng chua dịu, thơm thảo mộc tươi',
    dishTitle: 'Bún chả Hà Nội',
    descriptionVi:
      'Ba chỉ nướng xém cạnh thơm khói than hoa, nước chấm đu đủ xanh giòn dịu quyện rau sống tươi mát.',
    cookMinutes: 30,
    signatureTagVi: 'Chuẩn vị Hà Thành',
    imageSrc: '/takolio/v4/dishes/vn-grilled-lemongrass.webp',
  },
  {
    regionCode: 'MIỀN TRUNG',
    regionLabelVi: 'Nồng Nàn & Đậm Vị',
    characterVi: 'Dậy hương sả ớt, mắm ruốc chiều sâu',
    dishTitle: 'Bún bò Huế',
    descriptionVi:
      'Nước dùng xương ống hầm sả cây trong vắt mà đậm đà, bắp bò thái mỏng và sa tế ớt chưng ấm nồng.',
    cookMinutes: 45,
    signatureTagVi: 'Tinh hoa Cố Đô',
    imageSrc: '/takolio/v5/posters/soup-poster.webp',
  },
  {
    regionCode: 'MIỀN NAM',
    regionLabelVi: 'Dân Dã & Hào Sảng',
    characterVi: 'Ngọt lành nước dừa, sánh kẹo tộ đất',
    dishTitle: 'Cá lóc kho tộ miền Tây',
    descriptionVi:
      'Cá lóc đồng kho tộ đất Bát Tràng sóng sánh màu cánh gián, dậy mùi tiêu xanh và hành lá phi thơm.',
    cookMinutes: 28,
    signatureTagVi: 'Ấm lửa Phương Nam',
    imageSrc: '/takolio/v5/posters/claypot-poster.webp',
  },
];

const PLAYGROUND_INGREDIENTS: readonly PlaygroundIngredient[] = [
  { id: 'pork', label: 'Thịt ba chỉ', expiryHint: 'Còn 2 ngày', savedVnd: 42000 },
  { id: 'egg', label: 'Trứng gà', expiryHint: 'Còn 5 ngày', savedVnd: 18000 },
  { id: 'tomato', label: 'Cà chua', expiryHint: 'Chín mọng hôm nay', savedVnd: 14000 },
  { id: 'morning_glory', label: 'Rau muống', expiryHint: 'Ưu tiên dùng hôm nay', savedVnd: 12000 },
  { id: 'tofu', label: 'Đậu phụ', expiryHint: 'Còn 1 ngày', savedVnd: 15000 },
  { id: 'snakehead_fish', label: 'Cá lóc', expiryHint: 'Ngăn mát', savedVnd: 55000 },
  { id: 'lemongrass', label: 'Sả tươi', expiryHint: 'Thơm giòn', savedVnd: 8000 },
];

const HOTSPOT_PILLS: Array<{ id: HeroHotspotId; label: string }> = [
  { id: 'overview', label: 'Reel Điện ảnh 4 Hồi' },
  { id: 'fridge', label: 'Tủ lạnh FEFO' },
  { id: 'cooktop', label: 'Bếp Mâm Cơm' },
  { id: 'scan', label: 'Quét AI & Sơ chế' },
];

const SANCTUARY_DEMO_MODES: ReadonlyArray<{
  id: 'braise' | 'stir_fry' | 'simmer';
  labelVi: string;
  technique: CulinaryTechnique;
  heat: BurnerHeatLevel;
  stepTitle: string;
}> = [
  {
    id: 'braise',
    labelVi: 'Kho tộ nồi đất',
    technique: 'braise',
    heat: 'medium_high',
    stepTitle: 'Kho liu riu cho sốt sánh màu cánh gián',
  },
  {
    id: 'stir_fry',
    labelVi: 'Xào lửa vượng',
    technique: 'stir_fry',
    heat: 'high',
    stepTitle: 'Đảo nhanh tay với tỏi đập dập trên lửa lớn',
  },
  {
    id: 'simmer',
    labelVi: 'Canh chua dịu sôi',
    technique: 'simmer',
    heat: 'medium',
    stepTitle: 'Hớt bọt nhẹ, thêm dọc mùng và rau thơm',
  },
];

const FAQ_ITEMS = [
  {
    q: 'Tôi có thể dùng thử Takolio mà không cần tạo tài khoản hay thẻ ngân hàng không?',
    a: 'Hoàn toàn được! Chỉ cần nhấn "Khám phá không gian bếp ngay", bạn sẽ có ngay một gian bếp trải nghiệm riêng trên thiết bị. Khi nào muốn đồng bộ đa thiết bị cùng người thân, bạn mới cần đăng ký tài khoản.',
  },
  {
    q: 'Quét AI tủ lạnh và hóa đơn siêu thị hoạt động chính xác đến mức nào?',
    a: 'AI nhận diện nhanh rau củ, thịt cá và chữ in trên hóa đơn tiếng Việt. Đặc biệt, Takolio luôn mở màn hình Kiểm tra trước khi thêm để bạn duyệt lại tên, số lượng và hạn dùng — kết quả có thể cần sửa nhẹ nếu ảnh thiếu sáng.',
  },
  {
    q: 'Takolio ghép Mâm Cơm Gia Đình Việt khác gì các ứng dụng công thức nước ngoài?',
    a: 'Thay vì gợi ý những món ăn lẻ tẻ hoặc nguyên liệu khó mua, động cơ thực đơn của Takolio phối hợp trọn mâm gồm Món Mặn + Món Canh + Món Xào chuẩn khẩu vị Bắc – Trung – Nam, ưu tiên giải cứu đồ sắp hết hạn trong tủ nhà bạn.',
  },
  {
    q: 'Khi mất kết nối Wi-Fi ở chợ hoặc trong bếp thì ứng dụng có dùng được không?',
    a: 'Có. Takolio được xây dựng theo kiến trúc Offline-First: bạn vẫn mở được danh sách đi chợ, tích chọn món vừa mua và xem tủ lạnh đã lưu; mọi thay đổi sẽ tự động đồng bộ an toàn ngay khi có mạng trở lại.',
  },
  {
    q: 'Gói Miễn phí đã đủ dùng lâu dài cho gia đình chưa?',
    a: 'Gói Takolio Miễn phí (0đ trọn đời) mở khóa không giới hạn Tủ lạnh FEFO, 580+ công thức chuẩn hóa, Thực đơn Mâm cơm tuần, Đi chợ và Chế độ nấu Sanctuary. Bạn chỉ nâng cấp Takolio Plus (49.000đ/tháng) khi muốn dùng 100 lượt Quét Camera AI & OCR Hóa đơn mỗi tháng.',
  },
] as const;

function assembleMamCom(selectedIds: string[]): {
  dishes: PlaygroundDish[];
  parallelMinutes: number;
  savedVnd: number;
} {
  const has = (id: string) => selectedIds.includes(id);

  // 1. Món Mặn (Savory Main)
  let mainDish: PlaygroundDish;
  if (has('snakehead_fish') && has('lemongrass')) {
    mainDish = {
      role: 'Món Mặn',
      title: 'Cá lóc kho sả ớt tộ đất',
      subtitle: 'Thịt cá săn chắc, dậy hương sả tươi đưa cơm ngày mát trời.',
      cookMinutes: 28,
      image: '/takolio/v4/dishes/vn-grilled-lemongrass.webp',
      matchedIds: ['snakehead_fish', 'lemongrass'],
    };
  } else if (has('pork') && has('egg')) {
    mainDish = {
      role: 'Món Mặn',
      title: 'Thịt ba chỉ kho trứng nước dừa',
      subtitle: 'Màu cánh gián óng ả, mềm béo chuẩn mâm cơm sum họp.',
      cookMinutes: 32,
      image: '/takolio/v5/posters/claypot-poster.webp',
      matchedIds: ['pork', 'egg'],
    };
  } else if (has('tofu') && has('tomato')) {
    mainDish = {
      role: 'Món Mặn',
      title: 'Đậu phụ nhồi thịt sốt cà chua hành hoa',
      subtitle: 'Vỏ đậu vàng giòn thấm đẫm sốt cà chua tươi chín mọng.',
      cookMinutes: 22,
      image: '/takolio/v4/dishes/vn-tofu-vegetarian.webp',
      matchedIds: ['tofu', 'tomato'],
    };
  } else if (has('snakehead_fish')) {
    mainDish = {
      role: 'Món Mặn',
      title: 'Cá lóc kho tiêu xanh nồi đất',
      subtitle: 'Đậm đà vị mắm nhĩ, sánh kẹo ăn kèm cơm trắng nóng.',
      cookMinutes: 26,
      image: '/takolio/v5/posters/claypot-poster.webp',
      matchedIds: ['snakehead_fish'],
    };
  } else {
    mainDish = {
      role: 'Món Mặn',
      title: 'Ba chỉ rang cháy cạnh mắm hành',
      subtitle: 'Xém vàng thơm nức, tận dụng gọn nguyên liệu sẵn trong ngăn mát.',
      cookMinutes: 20,
      image: '/takolio/v5/posters/claypot-poster.webp',
      matchedIds: has('pork') ? ['pork'] : selectedIds.slice(0, 1),
    };
  }

  // 2. Món Canh (Clear/Sour Soup)
  let soupDish: PlaygroundDish;
  if (has('snakehead_fish') && has('tomato')) {
    soupDish = {
      role: 'Món Canh',
      title: 'Canh chua cá lóc cà chua dọc mùng',
      subtitle: 'Vị chua thanh dịu mát, cân bằng hoàn hảo cho món kho đậm vị.',
      cookMinutes: 18,
      image: '/takolio/v5/posters/soup-poster.webp',
      matchedIds: ['snakehead_fish', 'tomato'],
    };
  } else if (has('egg') && has('tomato')) {
    soupDish = {
      role: 'Món Canh',
      title: 'Canh mây trứng gà cà chua hành ngò',
      subtitle: 'Nấu siêu tốc 8 phút, vân trứng mềm mịn ngọt thanh tự nhiên.',
      cookMinutes: 10,
      image: '/takolio/v4/dishes/vn-sour-soup.webp',
      matchedIds: ['egg', 'tomato'],
    };
  } else if (has('tofu')) {
    soupDish = {
      role: 'Món Canh',
      title: 'Canh đậu phụ non nấu nấm thanh mát',
      subtitle: 'Ngọt lành nhẹ bụng cho cả trẻ nhỏ và người lớn tuổi.',
      cookMinutes: 12,
      image: '/takolio/v4/dishes/vn-sour-soup.webp',
      matchedIds: ['tofu'],
    };
  } else {
    soupDish = {
      role: 'Món Canh',
      title: 'Nước rau muống luộc dầm sấu / chanh tươi',
      subtitle: 'Trong xanh mát ruột đúng điệu bữa cơm mùa hè miền Bắc.',
      cookMinutes: 10,
      image: '/takolio/v4/dishes/vn-sour-soup.webp',
      matchedIds: has('morning_glory') ? ['morning_glory'] : [],
    };
  }

  // 3. Món Xào (Crisp Stir-Fry / Greens)
  let stirFryDish: PlaygroundDish;
  if (has('morning_glory')) {
    stirFryDish = {
      role: 'Món Xào',
      title: 'Rau muống xào tỏi lửa lớn giòn xanh',
      subtitle: 'Đảo nhanh trên chảo nóng giữ trọn sắc xanh và độ giòn sần sật.',
      cookMinutes: 8,
      image: '/takolio/v5/posters/wok-poster.webp',
      matchedIds: ['morning_glory'],
    };
  } else if (has('tofu') && has('lemongrass')) {
    stirFryDish = {
      role: 'Món Xào',
      title: 'Đậu phụ chiên xóc sả ớt giòn rụm',
      subtitle: 'Thơm lừng sả băm vàng ươm, bên trong mềm béo.',
      cookMinutes: 12,
      image: '/takolio/v4/dishes/vn-grilled-lemongrass.webp',
      matchedIds: ['tofu', 'lemongrass'],
    };
  } else {
    stirFryDish = {
      role: 'Món Xào',
      title: 'Rau xanh theo mùa xào dầu hào tỏi phi',
      subtitle: 'Bổ sung chất xơ tươi mát hoàn thiện mâm cơm 3 món.',
      cookMinutes: 9,
      image: '/takolio/v4/dishes/vn-stirfry-greens.webp',
      matchedIds: [],
    };
  }

  const savedVnd = PLAYGROUND_INGREDIENTS.filter((ing) => selectedIds.includes(ing.id)).reduce(
    (sum, item) => sum + item.savedVnd,
    0,
  );
  const parallelMinutes = Math.max(mainDish.cookMinutes, soupDish.cookMinutes + 6);

  return {
    dishes: [mainDish, soupDish, stirFryDish],
    parallelMinutes,
    savedVnd,
  };
}

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<HeroHotspotId>('overview');
  const [sanctuaryMode, setSanctuaryMode] = useState<'braise' | 'stir_fry' | 'simmer'>('braise');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([
    'pork',
    'egg',
    'tomato',
    'morning_glory',
  ]);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const startGuest = async (path: string) => {
    setGuestError(null);
    setIsStarting(true);
    try {
      await setGuestSession();
      navigate(path);
    } catch (error) {
      setGuestError(
        error instanceof Error
          ? error.message
          : 'Không thể khởi tạo phiên khách. Vui lòng thử lại.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  const toggleIngredient = (id: string) => {
    setSelectedIngredients((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      if (prev.length >= 5) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const mamCom = useMemo(() => assembleMamCom(selectedIngredients), [selectedIngredients]);
  const activeSanctuaryDemo =
    SANCTUARY_DEMO_MODES.find((m) => m.id === sanctuaryMode) ?? SANCTUARY_DEMO_MODES[0];

  return (
    <PublicLayout dataTestId="landing-page">
      {/* =======================================================================
       * 1. CONNECTED OBSIDIAN HEARTH ARCHITECTURAL HERO BAND (#0B120F)
       * ======================================================================= */}
      <section
        aria-labelledby="landing-heading"
        className="tk-sanctuary-theme relative overflow-hidden border-b border-white/12 bg-tk-sanctuary text-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-tk-flame/18 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-10 h-80 w-80 rounded-full bg-tk-jade/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-16 lg:pt-12 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left 6 Cols: Editorial Copy + Wrapped Non-Overlapping CTAs + Dark-Glass Metrics */}
            <div className="lg:col-span-6 min-w-0 space-y-6">
              <AtelierBadge
                tone="dark"
                icon={<WokFlameIcon size={14} tone="flame" active />}
              >
                Không Gian Điện Ảnh Bếp Việt · Chuẩn Gia Đình
              </AtelierBadge>

              <h1
                id="landing-heading"
                className="text-3xl sm:text-5xl lg:text-[3.05rem] font-extrabold tracking-tight text-white leading-[1.12]"
              >
                Từ nguyên liệu trong tủ lạnh đến{' '}
                <span className="text-tk-flame-glow">mâm cơm nóng hổi</span> trên bàn.
              </h1>

              <p className="text-base sm:text-lg text-white/78 leading-relaxed max-w-xl">
                Bớt quên đồ nơi góc tủ, hết băn khoăn chiều nay ăn gì. Takolio kết nối quản lý hạn
                dùng FEFO, đạo diễn thực đơn 3 món hài hòa và trợ lý AI Sous-Chef đồng hành từng bước
                bật lửa.
              </p>

              {guestError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-tk-berry/40 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
                >
                  {guestError}
                </div>
              )}

              {/* Responsive Flex-Wrap CTA Row — Zero horizontal overflow at 1440px, 1280px, 1024px, 390px */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <ActionButton
                  variant="flame"
                  size="lg"
                  loading={isStarting}
                  onClick={() => void startGuest('/onboarding')}
                  trailingIcon={<ArrowRight className="w-4.5 h-4.5" aria-hidden="true" />}
                >
                  Khám phá không gian bếp ngay
                </ActionButton>
                <ActionButton
                  variant="sanctuary"
                  size="lg"
                  disabled={isStarting}
                  onClick={() => navigate('/auth')}
                >
                  Đăng nhập / Tạo tài khoản
                </ActionButton>
              </div>

              <p className="text-xs font-semibold text-white/60">
                Dùng thử ngay không cần tạo tài khoản · Đồng bộ hộ gia đình bất cứ lúc nào.
              </p>

              {/* 3 Connected Obsidian-Glass Trust Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl bg-tk-sanctuary-card/95 border border-white/12 p-3.5">
                  <div className="flex items-center gap-2 text-tk-flame-glow font-extrabold text-sm">
                    <HouseholdTrayIcon size={18} tone="flame" active />
                    <span>580+ Món chuẩn vị</span>
                  </div>
                  <p className="mt-1 text-xs text-white/68">
                    Mâm cơm Bắc – Trung – Nam & đổi vị Á – Âu.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card/95 border border-white/12 p-3.5">
                  <div className="flex items-center gap-2 text-tk-jade-mint font-extrabold text-sm">
                    <FreshnessShieldIcon size={18} tone="cream" active />
                    <span>FEFO Lô hạn dùng</span>
                  </div>
                  <p className="mt-1 text-xs text-white/68">
                    Ưu tiên giải cứu thực phẩm sắp hết hạn.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card/95 border border-white/12 p-3.5">
                  <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                    <AiSousChefSparkIcon size={18} tone="turmeric" active />
                    <span>AI Sous-Chef bếp</span>
                  </div>
                  <p className="mt-1 text-xs text-white/68">
                    Gợi ý thay thế gia vị & canh lửa trực tiếp.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 6 Cols: Widescreen 35mm Hearth Cinema Stage + Chapter Switcher */}
            <div className="lg:col-span-6 min-w-0 space-y-3.5">
              <HeroKitchenDiorama3D
                activeHotspot={activeHotspot}
                onSelectHotspot={setActiveHotspot}
                className="min-h-[380px] sm:min-h-[455px]"
              />

              <div
                role="group"
                aria-label="Chọn chương phim không gian bếp"
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {HOTSPOT_PILLS.map((pill) => {
                  const active = activeHotspot === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setActiveHotspot(pill.id)}
                      className={clsx(
                        'tap-target inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-xs font-extrabold border transition-tap cursor-pointer',
                        active
                          ? 'bg-tk-flame text-white border-tk-flame shadow-float'
                          : 'bg-tk-sanctuary-card text-white/80 border-white/14 hover:text-white hover:border-white/30',
                      )}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================================
       * 2. VIETNAMESE 3-REGION CULINARY HERITAGE STRIP (BẮC · TRUNG · NAM)
       * ======================================================================= */}
      <section
        aria-labelledby="heritage-heading"
        className="border-b border-tk-stone bg-tk-canvas py-14 sm:py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <AtelierBadge
                tone="flame"
                icon={<ChopsticksBowlIcon size={14} tone="flame" active />}
              >
                Bản Đồ Vị Giác Việt: Bắc · Trung · Nam
              </AtelierBadge>
              <h2
                id="heritage-heading"
                className="text-2xl sm:text-4xl font-extrabold tracking-tight text-tk-ink"
              >
                Tôn vinh chiều sâu bếp Việt ba miền trong từng thực đơn.
              </h2>
            </div>
            <p className="text-sm text-tk-secondary max-w-md leading-relaxed">
              Mỗi vùng đất mang một nhịp nêm nếm riêng — từ vị thanh tao miền Bắc, sắc cay nồng Cố Đô
              đến nồi kho tộ đậm tình miền Tây sông nước.
            </p>
          </div>

          {/* Architectural Hairline-Connected 3-Region Editorial Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-tk-stone rounded-[28px] border border-tk-stone bg-tk-surface shadow-elevated overflow-hidden">
            {REGIONAL_HERITAGE_STRIP.map((item) => (
              <article key={item.regionCode} className="flex flex-col justify-between">
                <div>
                  <div className="relative h-52 overflow-hidden bg-tk-sanctuary">
                    <img
                      src={item.imageSrc}
                      alt={item.dishTitle}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="tk-cinema-vignette pointer-events-none absolute inset-0"
                    />
                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <span className="tk-glass-dark rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wider text-white">
                        {item.regionCode}
                      </span>
                      <span className="rounded-full bg-tk-flame px-2.5 py-1 text-[11px] font-bold text-white">
                        {item.regionLabelVi}
                      </span>
                    </div>
                    <span className="tk-glass-dark absolute bottom-3.5 right-4 rounded-full px-2.5 py-1 text-xs font-extrabold text-white tk-tabular">
                      ~{item.cookMinutes} phút
                    </span>
                  </div>

                  <div className="p-6 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-tk-jade">
                      {item.characterVi}
                    </p>
                    <h3 className="text-xl font-extrabold text-tk-ink">{item.dishTitle}</h3>
                    <p className="text-sm text-tk-secondary leading-relaxed">
                      {item.descriptionVi}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-tk-sunken/55 border-t border-tk-stone/70 flex items-center justify-between text-xs">
                  <span className="font-extrabold text-tk-ink">{item.signatureTagVi}</span>
                  <span className="font-bold text-tk-flame">Đối chiếu tồn kho FEFO →</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =======================================================================
       * 3. INTERACTIVE LIVE "TỦ LẠNH → MÂM CƠM" BUILDER (DARK HEADER + STONEWARE)
       * ======================================================================= */}
      <section
        aria-labelledby="playground-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 py-14 sm:py-16"
      >
        <div className="rounded-[30px] border border-tk-stone shadow-elevated overflow-hidden bg-tk-sunken">
          {/* Connected Obsidian Hearth Header & Ingredient Selector */}
          <div className="bg-tk-sanctuary-card text-white p-6 sm:p-8 lg:p-10 space-y-6 border-b border-white/10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <AtelierBadge
                  tone="dark"
                  icon={<Sparkles className="w-3.5 h-3.5 text-tk-flame-glow" aria-hidden="true" />}
                >
                  Thử Ngay Tại Đây · Tủ Lạnh → Mâm Cơm Tức Thì
                </AtelierBadge>
                <h2
                  id="playground-heading"
                  className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white"
                >
                  Chạm 3–5 nguyên liệu đang có, xem Takolio dọn Mâm Cơm 3 món.
                </h2>
                <p className="text-sm sm:text-base text-white/75">
                  Chọn hoặc bỏ chọn nguyên liệu bên dưới để cảm nhận cách động cơ ghép bữa cân bằng
                  Món Mặn · Món Canh · Món Xào và tính nhẩm khoản tiền thực phẩm vừa cứu được.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="rounded-2xl bg-tk-sanctuary border border-white/14 px-4 py-2.5 flex items-center gap-2.5">
                  <Clock className="w-4.5 h-4.5 text-tk-flame-glow shrink-0" aria-hidden="true" />
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-white/60">
                      Thời gian nấu song song
                    </span>
                    <strong className="text-sm font-extrabold text-white tk-tabular">
                      ~{mamCom.parallelMinutes} phút trọn mâm
                    </strong>
                  </div>
                </div>
                <div className="rounded-2xl bg-tk-jade/35 border border-tk-jade-mint/35 px-4 py-2.5 flex items-center gap-2.5">
                  <BudgetCoinJarIcon size={20} tone="cream" active />
                  <div>
                    <span className="block text-[11px] font-bold uppercase text-tk-jade-mint">
                      Chống lãng phí ước tính
                    </span>
                    <strong className="text-sm font-extrabold text-white tk-tabular">
                      Tiết kiệm {mamCom.savedVnd.toLocaleString('vi-VN')}đ
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Fridge Ingredient Chips */}
            <div
              role="group"
              aria-label="Nguyên liệu mẫu trong tủ lạnh"
              className="flex flex-wrap gap-2.5"
            >
              {PLAYGROUND_INGREDIENTS.map((ing) => {
                const selected = selectedIngredients.includes(ing.id);
                return (
                  <button
                    key={ing.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleIngredient(ing.id)}
                    className={clsx(
                      'tap-target inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold border transition-tap cursor-pointer',
                      selected
                        ? 'bg-tk-flame text-white border-tk-flame shadow-float'
                        : 'bg-tk-sanctuary text-white/85 border-white/16 hover:border-white/40 hover:text-white',
                    )}
                  >
                    {selected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    <span>{ing.label}</span>
                    <span
                      className={clsx(
                        'text-[11px] rounded-pill px-2 py-0.5 font-semibold',
                        selected ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70',
                      )}
                    >
                      {ing.expiryHint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Warm Stoneware Assembled 3-Dish Mâm Cơm Cards */}
          <div className="p-6 sm:p-8 lg:p-10 grid grid-cols-1 md:grid-cols-3 gap-5">
            {mamCom.dishes.map((dish) => {
              const RoleIcon =
                dish.role === 'Món Mặn'
                  ? ClaypotBraiseIcon
                  : dish.role === 'Món Canh'
                    ? StockpotSoupIcon
                    : WokFlameIcon;
              const badgeTone =
                dish.role === 'Món Mặn'
                  ? 'flame'
                  : dish.role === 'Món Canh'
                    ? 'jade'
                    : 'turmeric';
              return (
                <BentoCard
                  key={`${dish.role}-${dish.title}`}
                  tone="ceramic"
                  padding="none"
                  className="flex flex-col overflow-hidden border-tk-stone animate-fade-in"
                >
                  <div className="relative h-52 overflow-hidden bg-tk-sanctuary">
                    <img
                      src={dish.image}
                      alt={dish.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div
                      aria-hidden="true"
                      className="tk-cinema-vignette pointer-events-none absolute inset-0"
                    />
                    <div className="absolute top-3.5 left-3.5">
                      <AtelierBadge
                        tone={badgeTone}
                        icon={<RoleIcon size={13} tone={badgeTone} active />}
                      >
                        {dish.role}
                      </AtelierBadge>
                    </div>
                    <span className="tk-glass-dark absolute bottom-3.5 right-3.5 rounded-pill text-white px-2.5 py-1 text-xs font-bold tk-tabular">
                      {dish.cookMinutes} phút
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3 bg-tk-surface">
                    <div>
                      <h3 className="text-base font-extrabold text-tk-ink leading-snug">
                        {dish.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-tk-secondary leading-relaxed">
                        {dish.subtitle}
                      </p>
                    </div>
                    <div className="pt-2.5 border-t border-tk-stone/80 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-tk-jade">
                        {dish.matchedIds.length > 0
                          ? `Dùng ${dish.matchedIds.length} nguyên liệu đã chọn`
                          : 'Kết hợp gia vị sẵn bếp'}
                      </span>
                      <span className="text-tk-muted font-semibold">Chuẩn vị nhà</span>
                    </div>
                  </div>
                </BentoCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* =======================================================================
       * 4. DEEP FOREST PINE ARCHITECTURAL BAND — 4-PILLAR CLOSED-LOOP KITCHEN
       * ======================================================================= */}
      <section
        aria-labelledby="pillars-heading"
        className="border-y border-tk-jade/30 bg-tk-jade-deep text-white py-16 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-10">
          <div className="max-w-2xl space-y-3">
            <AtelierBadge tone="dark">Vòng Khép Kín Bếp Gia Đình</AtelierBadge>
            <h2
              id="pillars-heading"
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white"
            >
              Bắt đầu từ chính căn bếp của bạn, khép kín không một kẽ hở lãng phí.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Pillar 1 */}
            <BentoCard
              tone="ceramic"
              padding="lg"
              className="md:col-span-7 space-y-5 border-tk-stone bg-tk-surface"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="w-12 h-12 rounded-2xl bg-tk-jade-soft border border-tk-jade/20 flex items-center justify-center">
                  <NavFridgeIcon size={24} tone="jade" active />
                </div>
                <AtelierBadge tone="jade" icon={<ReceiptScanIcon size={14} tone="jade" active />}>
                  01 · Kiểm tra trước khi thêm
                </AtelierBadge>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-tk-ink">
                  Tủ lạnh Thông minh FEFO &amp; Quét AI Hóa đơn
                </h3>
                <p className="text-sm text-tk-secondary leading-relaxed">
                  Chụp ảnh kệ tủ lạnh hoặc hóa đơn siêu thị để nhận diện nhanh mặt hàng và hạn bảo
                  quản theo nguyên tắc FEFO. Bạn luôn xem lại tên, lượng ở bước{' '}
                  <strong className="text-tk-ink">Kiểm tra trước khi thêm</strong> vào ngăn mát, ngăn
                  đông hay tủ khô. AI hỗ trợ nhận diện, người nội trợ giữ quyền quyết định —{' '}
                  <span className="font-semibold text-tk-ink">Kết quả có thể cần sửa</span> tùy độ nét
                  ảnh chụp.
                </p>
              </div>
              <div className="tk-cinema-stage h-60">
                <img
                  src="/takolio/v5/posters/fridge-poster.webp"
                  alt="Khoang tủ lạnh thông minh 3 ngăn FEFO của Takolio"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="tk-cinema-vignette pointer-events-none absolute inset-0"
                />
              </div>
            </BentoCard>

            {/* Pillar 2 */}
            <BentoCard
              tone="ceramic"
              padding="lg"
              className="md:col-span-5 flex flex-col justify-between space-y-5 border-tk-stone bg-tk-surface"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-tk-flame-soft border border-tk-flame/20 flex items-center justify-center">
                    <HouseholdTrayIcon size={24} tone="flame" active />
                  </div>
                  <AtelierBadge tone="flame">02 · Mâm Cơm Đa Nồi</AtelierBadge>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-tk-ink">
                  Đạo diễn Mâm Cơm Việt Nhiều Nồi Song Song
                </h3>
                <p className="text-sm text-tk-secondary leading-relaxed">
                  Tự động lên thực đơn cả tuần với đầy đủ món mặn, canh, rau xào dùng chung nguyên
                  liệu khéo léo, loại bỏ hoàn toàn các thành phần gây dị ứng cho gia đình.
                </p>
              </div>
              <div className="tk-cinema-stage h-60">
                <img
                  src="/takolio/v5/posters/mamcom-poster.webp"
                  alt="Mâm cơm gia đình Việt ấm cúng nắng chiều"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="tk-cinema-vignette pointer-events-none absolute inset-0"
                />
              </div>
            </BentoCard>

            {/* Pillar 3 */}
            <BentoCard
              tone="sanctuary"
              padding="lg"
              className="md:col-span-6 space-y-4 border-white/14 bg-tk-sanctuary-card"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="w-12 h-12 rounded-2xl bg-tk-turmeric/20 border border-tk-turmeric/40 flex items-center justify-center">
                  <AiSousChefSparkIcon size={24} tone="turmeric" active />
                </div>
                <AtelierBadge tone="dark">03 · Trợ Lý Cứu Nguy</AtelierBadge>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Cổng AI Sous-Chef Cứu Nguy Từng Bước Nấu
              </h3>
              <p className="text-sm text-white/78 leading-relaxed">
                Đang phi hành mới phát hiện hết nước mắm ngon hay lỡ tay cho hơi cay? Bấm hỏi ngay
                Sous-Chef tại bước đang nấu để nhận mẹo chữa món và gợi ý thay thế từ đồ sẵn trong tủ.
              </p>
            </BentoCard>

            {/* Pillar 4 */}
            <BentoCard
              tone="sanctuary"
              padding="lg"
              className="md:col-span-6 space-y-4 border-white/14 bg-tk-sanctuary-card"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="w-12 h-12 rounded-2xl bg-tk-jade/35 border border-tk-jade-mint/35 flex items-center justify-center">
                  <NavShoppingIcon size={24} tone="cream" active />
                </div>
                <AtelierBadge tone="dark">04 · Vòng Khép Kín</AtelierBadge>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Vòng Lặp Đi Chợ → 1 Chạm Nhập Kho
              </h3>
              <p className="text-sm text-white/78 leading-relaxed">
                Thực đơn tuần tự động trừ phần nguyên liệu đã có trong tủ để tạo giỏ đi chợ gọn nhẹ.
                Mua xong tại chợ hoặc siêu thị, chỉ cần 1 chạm là toàn bộ đồ tươi đi thẳng vào kệ FEFO.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* =======================================================================
       * 5. OBSIDIAN COOKING CINEMA SANCTUARY BAND (LIVE 35MM COOKING STAGE)
       * ======================================================================= */}
      <section
        aria-labelledby="sanctuary-heading"
        className="tk-sanctuary-theme border-b border-white/12 py-16 sm:py-22"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <AtelierBadge
                tone="dark"
                icon={<WakeLockSunIcon size={14} tone="cream" active />}
              >
                Active Cooking Sanctuary · Điện Ảnh Đứng Bếp Chống Chói
              </AtelierBadge>
              <h2
                id="sanctuary-heading"
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight"
              >
                Tay đang bận thái rau? Cứ nói &quot;Tako&quot; để chuyển bước và canh lửa.
              </h2>
              <p className="text-sm sm:text-base text-white/78 leading-relaxed">
                Không gian Đứng Bếp được thiết kế riêng cho khoảnh khắc bận rộn nhất bên bếp lửa: độ
                tương phản cao, khóa tắt màn hình tự động, sân khấu quay cận cảnh độ chín và thanh
                hẹn giờ nhiều nồi chạy độc lập.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/12 p-4 space-y-2">
                  <MultiTimerIcon size={22} tone="flame" active />
                  <h3 className="text-sm font-bold text-white">Multi-Timer Dock</h3>
                  <p className="text-xs text-white/70">
                    Canh giờ nồi kho, nồi canh &amp; chảo xào cùng lúc không lo cháy khét.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/12 p-4 space-y-2">
                  <WakeLockSunIcon size={22} tone="turmeric" active />
                  <h3 className="text-sm font-bold text-white">Screen Wake Lock</h3>
                  <p className="text-xs text-white/70">
                    Giữ màn hình luôn sáng rõ suốt buổi nấu mà không cần chạm tay ướt.
                  </p>
                </div>
                <div className="rounded-2xl bg-tk-sanctuary-card border border-white/12 p-4 space-y-2">
                  <VoiceWaveTakoIcon size={22} tone="cream" active />
                  <h3 className="text-sm font-bold text-white">Giọng nói &quot;Tako&quot;</h3>
                  <p className="text-xs text-white/70">
                    Ra lệnh bước tiếp theo, lặp lại định lượng gia vị hoàn toàn rảnh tay.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <ActionButton
                  to="/features"
                  variant="sanctuary"
                  size="lg"
                  trailingIcon={<ArrowRight className="w-4.5 h-4.5" aria-hidden="true" />}
                >
                  Khám phá chi tiết công nghệ Bếp
                </ActionButton>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-3">
              <div className="rounded-[28px] bg-tk-sanctuary-card border border-white/15 p-3.5 sm:p-4 shadow-cinema space-y-3.5">
                {/* Interactive Live Cooking Technique Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white/75">
                    Trực tiếp trên mặt bếp:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SANCTUARY_DEMO_MODES.map((modeOpt) => {
                      const active = sanctuaryMode === modeOpt.id;
                      return (
                        <button
                          key={modeOpt.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSanctuaryMode(modeOpt.id)}
                          className={clsx(
                            'rounded-full px-3 py-1 text-xs font-bold border transition-colors cursor-pointer',
                            active
                              ? 'bg-tk-flame text-white border-tk-flame'
                              : 'bg-tk-sanctuary text-white/75 border-white/14 hover:text-white',
                          )}
                        >
                          {modeOpt.labelVi}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ActiveCookwareStage3D
                  technique={activeSanctuaryDemo.technique}
                  heatLevel={activeSanctuaryDemo.heat}
                  timerRunning
                  timerProgress={0.72}
                  stepTitle={activeSanctuaryDemo.stepTitle}
                  className="min-h-[290px] sm:min-h-[330px]"
                />

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-xl bg-tk-sanctuary-elevated border border-white/10 px-3 py-2">
                    <span className="block text-white/60">Bếp 1 · Nồi đất</span>
                    <strong className="text-tk-flame-glow font-extrabold tk-tabular">
                      14:20 đang kho
                    </strong>
                  </div>
                  <div className="rounded-xl bg-tk-sanctuary-elevated border border-white/10 px-3 py-2">
                    <span className="block text-white/60">Bếp 2 · Canh chua</span>
                    <strong className="text-white font-extrabold tk-tabular">04:45 sôi dịu</strong>
                  </div>
                  <div className="rounded-xl bg-tk-sanctuary-elevated border border-white/10 px-3 py-2">
                    <span className="block text-white/60">Khẩu lệnh</span>
                    <strong className="text-tk-jade-mint font-extrabold">
                      &quot;Tako, tiếp theo&quot;
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =======================================================================
       * 6. INTERACTIVE FAQ ACCORDION
       * ======================================================================= */}
      <section
        aria-labelledby="faq-heading"
        className="mx-auto max-w-4xl px-4 sm:px-6 py-16 space-y-8"
      >
        <div className="text-center space-y-2.5">
          <AtelierBadge tone="neutral">Giải Đáp Thắc Mắc</AtelierBadge>
          <h2 id="faq-heading" className="text-2xl sm:text-4xl font-extrabold text-tk-ink">
            Câu hỏi thường gặp trước khi vào bếp
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaqIdx === idx;
            const panelId = `faq-panel-${idx}`;
            const triggerId = `faq-trigger-${idx}`;
            return (
              <div
                key={item.q}
                className="rounded-[22px] bg-tk-surface border border-tk-stone shadow-xs overflow-hidden"
              >
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="tap-target w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm sm:text-base font-extrabold text-tk-ink hover:bg-tk-sunken/50 transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={clsx(
                        'w-5 h-5 text-tk-muted shrink-0 transition-transform duration-200',
                        isOpen && 'rotate-180 text-tk-flame',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    className="px-5 pb-5 text-sm text-tk-secondary leading-relaxed border-t border-tk-stone/70 pt-3 animate-fade-in"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =======================================================================
       * 7. OBSIDIAN HEARTH CLOSING CTA BANNER
       * ======================================================================= */}
      <section aria-label="Bắt đầu sử dụng Takolio" className="mx-auto max-w-7xl px-4 sm:px-6 pt-2">
        <div className="tk-sanctuary-theme rounded-[30px] border border-white/15 p-7 sm:p-10 shadow-cinema">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <AtelierBadge
                tone="dark"
                icon={<NavScanApertureIcon size={14} tone="flame" active />}
              >
                60 Giây Khởi Tạo Không Gian Bếp
              </AtelierBadge>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Mở cửa tủ lạnh chiều nay với sự thảnh thơi hoàn toàn mới.
              </h2>
              <p className="text-sm sm:text-base text-white/75 max-w-2xl">
                Thiết lập số chén đũa gia đình và khẩu vị vùng miền chỉ trong 1 phút — Takolio sẵn
                sàng dọn mâm cơm đầu tiên cùng bạn.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
              <ActionButton
                variant="flame"
                size="lg"
                fullWidth
                loading={isStarting}
                onClick={() => void startGuest('/onboarding')}
                trailingIcon={<ArrowRight className="w-5 h-5" aria-hidden="true" />}
              >
                Vào bếp miễn phí ngay
              </ActionButton>
              <ActionButton to="/pricing" variant="sanctuary" size="lg" fullWidth>
                Tìm hiểu gói Takolio Plus
              </ActionButton>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
