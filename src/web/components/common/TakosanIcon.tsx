import React from 'react';
import { TAKOLIO_BRAND } from '../../lib/takolio-brand';

export type TakosanIconName = keyof typeof TAKOLIO_BRAND.uiIcons;
interface TakosanIconProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'name' | 'title' | 'src' | 'alt'> {
  name: TakosanIconName;
  strokeWidth?: number;
  onDark?: boolean;
  title?: string;
}

/** Preserve the kit's interior strokes and support fills at its native 24px size. */
export const TakosanIcon: React.FC<TakosanIconProps> = ({ name, strokeWidth, onDark, title, className, style, ...rest }) => {
  void strokeWidth; // Existing callers retain this prop; the kit owns stroke geometry.
  return <img
    src={onDark && name === 'scan' ? TAKOLIO_BRAND.scanIconOnDark : TAKOLIO_BRAND.uiIcons[name]}
    alt={title ?? ''}
    aria-hidden={title ? undefined : true}
    width={24}
    height={24}
    className={className}
    data-takosan-icon={name}
    style={{ display: 'inline-block', flexShrink: 0, objectFit: 'contain', ...style }}
    {...rest}
  />;
};
