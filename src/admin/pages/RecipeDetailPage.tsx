import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  AdminEditorialState,
  AdminRecipeDetail,
  AdminRecipeMediaRole,
  AdminRecipeVerificationState,
} from '@shared/admin';
import {
  useMe,
  useRecipe,
  useRejectRecipeMedia,
  useReviewRecipe,
  useSetRecipeVerification,
  useUpdateRecipeMetadata,
} from '../api/hooks';
import { Dialog } from '../components/Dialog';
import {
  Badge,
  Button,
  DefinitionList,
  ErrorState,
  Field,
  InlineError,
  LoadingState,
  Notice,
  PageHeader,
  Section,
  type Tone,
} from '../components/ui';
import { vi } from '../i18n/vi';
import { isConflict } from '../lib/errors';
import { formatDateTime, formatNumber } from '../lib/format';
import { hasPermission } from '../lib/nav';

const EDITORIAL_STATES: readonly AdminEditorialState[] = ['draft', 'in_review', 'approved', 'rejected'];
const EDITORIAL_TONE: Record<string, Tone> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'success',
  rejected: 'danger',
};
const VERIFICATION_TONE: Record<AdminRecipeVerificationState, Tone> = {
  unverified: 'neutral',
  reviewed: 'success',
  rejected: 'danger',
};
const MEDIA_STATUS_TONE: Record<string, Tone> = {
  ready: 'success',
  pending: 'warning',
  rejected: 'danger',
  failed: 'danger',
};

function editorialLabel(state: string): string {
  return (vi.labels.editorialState as Record<string, string>)[state] ?? state;
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
      <h3>{vi.recipes.reviewForm}</h3>
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
      <Field label={vi.recipes.reviewNote} htmlFor="admin-recipe-review-note" hint={vi.recipes.reviewNoteHint}>
        <textarea
          id="admin-recipe-review-note"
          data-testid="admin-recipe-review-note"
          rows={4}
          maxLength={2000}
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
      <Button type="submit" variant="primary" data-testid="admin-recipe-review-submit" disabled={review.isPending}>
        {review.isPending ? vi.recipes.reviewSubmitting : vi.recipes.reviewSubmit}
      </Button>
    </form>
  );
}

export function RecipeDetailPage() {
  const { recipeId = '' } = useParams();
  const me = useMe();
  const permissions = me.data?.permissions ?? [];
  const canReview = hasPermission(permissions, 'recipes.review');
  const canWrite = hasPermission(permissions, 'recipes.write');
  const recipe = useRecipe(recipeId);
  const data = recipe.data;

  const setVerification = useSetRecipeVerification();
  const updateMetadata = useUpdateRecipeMetadata();
  const rejectMedia = useRejectRecipeMedia();

  const [verifyTarget, setVerifyTarget] = useState<AdminRecipeVerificationState | null>(null);
  const [verifyReason, setVerifyReason] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [cuisineDraft, setCuisineDraft] = useState('');
  const [difficultyDraft, setDifficultyDraft] = useState('easy');
  const [cookTimeDraft, setCookTimeDraft] = useState('15');
  const [prepTimeDraft, setPrepTimeDraft] = useState('');
  const [servingsDraft, setServingsDraft] = useState('2');
  const [tagsDraft, setTagsDraft] = useState('');
  const [editReason, setEditReason] = useState('');

  const [mediaRejectTarget, setMediaRejectTarget] = useState<{ role: AdminRecipeMediaRole; version: number } | null>(
    null,
  );
  const [mediaReason, setMediaReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const openVerifyModal = (nextState: AdminRecipeVerificationState) => {
    setVerification.reset();
    setVerifyReason('');
    setVerifyTarget(nextState);
  };

  const openEditModal = (current: AdminRecipeDetail) => {
    updateMetadata.reset();
    setTitleDraft(current.title);
    setDescriptionDraft(current.description ?? '');
    setCuisineDraft(current.cuisine);
    setDifficultyDraft(current.difficulty || 'easy');
    setCookTimeDraft(String(current.cookTimeMinutes));
    setPrepTimeDraft(current.prepTimeMinutes !== null ? String(current.prepTimeMinutes) : '');
    setServingsDraft(String(current.servings));
    setTagsDraft(current.tags.join(', '));
    setEditReason('');
    setEditOpen(true);
  };

  const openMediaRejectModal = (role: string, version: number) => {
    rejectMedia.reset();
    setMediaReason('');
    setMediaRejectTarget({
      role: (role === 'thumbnail' ? 'thumbnail' : 'hero') as AdminRecipeMediaRole,
      version,
    });
  };

  const onConfirmVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !verifyTarget || verifyReason.trim().length < 3) return;
    setVerification.mutate(
      {
        recipeId: data.id,
        verificationState: verifyTarget,
        recipeVersion: data.version,
        reason: verifyReason.trim(),
      },
      {
        onSuccess: () => {
          setFeedback(vi.recipes.verificationActions.success);
          setVerifyTarget(null);
        },
      },
    );
  };

  const onSubmitMetadata = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || editReason.trim().length < 3 || !titleDraft.trim() || !cuisineDraft.trim()) return;
    const tags = tagsDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    updateMetadata.mutate(
      {
        recipeId: data.id,
        title: titleDraft.trim(),
        description: descriptionDraft.trim() ? descriptionDraft.trim() : null,
        cuisine: cuisineDraft.trim(),
        difficulty: difficultyDraft,
        cookTimeMinutes: Math.max(0, Number(cookTimeDraft) || 0),
        prepTimeMinutes: prepTimeDraft.trim() ? Math.max(0, Number(prepTimeDraft) || 0) : null,
        servings: Math.max(1, Number(servingsDraft) || 1),
        tags,
        reason: editReason.trim(),
      },
      {
        onSuccess: () => {
          setFeedback(vi.recipes.edit.success);
          setEditOpen(false);
        },
      },
    );
  };

  const onConfirmRejectMedia = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !mediaRejectTarget || mediaReason.trim().length < 3) return;
    rejectMedia.mutate(
      {
        recipeId: data.id,
        role: mediaRejectTarget.role,
        version: mediaRejectTarget.version,
        reason: mediaReason.trim(),
      },
      {
        onSuccess: () => {
          setFeedback(vi.recipes.mediaActions.rejectSuccess);
          setMediaRejectTarget(null);
        },
      },
    );
  };

  const ingredients = data?.ingredients ?? [];
  const steps = data?.steps ?? [];

  return (
    <>
      <Link to="/recipes" className="back-link">
        {vi.recipes.detailBack}
      </Link>
      {recipe.isPending ? <LoadingState rows={4} /> : null}
      {recipe.isError ? <ErrorState error={recipe.error} onRetry={() => void recipe.refetch()} /> : null}
      {data ? (
        <>
          <PageHeader
            title={data.title}
            description={data.description ?? undefined}
            actions={
              <Badge tone={VERIFICATION_TONE[data.verificationState] ?? 'neutral'}>
                {vi.labels.verification[data.verificationState] ?? data.verificationState}
              </Badge>
            }
          />

          {feedback ? (
            <p className="form-success" role="status" data-testid="admin-recipe-feedback">
              {feedback}
            </p>
          ) : null}

          {canWrite ? (
            <Section
              title={vi.recipes.publicationTitle}
              description={vi.recipes.publicationBody}
              testId="admin-recipe-verify-bar"
            >
              <div className="action-bar button-row">
                <Button
                  variant={data.verificationState === 'reviewed' ? 'secondary' : 'primary'}
                  data-testid="admin-recipe-verify-reviewed"
                  disabled={data.verificationState === 'reviewed'}
                  onClick={() => openVerifyModal('reviewed')}
                >
                  Duyệt xuất bản
                </Button>
                <Button
                  variant="danger"
                  data-testid="admin-recipe-verify-rejected"
                  disabled={data.verificationState === 'rejected'}
                  onClick={() => openVerifyModal('rejected')}
                >
                  Từ chối
                </Button>
                <Button
                  variant="secondary"
                  data-testid="admin-recipe-verify-unverified"
                  disabled={data.verificationState === 'unverified'}
                  onClick={() => openVerifyModal('unverified')}
                >
                  Đặt chờ duyệt
                </Button>
                <Button
                  variant="secondary"
                  data-testid="admin-recipe-edit-btn"
                  onClick={() => openEditModal(data)}
                >
                  {vi.recipes.edit.button}
                </Button>
              </div>
            </Section>
          ) : null}

          <div className="detail-grid" data-testid="admin-recipe-detail">
            <Section title={vi.recipes.provenance}>
              <DefinitionList
                items={[
                  { label: vi.recipes.sourceType, value: data.sourceType },
                  { label: vi.recipes.sourceReference, value: data.sourceReference ?? vi.common.dash },
                  {
                    label: vi.recipes.verificationState,
                    value: vi.labels.verification[data.verificationState] ?? data.verificationState,
                  },
                  { label: vi.recipes.version, value: data.version },
                  { label: vi.recipes.columns.cuisine, value: data.cuisine },
                  {
                    label: vi.recipes.columns.difficulty,
                    value: vi.labels.difficulty[data.difficulty] ?? data.difficulty,
                  },
                ]}
              />
            </Section>
            <Section title={vi.recipes.composition}>
              <DefinitionList
                items={[
                  { label: vi.recipes.ingredients, value: formatNumber(data.ingredientCount) },
                  { label: vi.recipes.steps, value: formatNumber(data.stepCount) },
                  {
                    label: vi.recipes.cookTime,
                    value: `${formatNumber(data.cookTimeMinutes)} ${vi.recipes.minutes}`,
                  },
                  { label: vi.recipes.servings, value: formatNumber(data.servings) },
                  { label: vi.recipes.tags, value: data.tags.length ? data.tags.join(', ') : vi.common.dash },
                ]}
              />
            </Section>
          </div>

          <div className="two-col">
            <Section title={vi.recipes.ingredientsSection.title}>
              {ingredients.length === 0 ? (
                <p className="muted">{vi.recipes.ingredientsSection.empty}</p>
              ) : (
                <ul className="ingredient-list count-list" data-testid="admin-recipe-ingredients">
                  {ingredients.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.name}</strong>
                        {item.isOptional ? (
                          <span className="muted small"> ({vi.recipes.ingredientsSection.optional})</span>
                        ) : null}
                      </span>
                      <span className="mono">
                        {formatNumber(item.quantity)} {item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={vi.recipes.stepsSection.title}>
              {steps.length === 0 ? (
                <p className="muted">{vi.recipes.stepsSection.empty}</p>
              ) : (
                <ol className="step-list check-list" data-testid="admin-recipe-steps">
                  {steps.map((step) => (
                    <li key={step.stepNumber} className="check-item">
                      <div className="check-head">
                        <strong>{vi.recipes.stepsSection.stepNumber(step.stepNumber)}</strong>
                        {step.timerMinutes ? (
                          <Badge tone="info">{vi.recipes.stepsSection.timer(step.timerMinutes)}</Badge>
                        ) : null}
                      </div>
                      <p>{step.instruction}</p>
                      {step.tip ? (
                        <p className="muted small">
                          <strong>{vi.recipes.stepsSection.tip}:</strong> {step.tip}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
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
                      {canWrite ? <th scope="col">{vi.recipes.mediaColumns.action}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {data.media.map((item, index) => (
                      <tr key={`${item.role}-${item.version}-${index}`} data-testid="admin-recipe-media-row">
                        <td className="mono">{item.role}</td>
                        <td>v{item.version}</td>
                        <td>
                          <Badge tone={MEDIA_STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
                        </td>
                        <td>{item.sourceType ?? vi.common.dash}</td>
                        <td className="mono">{item.mimeType ?? vi.common.dash}</td>
                        {canWrite ? (
                          <td>
                            {item.status !== 'rejected' ? (
                              <Button
                                variant="danger"
                                className="btn-small"
                                data-testid="admin-recipe-media-reject"
                                onClick={() => openMediaRejectModal(item.role, item.version)}
                              >
                                Từ chối media
                              </Button>
                            ) : (
                              vi.common.dash
                            )}
                          </td>
                        ) : null}
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
                        <td>{review.recipeVersion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {canReview ? (
            <Section title={vi.recipes.reviewForm}>
              <RecipeReviewForm
                recipeId={data.id}
                recipeVersion={data.version}
                onReload={() => void recipe.refetch()}
              />
            </Section>
          ) : (
            <p className="muted">{vi.recipes.reviewNoPermission}</p>
          )}

          <Dialog
            open={verifyTarget !== null}
            title={vi.recipes.verificationActions.confirmTitle}
            onClose={() => setVerifyTarget(null)}
            testId="admin-recipe-verify-dialog"
            footer={
              <>
                <Button onClick={() => setVerifyTarget(null)}>{vi.common.cancel}</Button>
                <Button
                  type="submit"
                  form="admin-recipe-verify-form"
                  variant="primary"
                  data-testid="admin-recipe-verify-confirm"
                  disabled={setVerification.isPending || verifyReason.trim().length < 3}
                >
                  {setVerification.isPending ? vi.common.processing : vi.recipes.verificationActions.confirmButton}
                </Button>
              </>
            }
          >
            <form id="admin-recipe-verify-form" className="modal-form" onSubmit={onConfirmVerification}>
              <p className="muted">
                {vi.recipes.verificationActions.description}{' '}
                {verifyTarget ? <strong>({vi.labels.verification[verifyTarget]})</strong> : null}
              </p>
              <Field label={vi.recipes.verificationActions.reasonLabel} htmlFor="admin-recipe-verify-reason">
                <textarea
                  id="admin-recipe-verify-reason"
                  data-testid="admin-recipe-verify-reason"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder={vi.recipes.verificationActions.reasonPlaceholder}
                  value={verifyReason}
                  onChange={(event) => setVerifyReason(event.target.value)}
                />
              </Field>
              <InlineError error={setVerification.error} />
            </form>
          </Dialog>

          <Dialog
            open={editOpen}
            title={vi.recipes.edit.title}
            onClose={() => setEditOpen(false)}
            testId="admin-recipe-edit-dialog"
            footer={
              <>
                <Button onClick={() => setEditOpen(false)}>{vi.common.cancel}</Button>
                <Button
                  type="submit"
                  form="admin-recipe-edit-form"
                  variant="primary"
                  data-testid="admin-recipe-edit-submit"
                  disabled={updateMetadata.isPending || editReason.trim().length < 3 || !titleDraft.trim()}
                >
                  {updateMetadata.isPending ? vi.recipes.edit.submitting : vi.recipes.edit.submit}
                </Button>
              </>
            }
          >
            <form id="admin-recipe-edit-form" className="modal-form" onSubmit={onSubmitMetadata}>
              <Field label={vi.recipes.edit.fieldTitle} htmlFor="admin-recipe-edit-title">
                <input
                  id="admin-recipe-edit-title"
                  data-testid="admin-recipe-edit-title"
                  type="text"
                  required
                  maxLength={200}
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                />
              </Field>
              <Field label={vi.recipes.edit.fieldDescription} htmlFor="admin-recipe-edit-description">
                <textarea
                  id="admin-recipe-edit-description"
                  rows={2}
                  maxLength={1000}
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                />
              </Field>
              <div className="two-col">
                <Field label={vi.recipes.edit.fieldCuisine} htmlFor="admin-recipe-edit-cuisine">
                  <input
                    id="admin-recipe-edit-cuisine"
                    type="text"
                    required
                    maxLength={80}
                    value={cuisineDraft}
                    onChange={(event) => setCuisineDraft(event.target.value)}
                  />
                </Field>
                <Field label={vi.recipes.edit.fieldDifficulty} htmlFor="admin-recipe-edit-difficulty">
                  <select
                    id="admin-recipe-edit-difficulty"
                    value={difficultyDraft}
                    onChange={(event) => setDifficultyDraft(event.target.value)}
                  >
                    <option value="easy">{vi.labels.difficulty.easy}</option>
                    <option value="medium">{vi.labels.difficulty.medium}</option>
                    <option value="hard">{vi.labels.difficulty.hard}</option>
                  </select>
                </Field>
              </div>
              <div className="three-col">
                <Field label={vi.recipes.edit.fieldCookTime} htmlFor="admin-recipe-edit-cook-time">
                  <input
                    id="admin-recipe-edit-cook-time"
                    type="number"
                    min={0}
                    max={1440}
                    required
                    value={cookTimeDraft}
                    onChange={(event) => setCookTimeDraft(event.target.value)}
                  />
                </Field>
                <Field label={vi.recipes.edit.fieldPrepTime} htmlFor="admin-recipe-edit-prep-time">
                  <input
                    id="admin-recipe-edit-prep-time"
                    type="number"
                    min={0}
                    max={1440}
                    value={prepTimeDraft}
                    onChange={(event) => setPrepTimeDraft(event.target.value)}
                  />
                </Field>
                <Field label={vi.recipes.edit.fieldServings} htmlFor="admin-recipe-edit-servings">
                  <input
                    id="admin-recipe-edit-servings"
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={servingsDraft}
                    onChange={(event) => setServingsDraft(event.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={vi.recipes.edit.fieldTags}
                htmlFor="admin-recipe-edit-tags"
                hint={vi.recipes.edit.fieldTagsHint}
              >
                <input
                  id="admin-recipe-edit-tags"
                  type="text"
                  maxLength={300}
                  value={tagsDraft}
                  onChange={(event) => setTagsDraft(event.target.value)}
                />
              </Field>
              <Field label={vi.recipes.edit.reasonLabel} htmlFor="admin-recipe-edit-reason">
                <textarea
                  id="admin-recipe-edit-reason"
                  data-testid="admin-recipe-edit-reason"
                  rows={2}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder={vi.recipes.edit.reasonPlaceholder}
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                />
              </Field>
              <InlineError error={updateMetadata.error} />
            </form>
          </Dialog>

          <Dialog
            open={mediaRejectTarget !== null}
            title={vi.recipes.mediaActions.rejectTitle}
            onClose={() => setMediaRejectTarget(null)}
            testId="admin-recipe-media-reject-dialog"
            footer={
              <>
                <Button onClick={() => setMediaRejectTarget(null)}>{vi.common.cancel}</Button>
                <Button
                  type="submit"
                  form="admin-recipe-media-reject-form"
                  variant="danger"
                  data-testid="admin-recipe-media-reject-confirm"
                  disabled={rejectMedia.isPending || mediaReason.trim().length < 3}
                >
                  {rejectMedia.isPending ? vi.common.processing : vi.recipes.mediaActions.rejectConfirm}
                </Button>
              </>
            }
          >
            <form id="admin-recipe-media-reject-form" className="modal-form" onSubmit={onConfirmRejectMedia}>
              {mediaRejectTarget ? (
                <p className="muted">
                  {vi.recipes.mediaActions.rejectDescription(mediaRejectTarget.role, mediaRejectTarget.version)}
                </p>
              ) : null}
              <Field label={vi.recipes.mediaActions.reasonLabel} htmlFor="admin-recipe-media-reject-reason">
                <textarea
                  id="admin-recipe-media-reject-reason"
                  data-testid="admin-recipe-media-reject-reason"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder={vi.recipes.mediaActions.reasonPlaceholder}
                  value={mediaReason}
                  onChange={(event) => setMediaReason(event.target.value)}
                />
              </Field>
              <InlineError error={rejectMedia.error} />
            </form>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
