import { useState } from 'react';
import { TAKOLIO_BRAND, type TakolioMascotPose } from '../../lib/takolio-brand';

/** Decorative illustration; adjacent task copy supplies its accessible meaning. */
export function TakoMascot({
  pose = 'wave',
  size = 128,
  className = '',
}: {
  pose?: TakolioMascotPose;
  size?: number;
  className?: string;
}) {
  const [failedPose, setFailedPose] = useState<TakolioMascotPose | null>(null);
  const render = TAKOLIO_BRAND.mascotRenders[pose];
  return (
    <picture className={`tako-mascot ${className}`} data-takolio-mascot={pose}>
      {size >= 96 && failedPose !== pose && (
        <source
          type="image/webp"
          srcSet={`${render.small} 256w, ${render.standard} 512w, ${render.large} 1024w`}
          sizes={`${size}px`}
        />
      )}
      <img
        src={TAKOLIO_BRAND.mascot[pose]}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        decoding="async"
        onError={() => setFailedPose(pose)}
      />
    </picture>
  );
}
