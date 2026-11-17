import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdminEditorialState } from '@shared/admin';
import { isConflict } from '../lib/errors';
import { useMe, useRecipe, useReviewRecipe } from '../api/hooks';
import { Badge, Button, DefinitionList, ErrorState, Field, InlineError, LoadingState, Notice, PageHeader, Section, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatDateTime, formatNumber } from '../lib/format';
import { hasPermission } from '../lib/nav';

const EDITORIAL_STATES: readonly AdminEditorialState[] = ['draft', 'in_review', 'approved', 'rejected'];
const EDITORIAL_TONE: Record<string, Tone> = { draft: 'neutral', in_review: 'warning', approved: 'success', rejected: 'danger' };

const WORKFLOW_PIPELINE = ['draft', 'in_review', 'approved', 'published', 'archived'] as const;

function editorialLabel(state: string): string {
  return (vi.labels.editorialState as Record<string, string>)[state] ?? state;
}

function WorkflowStateMachine({
  latestState,
  canPublish,
}: {
  latestState: AdminEditorialState | null;
  canPublish: boolean;
}) {
  const effectiveStage = latestState === 'rejected' ? 'draft' : latestState ?? 'draft';
  const currentIdx = WORKFLOW_PIPELINE.indexOf(effectiveStage as (typeof WORKFLOW_PIPELINE)[number]);

  return (
    <Section title={vi.recipes.workflowTitle} description={vi.recipes.workflowSubtitle}>
      {latestState === 'rejected' ? (
        <Notice tone="danger">{vi.recipes.workflowRejectedNotice}</Notice>
      ) : null}
      <ol className="workflow-track">
        {WORKFLOW_PIPELINE.map((stage, index) => {
          const gated = (stage === 'published' || stage === 'archived') && !canPublish;
          const isCurrent = !gated && index === currentIdx && latestState !== 'rejected';
          const isDone = !gated && index < currentIdx && latestState !== 'rejected';
          const copy = vi.recipes.workflowStages[stage];
          return (
            <li
              key={stage}
              className={clsx(
                'workflow-step',
                isDone && 'is-done',
                isCurrent && 'is-current',
                gated && 'is-gated',
              )}
            >
              <div className="workflow-step-head">
                <span className="button-row" style={{ gap: '6px' }}>
                  <span className="workflow-step-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <strong>{copy.label}</strong>
                </span>
                {gated ? <Badge tone="neutral">{vi.recipes.workflowGatedBadge}</Badge> : null}
                {isCurrent ? <Badge tone="brand">Hiện tại</Badge> : null}
              </div>
              <span className="workflow-step-desc">{copy.desc}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function RecipeReviewForm({
  recipeId,
  recipeVersion,
  onReload,
}: {
  recipeId: string;
  recipeVersion: number;
  onReload: () => void;
}) {
  const review = useReviewRecipe(recipeId);
  const [state, setState] = useState<AdminEditorialState>('in_review');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    review.mutate(
      { state, note: note.trim(), recipeVersion: Number(formData.get('recipeVersion')) },
      {
        onSuccess: () => {
          setNote('');
          setSaved(true);
        },
      },
    );
  };

  return (
    <form className="review-form" data-testid="admin-recipe-review-form" onSubmit={onSubmit}>
      <input type="hidden" name="recipeVersion" value={recipeVersion} />
      <Field label={vi.recipes.reviewState} htmlFor="admin-recipe-review-state">
        <select
          id="admin-recipe-review-state"
          value={state}
          onChange={(event) => setState(event.target.value as AdminEditorialState)}
        >
          {EDITORIAL_STATES.map((value) => (
            <option key={value} value={value}>
              {editorialLabel(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={vi.recipes.reviewNote}
        htmlFor="admin-recipe-review-note"
        hint={`${vi.recipes.reviewNoteHint} (${note.length}/2000)`}
      >
        <textarea
          id="admin-recipe-review-note"
          data-testid="admin-recipe-review-note"
          rows={4}
          maxLength={2000}
          placeholder={vi.recipes.reviewNotePlaceholder}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      {isConflict(review.error) ? (
        <Notice tone="warning" title={vi.recipes.reviewConflict}>
          <Button onClick={onReload}>{vi.recipes.reloadRecipe}</Button>
        </Notice>
      ) : (
        <InlineError error={review.error} />
      )}
      {saved ? (
        <p className="form-success" role="status">
          {vi.recipes.reviewSaved}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" data-testid="admin-recipe-review-submit" disabled={review.isPending}>
          {review.isPending ? vi.recipes.reviewSubmitting : vi.recipes.reviewSubmit}
        </Button>
      </div>
    </form>
  );
}

export function RecipeDetailPage() {
  const { recipeId = '' } = useParams();
  const me = useMe();
  const canReview = hasPermission(me.data?.permissions ?? [], 'recipes.review');
  const recipe = useRecipe(recipeId);
  const data = recipe.data;

  return (
    <>
      <Link to="/recipes" className="back-link">
        {vi.common.backTo(vi.recipes.detailBack)}
      </Link>
      {recipe.isPending ? (
        <>
          <h1 data-testid="admin-page-title">{vi.recipes.title}</h1>
          <LoadingState rows={4} />
        </>
      ) : null}
      {recipe.isError ? (
        <>
          <h1 data-testid="admin-page-title">{vi.recipes.title}</h1>
          <ErrorState error={recipe.error} onRetry={() => void recipe.refetch()} />
        </>
      ) : null}
      {data ? (
        <>
          <PageHeader
            eyebrow={vi.recipes.detailEyebrow}
            title={data.title}
            description={data.description ?? undefined}
            actions={
              <>
                <Badge tone="neutral">v{data.version}</Badge>
                <Badge
                  tone={
                    data.verificationState === 'reviewed'
                      ? 'success'
                      : data.verificationState === 'rejected'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {vi.labels.verification[data.verificationState] ?? data.verificationState}
                </Badge>
                {data.latestEditorialState ? (
                  <Badge tone={EDITORIAL_TONE[data.latestEditorialState] ?? 'neutral'}>
                    {editorialLabel(data.latestEditorialState)}
                  </Badge>
                ) : null}
              </>
            }
          />

          <Notice tone="info" title={vi.recipes.publicationTitle} testId="admin-recipe-publication">
            {data.publication.note || vi.recipes.publicationNote}
          </Notice>

          <WorkflowStateMachine latestState={data.latestEditorialState} canPublish={data.publication.canPublish} />

          <div className="detail-grid" data-testid="admin-recipe-detail">
            <Section title={vi.recipes.provenance}>
              <DefinitionList
                items={[
                  { label: 'Slug', value: <span className="mono">{data.slug}</span> },
                  { label: vi.recipes.sourceType, value: <Badge tone="neutral">{data.sourceType}</Badge> },
                  { label: vi.recipes.sourceReference, value: data.sourceReference ?? vi.common.dash },
                  { label: vi.recipes.familyId, value: <span className="mono">{data.familyId ?? vi.common.dash}</span> },
                  {
                    label: vi.recipes.verificationState,
                    value: vi.labels.verification[data.verificationState] ?? data.verificationState,
                  },
                  { label: vi.recipes.version, value: `v${data.version}` },
                  { label: vi.recipes.columns.cuisine, value: data.cuisine },
                  { label: vi.recipes.columns.difficulty, value: data.difficulty },
                ]}
              />
            </Section>

            <Section title={vi.recipes.composition}>
              <DefinitionList
                items={[
                  { label: vi.recipes.ingredients, value: formatNumber(data.ingredientCount) },
                  { label: vi.recipes.steps, value: formatNumber(data.stepCount) },
                  {
                    label: vi.recipes.prepTime,
                    value:
                      data.prepTimeMinutes !== null
                        ? `${formatNumber(data.prepTimeMinutes)} ${vi.recipes.minutes}`
                        : vi.common.dash,
                  },
                  { label: vi.recipes.cookTime, value: `${formatNumber(data.cookTimeMinutes)} ${vi.recipes.minutes}` },
                  { label: vi.recipes.servings, value: formatNumber(data.servings) },
                  {
                    label: vi.recipes.tags,
                    value: data.tags.length ? (
                      <ul className="chip-list">
                        {data.tags.map((tag) => (
                          <li key={tag}>
                            <Badge tone="brand">{tag}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      vi.common.dash
                    ),
                  },
                ]}
              />
            </Section>
          </div>

          <Section title={vi.recipes.media}>
            {data.media.length === 0 ? (
              <p className="muted">{vi.recipes.mediaEmpty}</p>
            ) : (
              <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.recipes.media}>
                <table className="data-table">
                  <caption className="sr-only">{vi.recipes.media}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{vi.recipes.mediaColumns.role}</th>
                      <th scope="col">{vi.recipes.mediaColumns.version}</th>
                      <th scope="col">{vi.recipes.mediaColumns.status}</th>
                      <th scope="col">{vi.recipes.mediaColumns.source}</th>
                      <th scope="col">{vi.recipes.mediaColumns.mime}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.media.map((item, index) => (
                      <tr key={`${item.role}-${item.version}-${index}`}>
                        <td className="mono">{item.role}</td>
                        <td>v{item.version}</td>
                        <td>
                          <Badge tone={item.status === 'ready' ? 'success' : 'neutral'}>{item.status}</Badge>
                        </td>
                        <td>{item.sourceType ?? vi.common.dash}</td>
                        <td className="mono">{item.mimeType ?? vi.common.dash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={vi.recipes.reviews}>
            {data.editorialReviews.length === 0 ? (
              <p className="muted">{vi.recipes.reviewsEmpty}</p>
            ) : (
              <div className="table-wrap" tabIndex={0} role="region" aria-label={vi.recipes.reviews}>
                <table className="data-table">
                  <caption className="sr-only">{vi.recipes.reviews}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{vi.recipes.reviewColumns.time}</th>
                      <th scope="col">{vi.recipes.reviewColumns.state}</th>
                      <th scope="col">{vi.recipes.reviewColumns.note}</th>
                      <th scope="col">{vi.recipes.reviewColumns.author}</th>
                      <th scope="col">{vi.recipes.reviewColumns.version}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.editorialReviews.map((review) => (
                      <tr key={review.id}>
                        <td>{formatDateTime(review.createdAt)}</td>
                        <td>
                          <Badge tone={EDITORIAL_TONE[review.state] ?? 'neutral'}>{editorialLabel(review.state)}</Badge>
                        </td>
                        <td>{review.note}</td>
                        <td className="mono">{review.authorUserId}</td>
                        <td className="mono">v{review.recipeVersion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {canReview ? (
            <Section title={vi.recipes.reviewForm}>
              <RecipeReviewForm recipeId={data.id} recipeVersion={data.version} onReload={() => void recipe.refetch()} />
            </Section>
          ) : (
            <Notice tone="neutral">{vi.recipes.reviewNoPermission}</Notice>
          )}
        </>
      ) : null}
    </>
  );
}
