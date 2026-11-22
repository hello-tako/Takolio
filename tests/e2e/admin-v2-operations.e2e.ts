import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Local-Fixture-Only-2026!';
const SUPER = 'super@fixture.takosan.test';

async function login(page: Page, email = SUPER, password = PASSWORD) {
  await page.goto('/admin/login');
  await page.getByTestId('admin-login-email').fill(email);
  await page.getByTestId('admin-login-password').fill(password);
  await page.getByTestId('admin-login-submit').click();
  await expect(page).not.toHaveURL(/\/login/);
}

const consoleErrors: string[] = [];
test.beforeEach(async ({ page, request }) => {
  expect((await request.post('/__admin-preview/reset')).status()).toBe(204);
  consoleErrors.length = 0;
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});
test.afterEach(() => {
  expect(consoleErrors, 'uncaught page errors').toEqual([]);
});

test('Cmd+K Command Palette searches customer001 and UserDetailPage executes full user lifecycle (upgrade, suspend, unsuspend, cancel, delete)', async ({
  page,
}) => {
  await login(page);

  // Open Command Palette via trigger button, search customer001, navigate to /users/fx_user_001
  await page.getByTestId('admin-cmdk-trigger').click();
  const dialog = page.getByTestId('admin-cmdk-dialog');
  await expect(dialog).toBeVisible();
  await page.getByTestId('admin-cmdk-input').fill('customer001');

  const userOption = dialog.locator('.cmdk-item').filter({ hasText: 'Trần Linh' }).first();
  await expect(userOption).toBeVisible();
  await userOption.click();

  await expect(page).toHaveURL(/\/admin\/users\/fx_user_001$/);
  await expect(page.getByTestId('admin-user-detail')).toBeVisible();

  // 1. Upgrade Pro
  await page.getByTestId('admin-user-upgrade-btn').click();
  await expect(page.getByTestId('admin-user-upgrade-dialog')).toBeVisible();
  await page.getByTestId('admin-user-upgrade-reason').fill('E2E: Nâng cấp gói Takolio Pro cho khách hàng');
  await page.getByTestId('admin-user-upgrade-confirm').click();
  await expect(page.getByTestId('admin-user-action-notice')).toContainText('Takolio Pro');
  await expect(page.getByTestId('admin-user-detail')).toContainText('Takolio Pro');
  await expect(page.getByTestId('admin-user-detail')).toContainText('500 lượt');

  // 2. Suspend user -> verify 'Tạm khóa' badge
  await page.getByTestId('admin-user-suspend-btn').click();
  await expect(page.getByTestId('admin-user-suspend-dialog')).toBeVisible();
  await page.getByTestId('admin-user-suspend-reason').fill('E2E: Tạm khóa tài khoản kiểm thử');
  await page.getByTestId('admin-user-suspend-confirm').click();
  await expect(page.getByTestId('admin-user-account-status')).toContainText('Tạm khóa');

  // 3. Unsuspend user -> verify 'Hoạt động' badge
  await page.getByTestId('admin-user-unsuspend-btn').click();
  await expect(page.getByTestId('admin-user-unsuspend-dialog')).toBeVisible();
  await page.getByTestId('admin-user-unsuspend-reason').fill('E2E: Mở khóa tài khoản sau xác minh');
  await page.getByTestId('admin-user-unsuspend-confirm').click();
  await expect(page.getByTestId('admin-user-account-status')).toContainText('Hoạt động');

  // 4. Cancel Pro
  await page.getByTestId('admin-user-cancel-plan-btn').click();
  await expect(page.getByTestId('admin-user-cancel-plan-dialog')).toBeVisible();
  await page.getByTestId('admin-user-cancel-immediate').check();
  await page.getByTestId('admin-user-cancel-reason').fill('E2E: Hủy gói Takolio Pro ngay lập tức');
  await page.getByTestId('admin-user-cancel-plan-confirm').click();
  await expect(page.getByTestId('admin-user-action-notice')).toBeVisible();

  // 5. Delete user (anonymize)
  await page.getByTestId('admin-user-delete-btn').click();
  await expect(page.getByTestId('admin-user-delete-dialog')).toBeVisible();
  await expect(page.getByTestId('admin-user-delete-mode-anonymize')).toBeChecked();
  await page.getByTestId('admin-user-delete-confirm-word').fill('XOA');
  await page.getByTestId('admin-user-delete-reason').fill('E2E: Ẩn danh dữ liệu người dùng theo yêu cầu');
  await page.getByTestId('admin-user-delete-confirm').click();
  await expect(page.getByTestId('admin-user-account-status')).toContainText('Đã xóa');
});

test('Households, Billing, Recipes, AI OCR Queue, and System Operations workflows work end-to-end', async ({
  page,
}) => {
  await login(page);

  // 1. HouseholdsPage: open Household Drawer, verify inventory/meal/shopping stats & rename household
  await page.getByTestId('admin-nav-users').click();
  await page.getByTestId('admin-households-tab').click();
  await expect(page).toHaveURL(/\/admin\/households/);
  await expect(page.getByTestId('admin-household-row').first()).toBeVisible();
  await page.getByTestId('admin-household-detail-btn').first().click();

  const drawer = page.getByTestId('admin-household-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('Mặt hàng');
  await expect(drawer).toContainText('Lô thực phẩm');
  await expect(drawer).toContainText('Thực đơn đã lập');
  await expect(drawer).toContainText('Danh sách mua sắm');

  await page.getByTestId('admin-household-rename-input').fill('Bếp Gia Đình E2E');
  await page.getByTestId('admin-household-rename-reason').fill('E2E: Đổi tên hộ gia đình kiểm thử');
  await page.getByTestId('admin-household-rename-submit').click();
  await expect(drawer.getByRole('heading', { name: 'Bếp Gia Đình E2E' })).toBeVisible();
  await expect(page.getByTestId('admin-household-row').first()).toContainText('Bếp Gia Đình E2E');

  // Close drawer before navigating
  await drawer.getByRole('button', { name: 'Đóng' }).click();

  // 2. BillingPage: verify zero V1 readonly notice, mark a pending/exception transaction paid via dialog, see updated feedback & badge
  await page.getByTestId('admin-nav-billing').click();
  await expect(page).toHaveURL(/\/admin\/billing/);
  await expect(page.getByTestId('admin-billing-summary')).toBeVisible();
  await expect(page.getByTestId('admin-billing-readonly')).toHaveCount(0);

  const reconRow = page.getByTestId('admin-reconciliation-row').first();
  await expect(reconRow).toBeVisible();
  await reconRow.getByTestId('admin-tx-mark-paid').click();
  await expect(page.getByTestId('admin-billing-mark-paid-dialog')).toBeVisible();
  await page.getByTestId('admin-tx-reason-input').fill('E2E: Đã đối chiếu sao kê ngân hàng khớp lệnh');
  await page.getByTestId('admin-tx-mark-paid-confirm').click();
  await expect(page.getByTestId('admin-billing-feedback')).toContainText('Takolio Pro');

  // 3. RecipesPage / RecipeDetailPage: verify zero V1 publication notice, inspect ingredients/steps, edit metadata, verify canonical publication status
  await page.getByTestId('admin-nav-recipes').click();
  await expect(page).toHaveURL(/\/admin\/recipes/);
  await expect(page.getByTestId('admin-recipe-row').first()).toBeVisible();
  await page.getByTestId('admin-recipe-row').first().getByRole('link').first().click();
  await expect(page.getByTestId('admin-recipe-detail')).toBeVisible();
  await expect(page.getByTestId('admin-recipe-publication-notice')).toHaveCount(0);
  await expect(page.getByTestId('admin-recipe-verify-bar')).toBeVisible();

  // Inspect ingredients & steps sections
  await expect(page.getByRole('heading', { name: 'Danh sách nguyên liệu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Các bước thực hiện' })).toBeVisible();

  // Edit metadata
  await page.getByTestId('admin-recipe-edit-btn').click();
  await expect(page.getByTestId('admin-recipe-edit-dialog')).toBeVisible();
  await page.getByTestId('admin-recipe-edit-title').fill('Canh Chua Cá Lóc (E2E)');
  await page.getByTestId('admin-recipe-edit-reason').fill('E2E: Chuẩn hóa tiêu đề công thức');
  await page.getByTestId('admin-recipe-edit-submit').click();
  await expect(page.getByTestId('admin-recipe-feedback')).toBeVisible();
  await expect(page.getByTestId('admin-page-title')).toContainText('Canh Chua Cá Lóc (E2E)');

  // Set canonical verification status
  const verifyReviewedBtn = page.getByTestId('admin-recipe-verify-reviewed');
  if (await verifyReviewedBtn.isEnabled()) {
    await verifyReviewedBtn.click();
  } else {
    await page.getByTestId('admin-recipe-verify-rejected').click();
  }
  await expect(page.getByTestId('admin-recipe-verify-dialog')).toBeVisible();
  await page.getByTestId('admin-recipe-verify-reason').fill('E2E: Xác minh xuất bản công thức vào danh mục');
  await page.getByTestId('admin-recipe-verify-confirm').click();
  await expect(page.getByTestId('admin-recipe-feedback')).toContainText('trạng thái xác minh');

  // 4. AiPage: filter OCR scan jobs, trigger Retry on a failed job
  await page.getByTestId('admin-nav-ai').click();
  await expect(page).toHaveURL(/\/admin\/ai/);
  const scanJobsSection = page.getByTestId('admin-scan-jobs');
  await expect(scanJobsSection).toBeVisible();
  await scanJobsSection.getByRole('button', { name: 'Thất bại' }).click();
  await expect(page.getByTestId('admin-scan-job-row').first()).toBeVisible();
  await page.getByTestId('admin-scan-retry-btn').first().click();
  await expect(page.getByTestId('admin-scan-action-dialog')).toBeVisible();
  await page.getByTestId('admin-scan-action-reason').fill('E2E: Thử lại tác vụ quét OCR bị lỗi timeout');
  await page.getByTestId('admin-scan-action-confirm').click();
  await expect(page.getByTestId('admin-ai-feedback')).toContainText('thử lại');

  // 5. SystemPage: run System Hygiene and inspect result summary, send System Broadcast
  await page.getByTestId('admin-nav-system').click();
  await expect(page).toHaveURL(/\/admin\/system/);
  await expect(page.getByTestId('admin-system-ops')).toBeVisible();
  await page.getByTestId('admin-hygiene-run-btn').click();
  await expect(page.getByTestId('admin-hygiene-result')).toBeVisible();
  await expect(page.getByTestId('admin-hygiene-result')).toContainText('Đã hoàn tất dọn dẹp dữ liệu hệ thống.');

  await page.getByTestId('admin-broadcast-title').fill('Thông báo vận hành E2E');
  await page.getByTestId('admin-broadcast-message').fill('Hệ thống Takolio đã hoàn tất bảo trì định kỳ.');
  await page.getByTestId('admin-broadcast-reason').fill('E2E: Kiểm thử phát thông báo toàn hệ thống');
  await page.getByTestId('admin-broadcast-submit').click();
  await expect(page.getByTestId('admin-broadcast-success')).toContainText('Đã gửi thông báo thành công');
});
