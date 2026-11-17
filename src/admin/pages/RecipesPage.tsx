import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecipes, useRecipesSummary } from '../api/hooks';
import { KeyCountList } from '../components/KeyCountList';
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, Section, type Tone } from '../components/ui';
import { vi } from '../i18n/vi';
import { formatNumber } from '../lib/format';
import { useDebouncedValue } from '../lib/hooks';

const PAGE_SIZE = 25;
const VERIFICATION_TONE: Record<string, Tone> = { unverified: 'neutral', reviewed: 'success', rejected: 'danger' };
const EDITORIAL_TONE: Record<string, Tone> = { draft: 'neutral', in_review: 'warning', approved: 'success', rejected: 'danger' };
const VERIFICATION_STATES = ['unverified', 'reviewed', 'rejected'] as const;

export function RecipesPage() {
  const summary = useRecipesSummary();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [cuisine, setCuisine] = useState('');
  const [verification, setVerification] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const recipes = useRecipes({
    q: search || undefined,
    cuisine: cuisine || undefined,
    verification: verification || undefined,
    source: source || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const resetPage = () => setPage(1);
  const hasFilters = searchInput !== '' || cuisine !== '' || verification !== '' || source !== '';
  const clearFilters = () => {
    setSearchInput('');
    setCuisine('');
    setVerification('');
    setSource('');
    setPage(1);
  };

  const data = summary.data;
  const mediaPct = data && data.total > 0 ? ((data.withReadyMedia / data.total) * 100).toFixed(1) : '0.0';

  return (
    <>
      <PageHeader
        eyebrow={vi.recipes.eyebrow}
        title={vi.recipes.title}
        description={vi.recipes.description}
        actions={data ? <Badge tone="brand">{formatNumber(data.total)} món</Badge> : undefined}
      />

      {summary.isPending ? <LoadingState rows={3} /> : null}
      {summary.isError ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}
      {data ? (
        <Section title={vi.recipes.summary} testId="admin-recipes-summary">
          <div className="metric-grid">
            <div className="card metric-card">
              <div className="metric-head">
                <h3>{vi.recipes.total}</h3>
              </div>
              <p className="metric-value">{data.total.toLocaleString('vi-VN')}</p>
            </div>
            <div className="card metric-card">
              <div className="metric-head">
                <h3>{vi.recipes.withMedia}</h3>
                <Badge tone="success">{mediaPct}%</Badge>
              </div>
              <p className="metric-value">{data.withReadyMedia.toLocaleString('vi-VN')}</p>
              <p className="metric-note">{vi.recipes.mediaCoverage(mediaPct)}</p>
            </div>
            <div className="card metric-card">
              <div className="metric-head">
                <h3>{vi.recipes.catalogMode}</h3>
              </div>
              <p className="metric-value metric-value-small mono">{data.catalogMode}</p>
            </div>
          </div>

          <div className="three-col">
            <div>
              <h3 className="subsection-title">{vi.recipes.byVerification}</h3>
              <KeyCountList
                items={data.byVerification.map((row) => ({ key: row.state, count: row.count }))}
                labelOf={(key) => vi.labels.verification[key] ?? key}
              />
            </div>
            <div>
              <h3 className="subsection-title">{vi.recipes.bySource}</h3>
              <KeyCountList items={data.bySource.map((row) => ({ key: row.sourceType, count: row.count }))} />
            </div>
            <div>
              <h3 className="subsection-title">{vi.recipes.editorialQueue}</h3>
              <KeyCountList
                items={data.editorialQueue.map((row) => ({ key: row.state, count: row.count }))}
                labelOf={(key) => (vi.labels.editorialState as Record<string, string>)[key] ?? key}
              />
            </div>
          </div>
        </Section>
      ) : null}

      <Section title={vi.recipes.listCaption}>
        <div className="toolbar">
          <Field label={vi.recipes.search} htmlFor="admin-recipes-search-input">
            <input
              id="admin-recipes-search-input"
              data-testid="admin-recipes-search"
              type="search"
              placeholder={vi.recipes.searchPlaceholder}
              maxLength={100}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value.slice(0, 100));
                resetPage();
              }}
            />
          </Field>
          <Field label={vi.recipes.cuisine} htmlFor="admin-recipes-cuisine">
            <select
              id="admin-recipes-cuisine"
              data-testid="admin-recipes-cuisine-filter"
              value={cuisine}
              onChange={(event) => {
                setCuisine(event.target.value);
                resetPage();
              }}
            >
              <option value="">{vi.common.all}</option>
              {(data?.byCuisine ?? []).map((row) => (
                <option key={row.cuisine} value={row.cuisine}>
                  {row.cuisine}
                </option>
              ))}
            </select>
          </Field>
          <Field label={vi.recipes.verification} htmlFor="admin-recipes-verification">
            <select
              id="admin-recipes-verification"
              data-testid="admin-recipes-verification-filter"
              value={verification}
              onChange={(event) => {
                setVerification(event.target.value);
                resetPage();
              }}
            >
              <option value="">{vi.common.all}</option>
              {VERIFICATION_STATES.map((value) => (
                <option key={value} value={value}>
                  {vi.labels.verification[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={vi.recipes.source} htmlFor="admin-recipes-source">
            <select
              id="admin-recipes-source"
              data-testid="admin-recipes-source-filter"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                resetPage();
              }}
            >
              <option value="">{vi.common.all}</option>
              {(data?.bySource ?? []).map((row) => (
                <option key={row.sourceType} value={row.sourceType}>
                  {row.sourceType}
                </option>
              ))}
            </select>
          </Field>
          {hasFilters ? (
            <div className="toolbar-actions">
              <Button variant="ghost" onClick={clearFilters}>
                {vi.common.clearFilters}
              </Button>
            </div>
          ) : null}
        </div>

        {recipes.isPending ? <LoadingState rows={5} /> : null}
        {recipes.isError ? <ErrorState error={recipes.error} onRetry={() => void recipes.refetch()} /> : null}
        {recipes.data && recipes.data.items.length === 0 ? <EmptyState /> : null}
        {recipes.data && recipes.data.items.length > 0 ? (
          <div
            className={recipes.isPlaceholderData ? 'table-wrap is-stale' : 'table-wrap'}
            aria-busy={recipes.isPlaceholderData || undefined}
            tabIndex={0}
            role="region"
            aria-label={vi.recipes.listCaption}
          >
            <table className="data-table">
              <caption className="sr-only">{vi.recipes.listCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{vi.recipes.columns.title}</th>
                  <th scope="col">{vi.recipes.columns.cuisine}</th>
                  <th scope="col">{vi.recipes.columns.difficulty}</th>
                  <th scope="col">{vi.recipes.columns.verification}</th>
                  <th scope="col">{vi.recipes.columns.source}</th>
                  <th scope="col">{vi.recipes.columns.version}</th>
                  <th scope="col">{vi.recipes.columns.media}</th>
                  <th scope="col">{vi.recipes.columns.editorial}</th>
                </tr>
              </thead>
              <tbody>
                {recipes.data.items.map((recipe) => (
                  <tr key={recipe.id} data-testid="admin-recipe-row">
                    <td>
                      <Link to={`/recipes/${encodeURIComponent(recipe.id)}`} className="row-link">
                        {recipe.title}
                      </Link>
                      <div className="cell-sub mono">
                        {recipe.slug} · {formatNumber(recipe.cookTimeMinutes)} {vi.recipes.minutes}
                      </div>
                    </td>
                    <td>{recipe.cuisine}</td>
                    <td>{recipe.difficulty}</td>
                    <td>
                      <Badge tone={VERIFICATION_TONE[recipe.verificationState] ?? 'neutral'}>
                        {vi.labels.verification[recipe.verificationState] ?? recipe.verificationState}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone="neutral">{recipe.sourceType}</Badge>
                    </td>
                    <td className="mono">v{recipe.version}</td>
                    <td>
                      <Badge tone={recipe.hasReadyMedia ? 'success' : 'warning'}>
                        {recipe.hasReadyMedia ? vi.recipes.mediaReady : vi.recipes.mediaMissing}
                      </Badge>
                    </td>
                    <td>
                      {recipe.latestEditorialState ? (
                        <Badge tone={EDITORIAL_TONE[recipe.latestEditorialState] ?? 'neutral'}>
                          {(vi.labels.editorialState as Record<string, string>)[recipe.latestEditorialState] ?? recipe.latestEditorialState}
                        </Badge>
                      ) : (
                        vi.common.dash
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {recipes.data ? (
          <Pagination page={recipes.data.page} pageSize={recipes.data.pageSize} total={recipes.data.total} onPageChange={setPage} />
        ) : null}
      </Section>
    </>
  );
}
