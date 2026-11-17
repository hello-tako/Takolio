import { useState } from 'react';
import { clsx } from 'clsx';
import { TAKOLIO_BRAND, type TakolioMascotPose } from '../../lib/takolio-brand';

/** Decorative V4 Terra-Botanical mascot illustration; adjacent task copy supplies accessible meaning. */
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
    <picture
      className={clsx(
        'tako-mascot inline-flex items-center justify-center select-none shrink-0',
        className,
      )}
      data-takolio-mascot={pose}
    >
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
        className="object-contain drop-shadow-xs"
        onError={() => setFailedPose(pose)}
      />
    </picture>
  );
}
