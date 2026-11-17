import React, { useId } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';

interface AuthFieldProps {
  label: string;
  icon: LucideIcon;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
  /** Optional password reveal toggle rendered inside the field. */
  reveal?: { show: boolean; onToggle: () => void };
}

/** Shared V4 Atelier auth input field (real labels, >=44px targets, crisp focus ring). */
export const AuthField: React.FC<AuthFieldProps> = ({
  label,
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  required = true,
  autoComplete,
  reveal,
}) => {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-bold text-tk-secondary mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-tk-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          id={id}
          name={type === 'email' ? 'email' : type === 'password' ? 'password' : 'displayName'}
          spellCheck={type === 'email' ? false : undefined}
          type={reveal?.show ? 'text' : type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={
            autoComplete ??
            (type === 'email' ? 'email' : type === 'password' ? 'current-password' : 'name')
          }
          className={`w-full h-12 pl-10.5 bg-tk-canvas/60 border border-tk-stone focus:bg-white focus:border-tk-jade rounded-2xl focus:outline-none focus:ring-3 focus:ring-tk-jade/20 text-sm font-semibold text-tk-ink shadow-xs transition-colors ${
            reveal ? 'pr-11' : 'pr-4'
          }`}
        />
        {reveal && (
          <button
            type="button"
            onClick={reveal.onToggle}
            aria-label={reveal.show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={reveal.show}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-tk-muted hover:text-tk-ink rounded-xl p-2 tap-target inline-flex items-center justify-center cursor-pointer transition-colors"
          >
            {reveal.show ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
