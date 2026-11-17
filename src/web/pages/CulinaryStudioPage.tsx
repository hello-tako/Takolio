import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Minus,
  Plus,
  Quote,
  RotateCcw,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import { clsx } from 'clsx';
import { TopBar } from '../components/common/TopBar';
import { CulinaryCinemaStage } from '../components/3d/CulinaryCinemaStage';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  RadialProgressRing,
  SegmentedTabs,
} from '../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  ChefKnifeBoardIcon,
  ClaypotBraiseIcon,
  FishSauceCruetIcon,
  HerbSprigIcon,
  LeftoverBoxIcon,
  MarinateBowlIcon,
  MortarPestleIcon,
  MultiTimerIcon,
  SensoryAromaIcon,
  WokFlameIcon,
  type TakolioIconProps,
} from '../design-system/icons';
import { api } from '../services/api';
import { getCurrentScope } from '../services/http';
import {
  kitchenOsApi,
  type HeirloomRecipeDraft,
  type VietnameseRegion,
} from '../services/kitchen-os';
import { recipeImageErrorHandler, resolveRecipeImageV4 } from '../lib/recipe-media';

type StudioMode = 'heirloom' | 'batch_prep';

const BATCH_PREP_STORAGE_KEY = 'takolio_v6_batch_prep_checked';

const HEIRLOOM_INSPIRATION_CHIPS: ReadonlyArray<{
  prompt: string;
  region: VietnameseRegion;
  storyHint: string;
}> = [
  {
    prompt: 'Cá trắm kho riềng mẻ kiểu Bắc',
    region: 'bac',
    storyHint: 'Món mẹ thường kho hai lửa bằng nồi gang mỗi chiều gió mùa về.',
  },
  {
    prompt: 'Thịt ba chỉ rim mắm nhĩ tiêu xanh',
    region: 'nam',
    storyHint: 'Đĩa thịt rim bóng mượt dậy mùi tiêu xanh Phú Quốc hao cơm nhất nhà.',
  },
  {
    prompt: 'Canh gà lá giang thanh mát',
    region: 'nam',
    storyHint: 'Bát canh chua dịu giải nhiệt trưa hè cả nhà ai cũng húp cạn nước.',
  },
  {
    prompt: 'Đậu phụ nhồi thịt sốt cà chua gia truyền',
    region: 'bac',
    storyHint: 'Món ngoại hay nấu mỗi chiều mưa tháng Chạp với hành hoa thái nhỏ.',
  },
] as const;

const REGION_OPTIONS: ReadonlyArray<{ value: VietnameseRegion; labelVi: string }> = [
  { value: 'bac', labelVi: 'Bắc' },
  { value: 'trung', labelVi: 'Trung' },
  { value: 'nam', labelVi: 'Nam' },
  { value: 'all', labelVi: 'Mọi miền' },
] as const;

const REGION_BADGE_LABELS: Record<VietnameseRegion, string> = {
  bac: 'Chuẩn vị Bắc',
  trung: 'Chuẩn vị Trung',
  nam: 'Chuẩn vị Nam',
  all: 'Gia truyền Việt',
};

interface PrepCandidateDish {
  id: string;
  slug: string;
  title: string;
  cookTimeMinutes: number;
  servings: number;
  imageUrl?: string;
}

const FALLBACK_CANDIDATE_DISHES: readonly PrepCandidateDish[] = [
  {
    id: 'fallback-1',
    slug: 'thit-kho-trung-nuoc-dua',
    title: 'Thịt Kho Trứng Nước Dừa Tươi',
    cookTimeMinutes: 45,
    servings: 4,
  },
  {
    id: 'fallback-2',
    slug: 'canh-chua-ca-loc',
    title: 'Canh Chua Cá Lóc Nam Bộ',
    cookTimeMinutes: 30,
    servings: 4,
  },
  {
    id: 'fallback-3',
    slug: 'ga-kho-gung-sa',
    title: 'Gà Ta Kho Gừng Sả Đậm Đà',
    cookTimeMinutes: 35,
    servings: 4,
  },
  {
    id: 'fallback-4',
    slug: 'bo-xao-bong-cai-xanh',
    title: 'Thịt Bò Xào Bông Cải Xanh Tỏi Phi',
    cookTimeMinutes: 18,
    servings: 4,
  },
  {
    id: 'fallback-5',
    slug: 'dau-phu-nhoi-thit-sot-ca',
    title: 'Đậu Phụ Nhồi Thịt Sốt Cà Chua',
    cookTimeMinutes: 28,
    servings: 4,
  },
  {
    id: 'fallback-6',
    slug: 'suon-xao-chua-ngot',
    title: 'Sườn Non Xào Chua Ngọt Chuẩn Cơm Nhà',
    cookTimeMinutes: 35,
    servings: 4,
  },
] as const;

interface BatchPrepTask {
  id: string;
  titleVi: string;
  detailVi: string;
  durationMinutes: number;
}

interface BatchPrepStation {
  stationNumber: string;
  titleVi: string;
  windowLabelVi: string;
  Icon: React.FC<TakolioIconProps>;
  tone: 'jade' | 'flame' | 'turmeric';
  tasks: BatchPrepTask[];
}

function readPersistedPrepChecks(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(BATCH_PREP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function writePersistedPrepChecks(next: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BATCH_PREP_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

function buildFourStationBlueprint(selectedDishes: PrepCandidateDish[]): BatchPrepStation[] {
  const dishTitles = selectedDishes.map((d) => d.title);
  const firstPair = dishTitles.slice(0, 2).join(' & ') || 'các món đầu tuần';
  const laterDishes = dishTitles.slice(2).join(', ') || dishTitles[0] || 'các bữa giữa tuần';
  const allShort = dishTitles.slice(0, 4).join(' · ') || 'Thực đơn gia đình';

  return [
    {
      stationNumber: '01',
      titleVi: 'Trạm 01 · Rửa sạch, quay ráo & lót khăn ẩm bảo quản rau thơm (giữ tươi 5–7 ngày)',
      windowLabelVi: 'Phút 00 – 22',
      Icon: HerbSprigIcon,
      tone: 'jade',
      tasks: [
        {
          id: 'st1_wash_spin',
          titleVi: 'Nhặt gốc, ngâm rửa sạch và quay thật ráo toàn bộ rau ăn kèm & hành ngò',
          detailVi: `Chuẩn bị rau xanh và rau thơm cho ${allShort}. Tuyệt đối không để đọng nước trên lá trước khi cất hộp.`,
          durationMinutes: 10,
        },
        {
          id: 'st1_damp_towel',
          titleVi: 'Xếp hộp kín lót 2 lớp giấy bếp / khăn vải ẩm ở đáy và mặt trên (3°C)',
          detailVi: 'Giữ hành lá, rau mùi, ngò gai xanh mướt giòn rụm suốt 5–7 ngày không úa vàng.',
          durationMinutes: 6,
        },
        {
          id: 'st1_aromatics_jar',
          titleVi: 'Bóc sẵn 1 hũ hành tím, tỏi ta & thái lát gừng sả dùng xuyên tuần',
          detailVi: 'Cất hũ thuỷ tinh khô nắp kín giúp các tối đi làm về giảm ngay 8 phút lột băm.',
          durationMinutes: 6,
        },
      ],
    },
    {
      stationNumber: '02',
      titleVi: 'Trạm 02 · Cắt thái & ướp cốt thịt cá chia hộp thuỷ tinh (Ngăn mát 3°C / Ngăn đông -18°C)',
      windowLabelVi: 'Phút 22 – 52',
      Icon: MarinateBowlIcon,
      tone: 'flame',
      tasks: [
        {
          id: 'st2_clean_portion',
          titleVi: 'Sơ chế khử mùi gừng muối & chia khẩu phần đạm tươi theo từng bữa',
          detailVi: `Chia riêng hộp thuỷ tinh chuẩn định lượng cho: ${allShort}.`,
          durationMinutes: 12,
        },
        {
          id: 'st2_chill_mon_tue',
          titleVi: `Ướp cốt mắm nhĩ & hành tiêu cho bữa Thứ 2 – Thứ 3 (${firstPair})`,
          detailVi: 'Bảo quản tại Ngăn mát 3°C để thịt cá thấm vị sâu, tối về chỉ việc bật bếp nấu ngay.',
          durationMinutes: 10,
        },
        {
          id: 'st2_freeze_wed_fri',
          titleVi: `Ép phẳng hút khí & cấp đông nhanh -18°C cho các món Thứ 4 – Thứ 6 (${laterDishes})`,
          detailVi: 'Dàn mỏng trong túi zip / hộp dẹt giúp rã đông nhanh gấp đôi mà giữ nguyên độ mọng ngọt.',
          durationMinutes: 8,
        },
      ],
    },
    {
      stationNumber: '03',
      titleVi: 'Trạm 03 · Pha sốt mắm chuẩn vị & ninh nước dùng nền đa năng',
      windowLabelVi: 'Phút 52 – 76',
      Icon: FishSauceCruetIcon,
      tone: 'turmeric',
      tasks: [
        {
          id: 'st3_master_sauce',
          titleVi: 'Khuấy 1 hũ Sốt Mắm Đường Cánh Gián Đa Năng tỷ lệ vàng gia đình',
          detailVi: 'Dùng chung cho các món kho, rim, áp chảo trong tuần mà không cần đong đếm lại từng thìa lúc vội.',
          durationMinutes: 8,
        },
        {
          id: 'st3_base_broth',
          titleVi: 'Ninh 1,5 lít nước dùng thanh ngọt từ xương / củ quả & hớt sạch bọt',
          detailVi: 'Chia thành 3 hộp 500ml để nấu canh nóng chỉ mất đúng 6 phút mỗi tối.',
          durationMinutes: 10,
        },
        {
          id: 'st3_garlic_oil',
          titleVi: 'Phi vàng 1 chén dầu hành tỏi thơm giòn để xào rau xanh mướt',
          detailVi: 'Bí quyết giúp món rau xào bữa tối dậy mùi như nhà hàng trong 3 phút lửa lớn.',
          durationMinutes: 6,
        },
      ],
    },
    {
      stationNumber: '04',
      titleVi: 'Trạm 04 · Dán nhãn hộp bảo quản & thứ tự rã đông các tối Thứ 2 – Thứ 6',
      windowLabelVi: 'Phút 76 – 90',
      Icon: LeftoverBoxIcon,
      tone: 'jade',
      tasks: [
        {
          id: 'st4_label_fefo',
          titleVi: 'Dán nhãn ngày sơ chế & tên món lên từng hộp theo nguyên tắc FEFO',
          detailVi: `Xếp hộp Thứ 2 – Thứ 3 (${firstPair}) ra hàng ngoài cùng tầm mắt Ngăn mát 3°C.`,
          durationMinutes: 6,
        },
        {
          id: 'st4_thaw_schedule',
          titleVi: 'Thiết lập lịch hạ ngăn mát trước 12 tiếng cho thực phẩm Thứ 4 – Thứ 6',
          detailVi: `Chuyển hộp ${laterDishes} từ ngăn đông -18°C xuống ngăn mát 3°C vào tối hôm trước để rã đông an toàn vi sinh.`,
          durationMinutes: 4,
        },
        {
          id: 'st4_clean_station',
          titleVi: 'Lau khô mặt bàn bếp & khử trùng thớt dao kết thúc 90 phút gọn gàng',
          detailVi: 'Căn bếp sạch thoáng sẵn sàng cho cả tuần đi làm thảnh thơi, đỏ lửa 15 phút là có cơm ngon.',
          durationMinutes: 4,
        },
      ],
    },
  ];
}

export const CulinaryStudioPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = getCurrentScope();

  const urlMode: StudioMode =
    searchParams.get('tab') === 'prep' || searchParams.get('tab') === 'batch_prep'
      ? 'batch_prep'
      : 'heirloom';

  const [mode, setMode] = useState<StudioMode>(urlMode);

  useEffect(() => {
    setMode(urlMode);
  }, [urlMode]);

  const handleModeChange = (next: StudioMode) => {
    setMode(next);
    if (next === 'batch_prep') {
      setSearchParams({ tab: 'prep' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  /* ==========================================================================
   * MODE 1 STATE — AI HEIRLOOM COMPOSER & GALLERY
   * ========================================================================== */
  const [rawMemoryPrompt, setRawMemoryPrompt] = useState<string>(
    'Cá trắm kho riềng sả thịt ba chỉ kiểu mẹ nấu 50 phút, nước hàng cánh gián đậm đà',
  );
  const [familyStoryInput, setFamilyStoryInput] = useState<string>(
    'Món ngoại hay nấu mỗi chiều mưa tháng Chạp, mở vung thơm ấm cả gian nhà.',
  );
  const [selectedRegion, setSelectedRegion] = useState<VietnameseRegion>('bac');
  const [servings, setServings] = useState<number>(4);
  const [synthesizedDraft, setSynthesizedDraft] = useState<HeirloomRecipeDraft | null>(null);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  const heirloomQueryKey = ['kitchen-os', 'heirloom-recipes', scope.userId, scope.householdId] as const;

  const heirloomQuery = useQuery({
    queryKey: heirloomQueryKey,
    queryFn: () => kitchenOsApi.getHeirloomRecipes(),
    staleTime: 15_000,
  });

  const synthesizeMutation = useMutation({
    mutationFn: () =>
      kitchenOsApi.synthesizeHeirloomDraft(rawMemoryPrompt, {
        familyStory: familyStoryInput,
        region: selectedRegion,
        servings,
      }),
    onSuccess: (draft) => {
      setSynthesizedDraft(draft);
      setSaveToastMessage(null);
    },
  });

  const saveHeirloomMutation = useMutation({
    mutationFn: (draft: HeirloomRecipeDraft) => kitchenOsApi.saveHeirloomRecipe(draft),
    onSuccess: async (saved) => {
      setSaveToastMessage(`Đã lưu “${saved.title}” vào Sổ Tay Gia Truyền của gia đình!`);
      await queryClient.invalidateQueries({ queryKey: heirloomQueryKey });
    },
  });

  const deleteHeirloomMutation = useMutation({
    mutationFn: (id: string) => kitchenOsApi.deleteHeirloomRecipe(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: heirloomQueryKey });
    },
  });

  /* ==========================================================================
   * MODE 2 STATE — 90-MINUTE SUNDAY BATCH-PREP STUDIO
   * ========================================================================== */
  const discoveryCandidatesQuery = useQuery({
    queryKey: ['studio-batch-prep-candidates', scope.userId, scope.householdId],
    queryFn: () => api.getRecipeDiscovery({ pageSize: 12 }),
    staleTime: 60_000,
    retry: false,
  });

  const candidateDishes: PrepCandidateDish[] = useMemo(() => {
    const serverItems = discoveryCandidatesQuery.data?.items;
    if (serverItems && serverItems.length >= 2) {
      return serverItems.slice(0, 12).map((item) => ({
        id: item.recipe.id,
        slug: item.recipe.slug,
        title: item.recipe.title,
        cookTimeMinutes: item.recipe.cookTimeMinutes,
        servings: item.recipe.servings,
        imageUrl: item.recipe.imageUrl,
      }));
    }
    return [...FALLBACK_CANDIDATE_DISHES];
  }, [discoveryCandidatesQuery.data]);

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>(() =>
    readPersistedPrepChecks(),
  );

  // Automatically pre-select the first 3 candidate dishes once available
  useEffect(() => {
    if (!hasInitializedSelection && candidateDishes.length > 0) {
      setSelectedSlugs(candidateDishes.slice(0, 3).map((d) => d.slug));
      setHasInitializedSelection(true);
    }
  }, [candidateDishes, hasInitializedSelection]);

  // Re-sync selection if fallback swapped to server catalog
  useEffect(() => {
    if (!hasInitializedSelection || candidateDishes.length === 0) return;
    const validSet = new Set(candidateDishes.map((d) => d.slug));
    const validSelected = selectedSlugs.filter((s) => validSet.has(s));
    if (validSelected.length === 0) {
      setSelectedSlugs(candidateDishes.slice(0, 3).map((d) => d.slug));
    }
  }, [candidateDishes, hasInitializedSelection, selectedSlugs]);

  const toggleDishSelection = (slug: string) => {
    setSelectionHint(null);
    setSelectedSlugs((prev) => {
      if (prev.includes(slug)) {
        if (prev.length <= 2) {
          setSelectionHint('Nên giữ tối thiểu 2 món để tối ưu mẻ sơ chế Chủ Nhật.');
          return prev;
        }
        return prev.filter((item) => item !== slug);
      }
      if (prev.length >= 6) {
        setSelectionHint('Tối đa 6 món mỗi mẻ sơ chế để gói gọn trọn vẹn trong 90 phút.');
        return prev;
      }
      return [...prev, slug];
    });
  };

  const selectedDishObjects = useMemo(
    () => candidateDishes.filter((d) => selectedSlugs.includes(d.slug)),
    [candidateDishes, selectedSlugs],
  );

  const stations = useMemo(
    () => buildFourStationBlueprint(selectedDishObjects),
    [selectedDishObjects],
  );

  const allTaskIds = useMemo(
    () => stations.flatMap((s) => s.tasks.map((t) => t.id)),
    [stations],
  );

  const completedTaskCount = useMemo(
    () => allTaskIds.filter((id) => checkedTasks[id]).length,
    [allTaskIds, checkedTasks],
  );

  const completionPercent =
    allTaskIds.length > 0 ? Math.round((completedTaskCount / allTaskIds.length) * 100) : 0;

  const minutesSavedPerWeeknight = useMemo(() => {
    if (selectedDishObjects.length === 0) return 25;
    const avgCook =
      selectedDishObjects.reduce((acc, d) => acc + d.cookTimeMinutes, 0) /
      selectedDishObjects.length;
    return Math.max(18, Math.min(42, Math.round(avgCook * 0.55 + selectedDishObjects.length * 2.5)));
  }, [selectedDishObjects]);

  const togglePrepTask = (taskId: string) => {
    setCheckedTasks((prev) => {
      const next = { ...prev, [taskId]: !prev[taskId] };
      writePersistedPrepChecks(next);
      return next;
    });
  };

  const resetPrepChecklist = () => {
    setCheckedTasks({});
    writePersistedPrepChecks({});
  };

  const savedHeirlooms = heirloomQuery.data ?? [];

  return (
    <div className="min-h-screen bg-tk-canvas text-tk-ink">
      <TopBar kitchen backTo="/recipes" />

      <main className="kitchen-page-body space-y-6">
        {/* ====================================================================
         * 1. OBSIDIAN HEARTH CINEMA HEADER
         * ==================================================================== */}
        <section
          aria-label="Xưởng ẩm thực gia truyền và sơ chế đầu tuần Takolio"
          className="tk-sanctuary-theme relative overflow-hidden rounded-[30px] border border-white/14 p-4 sm:p-6 lg:p-7 shadow-2xl"
        >
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <CulinaryCinemaStage
                videoSrc="/takolio/v5/videos/heirloom-atelier-loop.mp4"
                posterSrc="/takolio/v5/posters/heirloom-poster.webp"
                ariaLabel="Thước phim 35mm lưu giữ công thức gia truyền và nghệ thuật sơ chế bếp Việt"
                studioBadgeLabel="ATELIER · GIA TRUYỀN"
                liveLabel="ATELIER"
                ambientRimTone="amber"
                className="min-h-[235px] sm:min-h-[275px]"
              >
                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
                  <span className="tk-glass-dark rounded-full px-3 py-1 text-[11px] font-extrabold text-tk-turmeric-glow tk-tabular">
                    {savedHeirlooms.length} Công Thức Gia Truyền Đã Lưu
                  </span>
                  <span className="tk-glass-dark rounded-full px-3 py-1 text-[11px] font-extrabold text-tk-jade-mint tk-tabular">
                    Tiết kiệm ~{minutesSavedPerWeeknight}p / tối
                  </span>
                </div>
              </CulinaryCinemaStage>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <AtelierBadge tone="dark" icon={<MortarPestleIcon size={14} tone="cream" active />}>
                  CULINARY HERITAGE & PREP STUDIO
                </AtelierBadge>
                <span className="rounded-full border border-tk-turmeric/40 bg-tk-turmeric/20 px-2.5 py-1 text-[11px] font-extrabold text-tk-turmeric-glow">
                  35mm Noir & Hearth Edition
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-extrabold leading-[1.16] tracking-tight text-white">
                Gìn Giữ Vị Cơm Nhà Qua Nhiều Thế Hệ & Thảnh Thơi Suốt Năm Tối Đi Làm
              </h1>

              <p className="text-sm sm:text-base text-white/75 leading-relaxed">
                Ghi lại ký ức món mẹ nấu bằng vài dòng tự nhiên để AI chuẩn hóa thành công thức định lượng từng gam, canh lửa từng phút — hoặc mở kịch bản sơ chế Chủ Nhật 90 phút để cả tuần chỉ mất 15 phút đỏ lửa.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <SegmentedTabs<StudioMode>
                  layoutId="culinary-studio-mode-tabs"
                  dark
                  value={mode}
                  onChange={handleModeChange}
                  options={[
                    {
                      value: 'heirloom',
                      label: 'Sổ Tay Gia Truyền & AI',
                      icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
                      badge: savedHeirlooms.length > 0 ? savedHeirlooms.length : undefined,
                    },
                    {
                      value: 'batch_prep',
                      label: 'Xưởng Sơ Chế Đầu Tuần 90 Phút',
                      icon: <ChefKnifeBoardIcon size={16} tone="flame" active={mode === 'batch_prep'} />,
                      badge: `${completionPercent}%`,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
         * MODE 1 — SỔ TAY GIA TRUYỀN & AI KIẾN TRÚC CÔNG THỨC
         * ==================================================================== */}
        {mode === 'heirloom' && (
          <section aria-label="Sổ tay gia truyền và AI kiến trúc công thức" className="space-y-6">
            {saveToastMessage && (
              <BentoCard tone="jade" padding="sm" className="animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-tk-jade shrink-0" aria-hidden="true" />
                    <p className="text-sm font-extrabold text-tk-jade-deep">{saveToastMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaveToastMessage(null)}
                    className="text-xs font-bold text-tk-muted hover:text-tk-ink cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </BentoCard>
            )}

            <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
              {/* Left Column: AI Heirloom Composer */}
              <BentoCard tone="ceramic" padding="md" className="lg:col-span-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <AtelierBadge tone="flame" className="mb-2">
                      AI KIẾN TRÚC CÔNG THỨC GIA TRUYỀN
                    </AtelierBadge>
                    <h2 className="text-xl font-extrabold tracking-tight text-tk-ink">
                      Kể Lại Hương Vị Ký Ức Gia Đình Bạn
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-tk-secondary">
                      Nhập trí nhớ thô về nguyên liệu, cách kho/nấu hoặc bí quyết truyền miệng — AI sẽ chuẩn hóa thành quy trình 4 công đoạn chuẩn bếp Việt.
                    </p>
                  </div>
                  <AiSousChefSparkIcon size={30} tone="flame" active />
                </div>

                {/* 4 Clickable Inspiration Chips */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-tk-muted">
                    Gợi ý cảm hứng 1 chạm
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {HEIRLOOM_INSPIRATION_CHIPS.map((chip) => (
                      <button
                        key={chip.prompt}
                        type="button"
                        onClick={() => {
                          setRawMemoryPrompt(chip.prompt);
                          setSelectedRegion(chip.region);
                          setFamilyStoryInput(chip.storyHint);
                        }}
                        className={clsx(
                          'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer text-left',
                          rawMemoryPrompt === chip.prompt
                            ? 'border-tk-flame bg-tk-flame-soft text-tk-flame-deep'
                            : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:bg-tk-sunken hover:text-tk-ink',
                        )}
                      >
                        {chip.prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Raw Family Memory Textarea */}
                <div>
                  <label
                    htmlFor="heirloom-raw-memory"
                    className="block text-xs font-extrabold text-tk-ink mb-1.5"
                  >
                    Trí nhớ món ăn & cách nấu của gia đình
                  </label>
                  <textarea
                    id="heirloom-raw-memory"
                    rows={3}
                    value={rawMemoryPrompt}
                    onChange={(e) => setRawMemoryPrompt(e.target.value)}
                    placeholder="Ví dụ: Cá trắm kho riềng sả thịt ba chỉ kiểu mẹ nấu 50 phút, nước hàng cánh gián đậm đà…"
                    className="w-full rounded-2xl border border-tk-stone bg-tk-canvas/55 p-3.5 text-sm font-medium text-tk-ink placeholder:text-tk-muted focus:border-tk-flame focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Optional Family Story */}
                <div>
                  <label
                    htmlFor="heirloom-family-story"
                    className="block text-xs font-extrabold text-tk-ink mb-1.5"
                  >
                    Câu chuyện gia đình (tùy chọn)
                  </label>
                  <input
                    id="heirloom-family-story"
                    type="text"
                    value={familyStoryInput}
                    onChange={(e) => setFamilyStoryInput(e.target.value)}
                    placeholder="Món ngoại hay nấu mỗi chiều mưa tháng Chạp"
                    className="w-full rounded-2xl border border-tk-stone bg-white px-3.5 py-2.5 text-sm text-tk-ink placeholder:text-tk-muted focus:border-tk-flame focus:outline-none"
                  />
                </div>

                {/* Region & Servings Controls */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="block text-xs font-extrabold text-tk-ink mb-1.5">
                      Phong vị vùng miền
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {REGION_OPTIONS.map((reg) => {
                        const active = selectedRegion === reg.value;
                        return (
                          <button
                            key={reg.value}
                            type="button"
                            onClick={() => setSelectedRegion(reg.value)}
                            className={clsx(
                              'rounded-xl border py-2 text-xs font-extrabold transition-colors cursor-pointer',
                              active
                                ? 'border-tk-jade bg-tk-jade text-white shadow-xs'
                                : 'border-tk-stone bg-white text-tk-secondary hover:text-tk-ink',
                            )}
                          >
                            {reg.labelVi}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-extrabold text-tk-ink mb-1.5">
                      Khẩu phần gia đình (1–12 người)
                    </span>
                    <div className="flex items-center justify-between rounded-xl border border-tk-stone bg-white px-3 py-1.5">
                      <button
                        type="button"
                        aria-label="Giảm khẩu phần"
                        onClick={() => setServings((s) => Math.max(1, s - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-tk-canvas text-tk-ink hover:bg-tk-sunken cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="text-sm font-extrabold text-tk-ink tk-tabular">
                        {servings} người ăn
                      </span>
                      <button
                        type="button"
                        aria-label="Tăng khẩu phần"
                        onClick={() => setServings((s) => Math.min(12, s + 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-tk-canvas text-tk-ink hover:bg-tk-sunken cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                <ActionButton
                  variant="flame"
                  size="lg"
                  fullWidth
                  loading={synthesizeMutation.isPending}
                  disabled={!rawMemoryPrompt.trim()}
                  onClick={() => synthesizeMutation.mutate()}
                  icon={<Sparkles className="h-4.5 w-4.5" />}
                >
                  AI Chuẩn Hóa Thành Công Thức Chuẩn Bếp
                </ActionButton>
              </BentoCard>

              {/* Right Column: Live Synthesized Structured Blueprint Preview */}
              <div className="lg:col-span-6">
                {!synthesizedDraft ? (
                  <BentoCard
                    tone="sunken"
                    padding="lg"
                    className="flex min-h-[420px] flex-col items-center justify-center text-center border-dashed border-2 border-tk-stone"
                  >
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white shadow-xs">
                      <ClaypotBraiseIcon size={32} tone="turmeric" active />
                    </div>
                    <h3 className="text-lg font-extrabold text-tk-ink">
                      Bản Thiết Kế Công Thức 4 Công Đoạn Sẽ Hiện Tại Đây
                    </h3>
                    <p className="mt-2 max-w-md text-xs sm:text-sm text-tk-secondary">
                      Nhấn <strong>“AI Chuẩn Hóa Thành Công Thức Chuẩn Bếp”</strong> để tự động tính định lượng nguyên liệu theo {servings} khẩu phần, dụng cụ nồi chảo, mức lửa, bộ đếm phút và dấu hiệu nhận biết chín ngon.
                    </p>
                  </BentoCard>
                ) : (
                  <BentoCard tone="ceramic" padding="md" className="space-y-5 animate-slide-up">
                    {/* Draft Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tk-stone/70 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <AtelierBadge tone="turmeric">
                            {REGION_BADGE_LABELS[synthesizedDraft.region]}
                          </AtelierBadge>
                          <AtelierBadge tone="neutral" className="tk-tabular">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {synthesizedDraft.cookTimeMinutes} phút
                          </AtelierBadge>
                          <AtelierBadge tone="jade" className="tk-tabular">
                            {synthesizedDraft.caloriesPerServing} kcal · {synthesizedDraft.proteinGrams}g đạm
                          </AtelierBadge>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-tk-ink">
                          {synthesizedDraft.title}
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-tk-secondary">
                          {synthesizedDraft.description}
                        </p>
                      </div>
                    </div>

                    {/* Family Story Quote */}
                    {synthesizedDraft.familyStory && (
                      <div className="rounded-2xl bg-tk-turmeric-soft/65 border border-tk-turmeric/25 p-3.5 flex items-start gap-2.5">
                        <Quote className="h-4 w-4 shrink-0 text-tk-turmeric-deep mt-0.5" aria-hidden="true" />
                        <p className="text-xs sm:text-sm italic font-medium text-tk-ink">
                          “{synthesizedDraft.familyStory}”
                        </p>
                      </div>
                    )}

                    {/* Exact Scaled Ingredients */}
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-tk-secondary mb-2.5">
                        Nguyên liệu định lượng chuẩn ({synthesizedDraft.servings} khẩu phần)
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {synthesizedDraft.ingredients.map((ing, idx) => (
                          <div
                            key={`${ing.name}-${idx}`}
                            className="flex items-start justify-between gap-2 rounded-xl border border-tk-stone/70 bg-tk-canvas/50 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-tk-ink">{ing.name}</p>
                              {ing.note && (
                                <p className="text-[11px] text-tk-muted line-clamp-1">{ing.note}</p>
                              )}
                            </div>
                            <span className="shrink-0 font-extrabold text-tk-jade tk-tabular">
                              {ing.quantity} {ing.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4-Phase Steps */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                        Quy trình 4 công đoạn canh lửa & cảm quan
                      </h4>
                      {synthesizedDraft.steps.map((step) => (
                        <div
                          key={step.stepNumber}
                          className="rounded-2xl border border-tk-stone/75 bg-white p-3.5 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-extrabold text-tk-ink">
                              Bước {step.stepNumber} · {step.phaseTitleVi}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <AtelierBadge tone="flame">{step.heatLevel}</AtelierBadge>
                              <AtelierBadge tone="neutral" className="tk-tabular">
                                <MultiTimerIcon size={12} tone="ink" />
                                {step.durationMinutes}p
                              </AtelierBadge>
                            </div>
                          </div>
                          <p className="text-xs text-tk-secondary leading-relaxed">
                            {step.instruction}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                            <span className="font-bold text-tk-muted">
                              Dụng cụ: {step.cookware}
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold text-tk-jade-deep">
                              <SensoryAromaIcon size={13} tone="jade" active />
                              {step.sensoryCue}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chef Secret */}
                    <div className="rounded-2xl bg-tk-flame-soft/70 border border-tk-flame/25 p-3.5">
                      <p className="text-xs font-extrabold text-tk-flame-deep">
                        {synthesizedDraft.chefSecret}
                      </p>
                    </div>

                    {/* Save CTA */}
                    <ActionButton
                      variant="jade"
                      size="lg"
                      fullWidth
                      loading={saveHeirloomMutation.isPending}
                      onClick={() => saveHeirloomMutation.mutate(synthesizedDraft)}
                      icon={<BookOpen className="h-4.5 w-4.5" />}
                    >
                      Lưu Vào Sổ Tay Gia Đình
                    </ActionButton>
                  </BentoCard>
                )}
              </div>
            </div>

            {/* Saved Family Heirloom Gallery */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-tk-ink">
                    Tủ Sách Công Thức Gia Truyền Đã Lưu ({savedHeirlooms.length})
                  </h2>
                  <p className="text-xs sm:text-sm text-tk-secondary">
                    Di sản hương vị riêng của hộ gia đình bạn, sẵn sàng mở chế độ nấu rảnh tay bất cứ lúc nào.
                  </p>
                </div>
              </div>

              {savedHeirlooms.length === 0 ? (
                <BentoCard tone="ceramic" padding="md" className="text-center py-10">
                  <p className="text-sm font-bold text-tk-secondary">
                    Sổ tay gia đình chưa có món nào. Hãy chuẩn hóa và lưu công thức đầu tiên ở khung phía trên!
                  </p>
                </BentoCard>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {savedHeirlooms.map((recipe) => {
                    const artwork = resolveRecipeImageV4({
                      title: recipe.title,
                      cuisine: 'vietnamese',
                    });
                    const isExpanded = expandedRecipeId === recipe.id;
                    return (
                      <BentoCard
                        key={recipe.id}
                        tone="ceramic"
                        padding="none"
                        className="flex flex-col justify-between overflow-hidden"
                      >
                        <div>
                          {/* Dish Artwork Header */}
                          <div className="relative h-44 w-full overflow-hidden bg-tk-sanctuary">
                            <img
                              src={artwork.src}
                              alt={recipe.title}
                              loading="lazy"
                              onError={recipeImageErrorHandler(artwork.fallbackSrc)}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                              <AtelierBadge tone="turmeric">
                                {REGION_BADGE_LABELS[recipe.region]}
                              </AtelierBadge>
                              <AtelierBadge tone="dark" className="tk-tabular">
                                {recipe.cookTimeMinutes} phút · {recipe.servings} người
                              </AtelierBadge>
                            </div>
                            <button
                              type="button"
                              aria-label={`Xóa công thức ${recipe.title}`}
                              onClick={() => deleteHeirloomMutation.mutate(recipe.id)}
                              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/80 transition-colors hover:bg-tk-berry hover:text-white cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <div className="absolute inset-x-3.5 bottom-3">
                              <h3 className="text-lg font-extrabold text-white leading-snug line-clamp-2">
                                {recipe.title}
                              </h3>
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            {/* Family Story Quote */}
                            <div className="rounded-xl bg-tk-canvas/75 border border-tk-stone/70 p-3">
                              <p className="text-xs italic text-tk-secondary line-clamp-2">
                                “{recipe.familyStory}”
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-xs text-tk-muted tk-tabular">
                              <span>
                                {recipe.ingredients.length} nguyên liệu · {recipe.steps.length} bước
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedRecipeId(isExpanded ? null : recipe.id)
                                }
                                className="font-extrabold text-tk-jade hover:underline cursor-pointer"
                              >
                                {isExpanded ? 'Thu gọn bước nấu' : 'Xem nhanh nguyên liệu'}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="rounded-xl border border-tk-stone/70 bg-tk-canvas/40 p-3 space-y-1.5 text-xs animate-fade-in">
                                {recipe.ingredients.slice(0, 6).map((ing, i) => (
                                  <div key={i} className="flex justify-between gap-2">
                                    <span className="text-tk-ink font-medium">{ing.name}</span>
                                    <span className="font-bold text-tk-secondary tk-tabular">
                                      {ing.quantity} {ing.unit}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Primary Cook & Detail CTAs */}
                        <div className="border-t border-tk-stone/70 bg-tk-canvas/45 p-3.5 flex items-center gap-2">
                          <ActionButton
                            variant="flame"
                            size="sm"
                            to={`/cook/${encodeURIComponent(recipe.slug)}`}
                            icon={<Flame className="h-3.5 w-3.5" />}
                            className="flex-1"
                          >
                            Vào Bếp Nấu Ngay
                          </ActionButton>
                          <ActionButton
                            variant="ceramic"
                            size="sm"
                            to={`/recipes/${encodeURIComponent(recipe.slug)}`}
                            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
                          >
                            Xem chi tiết
                          </ActionButton>
                        </div>
                      </BentoCard>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ====================================================================
         * MODE 2 — XƯỞNG SƠ CHẾ ĐẦU TUẦN 90 PHÚT (SUNDAY BATCH-PREP STUDIO)
         * ==================================================================== */}
        {mode === 'batch_prep' && (
          <section aria-label="Xưởng sơ chế đầu tuần 90 phút" className="space-y-6">
            {/* Top Progress & Time-Saved Telemetry Bar */}
            <BentoCard tone="ceramic" padding="md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <RadialProgressRing
                    value={completionPercent}
                    size={62}
                    strokeWidth={6}
                    tone="flame"
                    label={`${completionPercent}%`}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-tk-ink">
                        Tiến Độ Mẻ Sơ Chế Chủ Nhật 90 Phút
                      </h2>
                      <AtelierBadge tone="jade" icon={<WokFlameIcon size={13} tone="jade" active />}>
                        Tiết kiệm ~{minutesSavedPerWeeknight} phút mỗi tối đi làm
                      </AtelierBadge>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-tk-secondary tk-tabular">
                      Đã hoàn thành <strong>{completedTaskCount}/{allTaskIds.length}</strong> hạng mục sơ chế cho{' '}
                      <strong>{selectedDishObjects.length}</strong> món chính trong tuần (tự động lưu tiến độ trên máy).
                    </p>
                  </div>
                </div>

                {completedTaskCount > 0 && (
                  <ActionButton
                    variant="sunken"
                    size="sm"
                    onClick={resetPrepChecklist}
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Làm mới mẻ tuần mới
                  </ActionButton>
                )}
              </div>

              {/* Horizontal Progress Bar */}
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-tk-sunken">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-tk-flame to-tk-jade transition-[width] duration-500"
                  style={{ width: `${Math.max(3, completionPercent)}%` }}
                />
              </div>
            </BentoCard>

            {/* Step 1: Candidate Weeknight Dish Selector (Toggle 2-6 dishes, first 3 pre-selected) */}
            <BentoCard tone="ceramic" padding="md" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-tk-flame">
                    BƯỚC 1 · CHỌN 2–6 MÓN CHO TUẦN NÀY
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-tk-ink">
                    Thực Đơn Mục Tiêu Để Tổng Hợp Dây Chuyền Sơ Chế
                  </h3>
                </div>
                <AtelierBadge tone="neutral" className="tk-tabular">
                  Đã chọn {selectedSlugs.length}/6 món
                </AtelierBadge>
              </div>

              {selectionHint && (
                <p className="rounded-xl bg-tk-turmeric-soft px-3 py-2 text-xs font-bold text-tk-turmeric-deep">
                  {selectionHint}
                </p>
              )}

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {candidateDishes.map((dish) => {
                  const selected = selectedSlugs.includes(dish.slug);
                  const img = resolveRecipeImageV4({
                    title: dish.title,
                    cuisine: 'vietnamese',
                    imageUrl: dish.imageUrl,
                  });
                  return (
                    <button
                      key={dish.slug}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleDishSelection(dish.slug)}
                      className={clsx(
                        'flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-tap cursor-pointer',
                        selected
                          ? 'border-tk-flame bg-tk-flame-soft/55 shadow-xs ring-1 ring-tk-flame/35'
                          : 'border-tk-stone/75 bg-tk-canvas/45 hover:bg-white',
                      )}
                    >
                      <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-xl bg-tk-sanctuary">
                        <img
                          src={img.src}
                          alt={dish.title}
                          loading="lazy"
                          onError={recipeImageErrorHandler(img.fallbackSrc)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs sm:text-sm font-extrabold text-tk-ink">
                          {dish.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-tk-muted tk-tabular">
                          <Utensils className="inline h-3 w-3 mr-1" aria-hidden="true" />
                          {dish.cookTimeMinutes} phút · {dish.servings} người
                        </p>
                      </div>
                      <div
                        className={clsx(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                          selected
                            ? 'border-tk-flame bg-tk-flame text-white'
                            : 'border-tk-stone bg-white text-transparent',
                        )}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </BentoCard>

            {/* Step 2: 4-Station Chronological Sunday Meal-Prep Blueprint */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade">
                    BƯỚC 2 · DÂY CHUYỀN 4 TRẠM THỜI GIAN THỰC
                  </span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-tk-ink">
                    Kịch Bản Sơ Chế Song Song Không Chồng Chéo Dụng Cụ
                  </h3>
                </div>
                <Link
                  to="/fridge"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-tk-jade hover:underline"
                >
                  <span>Đối chiếu Khoang Tủ Lạnh FEFO</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {stations.map((station) => {
                  const StationIcon = station.Icon;
                  const doneInStation = station.tasks.filter((t) => checkedTasks[t.id]).length;
                  return (
                    <BentoCard
                      key={station.stationNumber}
                      tone="ceramic"
                      padding="md"
                      className="space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-tk-stone/70 pb-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tk-sunken border border-tk-stone/80">
                            <StationIcon size={22} tone={station.tone} active />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <AtelierBadge tone={station.tone} className="tk-tabular">
                                {station.windowLabelVi}
                              </AtelierBadge>
                              <span className="text-[11px] font-extrabold text-tk-muted tk-tabular">
                                {doneInStation}/{station.tasks.length} hoàn tất
                              </span>
                            </div>
                            <h4 className="text-sm sm:text-base font-extrabold text-tk-ink leading-snug">
                              {station.titleVi}
                            </h4>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {station.tasks.map((task) => {
                          const checked = Boolean(checkedTasks[task.id]);
                          return (
                            <label
                              key={task.id}
                              className={clsx(
                                'flex items-start gap-3 rounded-2xl border p-3 transition-tap cursor-pointer select-none',
                                checked
                                  ? 'border-tk-jade/35 bg-tk-jade-soft/45'
                                  : 'border-tk-stone/70 bg-tk-canvas/45 hover:bg-white',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePrepTask(task.id)}
                                className="sr-only"
                              />
                              <span
                                aria-hidden="true"
                                className={clsx(
                                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                  checked
                                    ? 'border-tk-jade bg-tk-jade text-white'
                                    : 'border-tk-stone bg-white',
                                )}
                              >
                                {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={clsx(
                                    'block text-xs sm:text-sm font-extrabold leading-snug',
                                    checked ? 'line-through text-tk-muted' : 'text-tk-ink',
                                  )}
                                >
                                  {task.titleVi}
                                </span>
                                <span className="mt-1 block text-xs text-tk-secondary leading-relaxed">
                                  {task.detailVi}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-tk-muted border border-tk-stone/60 tk-tabular">
                                {task.durationMinutes}p
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </BentoCard>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CulinaryStudioPage;
