import { Button } from '../../components/common/Button';
import { PlannerError } from './PlannerShell';
import { plannerCopy, type PlannerLocale } from './copy';
import { compositionCopy, usePlanCompositions } from './composition';

export function CompositionLoadState({
  query,
  locale,
  missing = false,
}: {
  query: ReturnType<typeof usePlanCompositions>;
  locale: PlannerLocale;
  missing?: boolean;
}) {
  if (query.isError) {
    return (
      <PlannerError
        error={query.error}
        locale={locale}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-tk-stone bg-tk-sunken/70 px-4 py-3 text-sm font-semibold text-tk-secondary"
      >
        {compositionCopy[locale].loadingDishes}
      </p>
    );
  }
  if (!missing) return null;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-4 text-sm text-tk-berry-deep"
    >
      <p className="font-semibold">{compositionCopy[locale].loadFailed}</p>
      <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>
        {plannerCopy[locale].retry}
      </Button>
    </div>
  );
}
