import React from 'react';

export type VNextIconName =
  | 'home'
  | 'fridge'
  | 'recipes'
  | 'calendar'
  | 'profile'
  | 'scan'
  | 'shopping'
  | 'timer'
  | 'history'
  | 'notification'
  | 'search'
  | 'filter'
  | 'plus'
  | 'minus'
  | 'check'
  | 'close'
  | 'chevron-right'
  | 'arrow-left'
  | 'arrow-right'
  | 'edit'
  | 'trash'
  | 'swap'
  | 'sparkles'
  | 'mic'
  | 'volume'
  | 'bookmark'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'shield'
  | 'users'
  | 'crown'
  | 'settings'
  | 'privacy'
  | 'help'
  | 'offline'
  | 'refresh'
  | 'warning'
  | 'error'
  | 'success'
  | 'info'
  | 'download'
  | 'cat-vegetable'
  | 'cat-meat'
  | 'cat-seafood'
  | 'cat-egg'
  | 'cat-dairy'
  | 'cat-grain'
  | 'cat-spice'
  | 'cat-fruit'
  | 'cat-soup'
  | 'cat-braise';

export const VNEXT_ICON_LABELS_VI: Record<VNextIconName, string> = {
  home: 'Hôm nay',
  fridge: 'Tủ lạnh',
  recipes: 'Món ăn',
  calendar: 'Thực đơn',
  profile: 'Tài khoản',
  scan: 'Quét nguyên liệu',
  shopping: 'Đi chợ',
  timer: 'Hẹn giờ',
  history: 'Lịch sử',
  notification: 'Thông báo',
  search: 'Tìm kiếm',
  filter: 'Bộ lọc',
  plus: 'Thêm',
  minus: 'Giảm',
  check: 'Xác nhận',
  close: 'Đóng',
  'chevron-right': 'Mở chi tiết',
  'arrow-left': 'Quay lại',
  'arrow-right': 'Tiếp theo',
  edit: 'Chỉnh sửa',
  trash: 'Xóa',
  swap: 'Đổi món',
  sparkles: 'Gợi ý thông minh',
  mic: 'Giọng nói',
  volume: 'Đọc to',
  bookmark: 'Lưu món',
  mail: 'Email',
  lock: 'Mật khẩu',
  eye: 'Hiện mật khẩu',
  'eye-off': 'Ẩn mật khẩu',
  shield: 'Bảo mật hộ gia đình',
  users: 'Thành viên hộ',
  crown: 'Takolio Plus',
  settings: 'Cài đặt',
  privacy: 'Quyền riêng tư',
  help: 'Trợ giúp',
  offline: 'Ngoại tuyến',
  refresh: 'Tải lại',
  warning: 'Cần lưu ý',
  error: 'Lỗi',
  success: 'Hoàn tất',
  info: 'Thông tin',
  download: 'Cài đặt ứng dụng',
  'cat-vegetable': 'Rau củ',
  'cat-meat': 'Thịt',
  'cat-seafood': 'Hải sản',
  'cat-egg': 'Trứng',
  'cat-dairy': 'Sữa & phô mai',
  'cat-grain': 'Tinh bột',
  'cat-spice': 'Gia vị',
  'cat-fruit': 'Trái cây',
  'cat-soup': 'Món canh',
  'cat-braise': 'Món kho',
};

const renderIconGeometry = (name: VNextIconName): React.ReactNode => {
  switch (name) {
    case 'home':
      return (
        <>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </>
      );
    case 'fridge':
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.5" />
          <path d="M5 10h14" />
          <path d="M8.5 6.5v2" />
          <path d="M8.5 13v3.5" />
        </>
      );
    case 'recipes':
      return (
        <>
          <path d="M4 11h16a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7Z" />
          <path d="M8 21h8" />
          <path d="M9 4c0 1.5 1.5 2 1.5 3.5" />
          <path d="M14.5 4c0 1.5 1.5 2 1.5 3.5" />
        </>
      );
    case 'calendar':
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
          <path d="M3.5 9.5h17" />
          <path d="M8 3v3" />
          <path d="M16 3v3" />
          <circle cx="8.5" cy="13.5" r="1" />
          <circle cx="12" cy="13.5" r="1" />
          <circle cx="15.5" cy="13.5" r="1" />
        </>
      );
    case 'profile':
      return (
        <>
          <circle cx="12" cy="8" r="3.75" />
          <path d="M5 20c1.4-3.6 4.1-5.5 7-5.5s5.6 1.9 7 5.5" />
        </>
      );
    case 'scan':
      return (
        <>
          <path d="M4 8V6a2 2 0 0 1 2-2h2" />
          <path d="M16 4h2a2 2 0 0 1 2 2v2" />
          <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
          <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3.25" />
        </>
      );
    case 'shopping':
      return (
        <>
          <path d="M5 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H8.4a2 2 0 0 1-2-1.6L4.5 4H2.5" />
          <circle cx="9" cy="20" r="1.25" />
          <circle cx="16" cy="20" r="1.25" />
        </>
      );
    case 'timer':
      return (
        <>
          <circle cx="12" cy="13" r="7.5" />
          <path d="M10 3h4" />
          <path d="M12 13l3-2.5" />
          <path d="M18.5 6.5l1.5-1.5" />
        </>
      );
    case 'history':
      return (
        <>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.3-5.8L3.5 8.5" />
          <path d="M3.5 4v4.5H8" />
          <path d="M12 8v4.5l3 1.8" />
        </>
      );
    case 'notification':
      return (
        <>
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5h-15s2-1.5 2-6.5Z" />
          <path d="M10 19a2.2 2.2 0 0 0 4 0" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </>
      );
    case 'filter':
      return (
        <>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </>
      );
    case 'plus':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case 'minus':
      return <path d="M5 12h14" />;
    case 'check':
      return <path d="M5 12.5l4.5 4.5L19 7.5" />;
    case 'close':
      return (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      );
    case 'chevron-right':
      return <path d="M9 6l6 6-6 6" />;
    case 'arrow-left':
      return (
        <>
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </>
      );
    case 'arrow-right':
      return (
        <>
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </>
      );
    case 'edit':
      return (
        <>
          <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
          <path d="M13.5 6.5l4 4" />
        </>
      );
    case 'trash':
      return (
        <>
          <path d="M4.5 6.5h15" />
          <path d="M9.5 6.5V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
          <path d="M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-13" />
        </>
      );
    case 'swap':
      return (
        <>
          <path d="M7 7h12l-3-3" />
          <path d="M17 17H5l3 3" />
        </>
      );
    case 'sparkles':
      return (
        <>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
          <path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
        </>
      );
    case 'mic':
      return (
        <>
          <rect x="9" y="3.5" width="6" height="10" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21" />
        </>
      );
    case 'volume':
      return (
        <>
          <path d="M5 9.5h3.5L13 5.5v13l-4.5-4H5v-5Z" />
          <path d="M16.5 9a4.5 4.5 0 0 1 0 6" />
          <path d="M19 6.5a8 8 0 0 1 0 11" />
        </>
      );
    case 'bookmark':
      return <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-4-6.5 4V5.5a1 1 0 0 1 1-1Z" />;
    case 'mail':
      return (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="M4.5 7l7.5 5.5L19.5 7" />
        </>
      );
    case 'lock':
      return (
        <>
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </>
      );
    case 'eye':
      return (
        <>
          <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.75" />
        </>
      );
    case 'eye-off':
      return (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-3.4 4.1" />
          <path d="M6.3 6.5C3.9 8.3 2.5 12 2.5 12S6 18 12 18c1.7 0 3.2-.5 4.5-1.2" />
        </>
      );
    case 'shield':
      return (
        <>
          <path d="M12 3l7.5 3v5.5c0 4.8-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.7-7.5-9.5V6L12 3Z" />
          <path d="M9 12l2 2 4-4" />
        </>
      );
    case 'users':
      return (
        <>
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.5 19.5c1.1-2.9 3.1-4.5 5.5-4.5s4.4 1.6 5.5 4.5" />
          <circle cx="16.5" cy="9.5" r="2.25" />
          <path d="M16.5 15c1.9 0 3.4 1.2 4.2 3.5" />
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M4 18h16l1.5-10-5 3.5L12 5 7.5 11.5 2.5 8 4 18Z" />
          <path d="M5 20.5h14" />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.5 1.5M16.5 16.5L18 18M18 6l-1.5 1.5M7.5 16.5L6 18" />
        </>
      );
    case 'privacy':
      return (
        <>
          <path d="M12 3.5l7 2.8v5.4c0 4.5-2.9 7.8-7 9.3-4.1-1.5-7-4.8-7-9.3V6.3l7-2.8Z" />
          <circle cx="12" cy="11.5" r="2" />
          <path d="M12 13.5v2.5" />
        </>
      );
    case 'help':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.1.8-1.1 1.7" />
          <circle cx="12" cy="16.8" r="0.8" />
        </>
      );
    case 'offline':
      return (
        <>
          <path d="M3 3l18 18" />
          <path d="M8.5 5.6A11 11 0 0 1 12 5c3.8 0 7.2 1.6 9.5 4.2" />
          <path d="M5 8.2a11 11 0 0 0-2.5 1" />
          <path d="M8.5 12.2a6.5 6.5 0 0 1 7.8.4" />
          <circle cx="12" cy="18" r="1.2" />
        </>
      );
    case 'refresh':
      return (
        <>
          <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
          <path d="M20 20v-4h-4" />
        </>
      );
    case 'warning':
      return (
        <>
          <path d="M12 4L3 19.5h18L12 4Z" />
          <path d="M12 10v4.2" />
          <circle cx="12" cy="16.8" r="0.8" />
        </>
      );
    case 'error':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9 9l6 6" />
          <path d="M15 9l-6 6" />
        </>
      );
    case 'success':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 12.3l2.4 2.4 4.8-4.9" />
        </>
      );
    case 'info':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5" />
          <circle cx="12" cy="8" r="0.8" />
        </>
      );
    case 'download':
      return (
        <>
          <path d="M12 4v11" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4.5 18.5h15" />
        </>
      );
    case 'cat-vegetable':
      return (
        <>
          <path d="M19 5c-6 0-11 3.5-12.5 9.5L5 19l4.5-1.5C15.5 16 19 11 19 5Z" />
          <path d="M5 19l7.5-7.5" />
        </>
      );
    case 'cat-meat':
      return (
        <>
          <path d="M7.5 6.5c3.8-2.5 9.5-1.5 11.5 2.2 2 3.8-.5 9.3-5.2 10.8-4.7 1.5-9.3-1.5-9.8-5.8-.4-3.3 1.2-5.7 3.5-7.2Z" />
          <circle cx="14" cy="10.5" r="2" />
        </>
      );
    case 'cat-seafood':
      return (
        <>
          <path d="M3.5 12c3.2-4 7.8-5.5 13-4.5 1.5 2.5 1.5 6.5 0 9-5.2 1-9.8-.5-13-4.5Z" />
          <path d="M16.5 12l4-3v6l-4-3Z" />
          <circle cx="12.5" cy="11" r="0.9" />
        </>
      );
    case 'cat-egg':
      return <path d="M12 4c-3.8 0-6.5 5.2-6.5 9.5a6.5 6.5 0 0 0 13 0C18.5 9.2 15.8 4 12 4Z" />;
    case 'cat-dairy':
      return (
        <>
          <path d="M8 4h8l1.5 4v11a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V8L8 4Z" />
          <path d="M6.5 9h11" />
        </>
      );
    case 'cat-grain':
      return (
        <>
          <path d="M12 20V6" />
          <path d="M12 9c-2.5-.5-4-2.2-4-4.5 2.3 0 4 1.7 4 4.5Z" />
          <path d="M12 9c2.5-.5 4-2.2 4-4.5-2.3 0-4 1.7-4 4.5Z" />
          <path d="M12 14c-2.5-.5-4-2.2-4-4.5 2.3 0 4 1.7 4 4.5Z" />
          <path d="M12 14c2.5-.5 4-2.2 4-4.5-2.3 0-4 1.7-4 4.5Z" />
        </>
      );
    case 'cat-spice':
      return (
        <>
          <path d="M9 4h6" />
          <path d="M8.5 4l-1 4h9l-1-4" />
          <rect x="7" y="8" width="10" height="12" rx="2" />
          <path d="M10 13h4" />
        </>
      );
    case 'cat-fruit':
      return (
        <>
          <path d="M12 7c-3.8-.8-7 1.8-7 6 0 4.2 3 7.5 7 7.5s7-3.3 7-7.5c0-4.2-3.2-6.8-7-6Z" />
          <path d="M12 7c0-2 1.2-3.5 3-4" />
        </>
      );
    case 'cat-soup':
      return (
        <>
          <path d="M3.5 12h17a8.5 8.5 0 0 1-17 0Z" />
          <path d="M8 20.5h8" />
          <path d="M9 6.5c0 1.2 1.2 1.6 1.2 2.8" />
          <path d="M14 6.5c0 1.2 1.2 1.6 1.2 2.8" />
        </>
      );
    case 'cat-braise':
      return (
        <>
          <rect x="4.5" y="9" width="15" height="9.5" rx="3" />
          <path d="M3 11.5h1.5M19.5 11.5H21" />
          <path d="M4.5 9h15" />
          <path d="M9.5 6.5h5" />
        </>
      );
  }
};

export interface VNextIconProps {
  name: VNextIconName;
  size?: 16 | 20 | 24 | 32 | number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export const VNextIcon: React.FC<VNextIconProps> = ({
  name,
  size = 24,
  strokeWidth = 2,
  className,
  label,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    {renderIconGeometry(name)}
  </svg>
);

export const ALL_VNEXT_ICON_NAMES = Object.keys(VNEXT_ICON_LABELS_VI) as VNextIconName[];
