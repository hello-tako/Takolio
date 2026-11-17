import { vi } from '../i18n/vi';

/** Geometric Takolio V4 Control Tower emblem (architectural beacon + botanical leaf core). */
export function TakolioEmblem({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5L20.2 7.25V16.75L12 21.5L3.8 16.75V7.25L12 2.5Z"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.8C14.8 6.8 16.8 9.1 16.8 12C16.8 14.9 14.8 17.2 12 17.2C9.2 17.2 7.2 14.9 7.2 12C7.2 9.1 9.2 6.8 12 6.8Z"
        fill="rgba(255,255,255,0.16)"
      />
      <circle cx="12" cy="12" r="3.1" fill="#E5533D" />
      <path d="M12 5.2V8.2M12 15.8V18.8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup({ collapsed = false, className = 'brand' }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={className}>
      <span className="brand-mark" aria-hidden="true">
        <TakolioEmblem size={22} />
      </span>
      {collapsed ? (
        <span className="sr-only">{vi.appName}</span>
      ) : (
        <span className="brand-copy">
          <span className="brand-name">{vi.appName}</span>
          <span className="brand-subtitle">{vi.appSubtitle}</span>
        </span>
      )}
    </div>
  );
}
