import React from 'react';
import { TAKOLIO_BRAND } from '../../lib/takolio-brand';

export type TakosanIconName = keyof typeof TAKOLIO_BRAND.uiIcons;
export type TakosanNavV2IconName = keyof typeof TAKOLIO_BRAND.v2NavIcons;

interface TakosanIconProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'name' | 'title' | 'src' | 'alt' | 'onClick'> {
  name: TakosanIconName;
  strokeWidth?: number;
  onDark?: boolean;
  title?: string;
  variant?: 'v1' | 'v2';
  onClick?: React.MouseEventHandler<SVGSVGElement | HTMLImageElement>;
}

function isV2NavIcon(name: TakosanIconName): name is TakosanNavV2IconName {
  return Object.prototype.hasOwnProperty.call(TAKOLIO_BRAND.v2NavIcons, name);
}

/** Preserve V1 kit compatibility by default and render newly authored V2 24px vectors from TAKOLIO_BRAND.v2NavIcons when variant="v2". */
export const TakosanIcon: React.FC<TakosanIconProps> = ({
  name,
  strokeWidth,
  onDark,
  title,
  variant = 'v1',
  width = 24,
  height = 24,
  className,
  style,
  ...rest
}) => {
  if (variant === 'v2' && isV2NavIcon(name)) {
    const meta = TAKOLIO_BRAND.v2NavIcons[name];
    const svgRest = rest as unknown as React.SVGAttributes<SVGSVGElement>;
    return (
      <svg
        {...svgRest}
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="none"
        stroke={onDark ? '#FFFFFF' : 'currentColor'}
        strokeWidth={strokeWidth ?? 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={title ? 'img' : svgRest.role}
        aria-label={title || svgRest['aria-label']}
        aria-hidden={title || svgRest['aria-label'] ? undefined : (svgRest['aria-hidden'] ?? true)}
        className={className}
        data-takosan-icon={name}
        data-icon-id={meta.id}
        style={{ display: 'inline-block', flexShrink: 0, ...style }}
      >
        {title ? <title>{title}</title> : null}
        {meta.elements.map((el, idx) =>
          React.createElement(el.tag, { key: `${meta.id}-${idx}`, ...el.attrs }),
        )}
      </svg>
    );
  }
  void strokeWidth; // Existing V1 img callers retain this prop; the V1 kit owns stroke geometry.
  return <img
    {...rest}
    src={onDark && name === 'scan' ? TAKOLIO_BRAND.scanIconOnDark : TAKOLIO_BRAND.uiIcons[name]}
    alt={title ?? ''}
    aria-hidden={title ? undefined : true}
    width={width}
    height={height}
    className={className}
    data-takosan-icon={name}
    style={{ display: 'inline-block', flexShrink: 0, objectFit: 'contain', ...style }}
  />;
};
