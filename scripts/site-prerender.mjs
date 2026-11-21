#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_SITE = path.join(REPO_ROOT, 'dist/site');
const TEMPLATE_PATH = path.join(DIST_SITE, 'site/index.html');

const MARKETING_ORIGIN = 'https://takolio.com';
const APP_ORIGIN = 'https://takolio.app';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ORG_WEBAPP_GRAPH = [
  {
    '@type': 'Organization',
    '@id': `${MARKETING_ORIGIN}/#organization`,
    name: 'Takolio',
    url: MARKETING_ORIGIN,
    sameAs: [APP_ORIGIN],
    logo: {
      '@type': 'ImageObject',
      url: `${MARKETING_ORIGIN}/takolio/vnext/pwa/pwa-icon-512.png`,
      width: 512,
      height: 512,
    },
  },
  {
    '@type': 'WebSite',
    '@id': `${MARKETING_ORIGIN}/#website`,
    url: MARKETING_ORIGIN,
    name: 'Takolio — Trợ lý căn bếp thông minh cho gia đình hiện đại',
    inLanguage: 'vi-VN',
    publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${APP_ORIGIN}/recipes?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@type': 'WebApplication',
    '@id': `${APP_ORIGIN}/#webapp`,
    name: 'Takolio Kitchen Studio',
    url: APP_ORIGIN,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    inLanguage: 'vi-VN',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
    },
  },
];

function breadcrumb(name, routePath) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Takolio', item: `${MARKETING_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name, item: `${MARKETING_ORIGIN}${routePath}` },
    ],
  };
}

const ROUTES = [
  {
    path: '/',
    title: 'Hôm nay ăn gì? Để Takolio giúp bạn · Takolio',
    h1: 'Hôm nay ăn gì? Để Takolio giúp bạn.',
    description:
      'Quản lý thực phẩm trong tủ lạnh, chọn món ngon khớp định lượng, lên thực đơn tuần và đi chợ thông minh cho gia đình hiện đại.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Quản lý tủ lạnh theo lô nguyên liệu, phân biệt hạn in bao bì và hạn ước tính.',
      'Nhận diện nguyên liệu và hóa đơn bằng AI với nguyên tắc bắt buộc duyệt trước khi lưu.',
      'Đối chiếu công thức món Việt theo đúng gram, ml, quả/cái cho 1–20 người ăn.',
      'Lập thực đơn tuần 7 ngày, tính danh sách đi chợ ròng và hướng dẫn nấu từng bước.',
    ],
    jsonLd: { '@context': 'https://schema.org', '@graph': ORG_WEBAPP_GRAPH },
  },
  {
    path: '/how-it-works',
    title: 'Takolio hoạt động thế nào · Takolio',
    h1: 'Takolio hoạt động thế nào',
    description:
      'Từ những gì có sẵn trong tủ đến bữa ăn hoàn chỉnh với vòng lặp căn bếp khép kín 4 bước trên Takolio.',
    ogImage: '/takolio/vnext/marketing/m02-closed-loop-kitchen.webp',
    highlights: [
      'Nhập kho minh bạch bằng tay hoặc AI Scan có kiểm duyệt thủ công.',
      'Đối chiếu công thức theo đơn vị đo lường chuẩn.',
      'Lập lịch tuần 7 ngày và tổng hợp danh sách đi chợ trừ tồn kho.',
      'Đứng bếp có hẹn giờ và chỉ trừ tồn kho một lần khi bạn xác nhận hoàn thành.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Takolio hoạt động thế nào', '/how-it-works') },
  },
  {
    path: '/features/ai-scan',
    title: 'AI Scan nguyên liệu · Takolio',
    h1: 'AI Scan nguyên liệu',
    description:
      'Chụp ảnh tủ lạnh hoặc hóa đơn siêu thị rồi kiểm tra từng nguyên liệu trước khi lưu vào tủ lạnh thông minh.',
    ogImage: '/takolio/vnext/marketing/m03-fresh-produce-scan.webp',
    highlights: [
      'Hỗ trợ chụp ảnh thực phẩm hoặc hóa đơn kèm lối nhập tay thay thế.',
      'Hiển thị độ tin cậy từng dòng và giữ nguyên bằng chứng OCR gốc.',
      'Review-before-save bắt buộc: không bao giờ tự ghi thẳng vào kho khi bạn chưa xác nhận.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('AI Scan nguyên liệu', '/features/ai-scan') },
  },
  {
    path: '/features/fridge',
    title: 'Tủ lạnh thông minh · Takolio',
    h1: 'Tủ lạnh thông minh',
    description:
      'Biết nhà còn gì, sắp hết hạn gì và cần dùng gì trước với quản lý tồn kho theo lô và kiểm soát phiên bản dữ liệu.',
    ogImage: '/takolio/vnext/marketing/m04-smart-fridge.webp',
    highlights: [
      'Phân loại ngăn mát, ngăn đông, tủ khô và nhóm nguyên liệu rõ ràng.',
      'Ưu tiên nguyên liệu nên dùng sớm (FEFO) và gắn nhãn rõ mốc hạn ước tính.',
      'Kiểm soát phiên bản If-Match giúp tránh ghi đè nhầm giữa các thiết bị.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Tủ lạnh thông minh', '/features/fridge') },
  },
  {
    path: '/features/meal-planning',
    title: 'Lên thực đơn tuần · Takolio',
    h1: 'Lên thực đơn tuần',
    description:
      'Chủ động kế hoạch bữa ăn 7 ngày, nhân chia khẩu phần chính xác và tự động tính nguyên liệu còn thiếu.',
    ogImage: '/takolio/vnext/marketing/m05-meal-planning-prep.webp',
    highlights: [
      'Lịch ăn 7 ngày linh hoạt bữa sáng, trưa, tối theo thời gian đứng bếp thực tế.',
      'Xem trước thay đổi nguyên liệu trước khi đổi món trong lịch.',
      'Tính toán định lượng tất định trên máy chủ, không dùng AI suy đoán số lượng.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Lên thực đơn tuần', '/features/meal-planning') },
  },
  {
    path: '/features/recipes',
    title: 'Kho công thức · Takolio',
    h1: 'Kho công thức',
    description:
      'Tìm món cơm nhà Việt Nam theo nguyên liệu sẵn có trong tủ lạnh, thời gian nấu và khẩu phần 1–20 người.',
    ogImage: '/takolio/vnext/marketing/m06-vietnamese-recipes.webp',
    highlights: [
      'Tuyển chọn món kho, canh, xào, bún phở quen thuộc chuẩn định lượng.',
      'Tăng giảm khẩu phần từ 1 đến 20 người tức thì.',
      'Chỉ thêm đúng phần nguyên liệu còn thiếu vào danh sách đi chợ.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Kho công thức', '/features/recipes') },
  },
  {
    path: '/features/cooking',
    title: 'Nấu ăn từng bước · Takolio',
    h1: 'Nấu ăn từng bước',
    description:
      'Không gian đứng bếp sáng thoáng, chữ lớn dễ đọc từ xa với bộ hẹn giờ từng công đoạn và giữ sáng màn hình.',
    ogImage: '/takolio/vnext/marketing/m07-guided-cooking.webp',
    highlights: [
      'Rà soát nguyên liệu ở bước chuẩn bị sơ chế trước khi bật bếp.',
      'Bộ hẹn giờ đếm ngược theo từng bước nấu kèm đọc hướng dẫn giọng nói.',
      'Chỉ trừ tồn kho sau khi bạn xác nhận hoàn thành bữa ăn.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Nấu ăn từng bước', '/features/cooking') },
  },
  {
    path: '/features/shopping',
    title: 'Danh sách đi chợ · Takolio',
    h1: 'Danh sách đi chợ',
    description:
      'Chỉ mua đúng phần còn thiếu sau khi đối chiếu tồn kho, hỗ trợ đánh dấu ngoại tuyến và duyệt nhập kho chống trùng.',
    ogImage: '/takolio/vnext/marketing/m08-smart-shopping-basket.webp',
    highlights: [
      'Nhóm nguyên liệu cần mua theo khu vực quầy kệ.',
      'Hoạt động mượt khi ngoại tuyến với hàng đợi đồng bộ minh bạch.',
      'Duyệt nhập kho sau buổi chợ an toàn, không nhân đôi số lượng.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Danh sách đi chợ', '/features/shopping') },
  },
  {
    path: '/pricing',
    title: 'Các gói Takolio · Takolio',
    h1: 'Các gói Takolio',
    description:
      'Bắt đầu miễn phí trọn đời với tính năng cốt lõi hoặc nâng cấp Takolio Pro với biểu phí VND đồng bộ trực tiếp từ máy chủ.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Gói Miễn phí (0 VND): quản lý tủ lạnh, kho công thức, nấu từng bước và danh sách đi chợ.',
      'Gói Takolio Pro: mở rộng hạn mức AI Scan và lập thực đơn tuần chuyên sâu.',
      'Biểu phí VND đọc trực tiếp từ máy chủ chính thức, không hiển thị giá giả định.',
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb('Các gói Takolio', '/pricing'),
        {
          '@type': 'SoftwareApplication',
          name: 'Takolio',
          url: APP_ORIGIN,
          applicationCategory: 'LifestyleApplication',
          operatingSystem: 'Web, iOS, Android',
          offers: [
            {
              '@type': 'Offer',
              name: 'Takolio Miễn phí',
              price: 0,
              priceCurrency: 'VND',
              url: `${APP_ORIGIN}/auth?mode=register`,
            },
          ],
        },
      ],
    },
  },
  {
    path: '/faq',
    title: 'Câu hỏi thường gặp · Takolio',
    h1: 'Câu hỏi thường gặp',
    description:
      'Giải đáp minh bạch về cách hoạt động, kiểm duyệt AI Scan, quyền riêng tư hộ gia đình và gói Takolio Pro.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Takolio có gói Miễn phí đầy đủ vòng lặp quản lý tủ lạnh, món ăn và đi chợ.',
      'Mọi kết quả AI Scan đều bắt buộc qua bước kiểm duyệt của người dùng trước khi lưu.',
      'Dữ liệu tồn kho và thực đơn được phân tách nghiêm ngặt theo từng hộ gia đình.',
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumb('Câu hỏi thường gặp', '/faq'),
        {
          '@type': 'FAQPage',
          inLanguage: 'vi-VN',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Takolio có miễn phí không?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Có. Bạn có thể sử dụng miễn phí các tính năng cốt lõi gồm quản lý tủ lạnh theo lô, kho công thức món Việt, chế độ nấu từng bước và danh sách đi chợ.',
              },
            },
            {
              '@type': 'Question',
              name: 'AI nhận diện có chính xác tuyệt đối không?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Không. Takolio áp dụng nguyên tắc bắt buộc duyệt trước khi lưu: AI chỉ đề xuất bản nháp, còn bạn là người kiểm tra và xác nhận cuối cùng.',
              },
            },
            {
              '@type': 'Question',
              name: 'Dữ liệu cá nhân được bảo vệ ra sao?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Dữ liệu tồn kho, lịch sử quét, thực đơn và giỏ đi chợ được cô lập theo mã hộ gia đình (household_id) trên tầng máy chủ.',
              },
            },
          ],
        },
      ],
    },
  },
  {
    path: '/stories',
    title: 'Takolio Stories — Cẩm nang căn bếp gia đình · Takolio',
    h1: 'Takolio Stories',
    description:
      'Cẩm nang nấu ăn tối bận rộn, bảo quản rau tươi giòn, sơ chế gia vị Việt và xoay vòng tủ lạnh chống lãng phí.',
    ogImage: '/takolio/vnext/stories/story-01-weeknight-dinner.webp',
    highlights: [
      '5 món ăn nhanh cho tối bận rộn dưới 25 phút.',
      'Bảo quản rau ăn lá và gia vị thơm tươi lâu trong ngăn mát.',
      'Quy tắc xoay vòng FEFO chống lãng phí và bí quyết kho tộ nồi đất.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Takolio Stories', '/stories') },
  },
  {
    path: '/about',
    title: 'Giới thiệu · Liên hệ · Pháp lý · Takolio',
    h1: 'Giới thiệu · Liên hệ · Pháp lý',
    description: 'Giới thiệu về sứ mệnh căn bếp gia đình và kiến trúc dữ liệu minh bạch của Takolio.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Triết lý Nắng Bếp Gốm Sứ: giảm lãng phí thực phẩm, bớt áp lực nghĩ món mỗi chiều.',
      'Tách biệt rõ cổng nội dung công khai takolio.com và ứng dụng bếp riêng tư takolio.app.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Giới thiệu Takolio', '/about') },
  },
  {
    path: '/contact',
    title: 'Liên hệ Takolio · Takolio',
    h1: 'Liên hệ Takolio',
    description: 'Hướng dẫn hỗ trợ tự phục vụ, kiểm tra phiên và đối soát thanh toán minh bạch trên Takolio.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Tra cứu trạng thái lệnh VietQR trực tiếp tại mục Takolio Pro (/plus).',
      'Kiểm tra hàng đợi đồng bộ ngoại tuyến tại Cài đặt ứng dụng.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Liên hệ Takolio', '/contact') },
  },
  {
    path: '/privacy',
    title: 'Chính sách bảo mật · Takolio',
    h1: 'Chính sách bảo mật',
    description:
      'Nguyên tắc phân tách dữ liệu theo hộ gia đình, xử lý ảnh quét AI và bảo vệ phiên đăng nhập trên Takolio.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Cô lập dữ liệu theo household_id ở tầng máy chủ.',
      'Xác thực bằng cookie HttpOnly trên takolio.app và dọn sạch bộ nhớ tạm khi đăng xuất.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Chính sách bảo mật', '/privacy') },
  },
  {
    path: '/terms',
    title: 'Điều khoản sử dụng · Takolio',
    h1: 'Điều khoản sử dụng',
    description:
      'Quy định sử dụng dịch vụ, trách nhiệm kiểm duyệt kết quả AI và điều khoản tài khoản Takolio.',
    ogImage: '/takolio/vnext/social/og-1200x630.webp',
    highlights: [
      'Nhãn hạn dùng ước tính và gợi ý AI mang tính hỗ trợ; người dùng luôn kiểm tra thực phẩm trước khi nấu.',
      'Chỉ hiển thị thông tin dinh dưỡng cho các công thức đã xác minh nguồn.',
    ],
    jsonLd: { '@context': 'https://schema.org', ...breadcrumb('Điều khoản sử dụng', '/terms') },
  },
];

function renderHeadTags(route, noindex = false) {
  const canonicalUrl = `${MARKETING_ORIGIN}${route.path}`;
  const ogImageUrl = `${MARKETING_ORIGIN}${route.ogImage}`;
  const robots = noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const ldScript = route.jsonLd
    ? `<script type="application/ld+json" data-tkv-seo-ld="1">${JSON.stringify(route.jsonLd)}</script>`
    : '';

  return [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<link rel="alternate" hreflang="vi-VN" href="${canonicalUrl}" />`,
    `<link rel="alternate" hreflang="x-default" href="${canonicalUrl}" />`,
    `<meta property="og:site_name" content="Takolio" />`,
    `<meta property="og:locale" content="vi_VN" />`,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:type" content="${route.path === '/stories' ? 'article' : 'website'}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(route.h1)} — Takolio" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
    ldScript,
  ]
    .filter(Boolean)
    .join('\n    ');
}

function renderSemanticBody(route) {
  const items = route.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
  return `<main id="tkv-public-main" class="max-w-[1120px] mx-auto px-6 py-12">
      <header class="mb-8 flex items-center justify-between gap-4">
        <a href="/"><strong>Takolio</strong></a>
        <nav aria-label="Liên kết trang chính">
          <a href="/how-it-works">Cách hoạt động</a> ·
          <a href="/features/ai-scan">AI Scan</a> ·
          <a href="/features/fridge">Tủ lạnh</a> ·
          <a href="/features/recipes">Công thức</a> ·
          <a href="/pricing">Bảng giá</a> ·
          <a href="/faq">FAQ</a> ·
          <a href="/stories">Stories</a> ·
          <a href="${APP_ORIGIN}/auth?mode=login">Mở ứng dụng (takolio.app)</a>
        </nav>
      </header>
      <article>
        <h1>${escapeHtml(route.h1)}</h1>
        <p>${escapeHtml(route.description)}</p>
        <ul>${items}</ul>
        <p><a href="${APP_ORIGIN}/auth?mode=guest">Bắt đầu miễn phí trên Takolio App</a></p>
      </article>
    </main>`;
}

if (!existsSync(TEMPLATE_PATH)) {
  throw new Error(`Missing built site template at ${TEMPLATE_PATH}. Run "vite build -c vite.site.config.ts" first.`);
}

const baseHtml = readFileSync(TEMPLATE_PATH, 'utf8');

// Copy static SEO/GEO & media files (excluding app Service Worker sw.js & _headers)
for (const rootDoc of ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt']) {
  const src = path.join(REPO_ROOT, 'public', rootDoc);
  if (existsSync(src)) {
    cpSync(src, path.join(DIST_SITE, rootDoc));
  }
}
cpSync(path.join(REPO_ROOT, 'public/takolio'), path.join(DIST_SITE, 'takolio'), { recursive: true });

// Emit pre-rendered static HTML for all 15 canonical satellite routes
for (const route of ROUTES) {
  const html = baseHtml
    .replace('<!--TAKOLIO_HEAD_SEO-->', renderHeadTags(route, false))
    .replace('<!--TAKOLIO_SSR_OUTLET-->', renderSemanticBody(route));

  const outFile =
    route.path === '/'
      ? path.join(DIST_SITE, 'index.html')
      : path.join(DIST_SITE, route.path.slice(1), 'index.html');
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');
}

// Emit 404.html with noindex
const notFoundHtml = baseHtml
  .replace(
    '<!--TAKOLIO_HEAD_SEO-->',
    renderHeadTags(
      {
        path: '/404',
        title: 'Không tìm thấy trang · Takolio',
        h1: 'Không tìm thấy trang',
        description: 'Đường dẫn bạn truy cập không tồn tại trên cổng thông tin Takolio.',
        ogImage: '/takolio/vnext/social/og-1200x630.webp',
        highlights: ['Quay về trang chủ giới thiệu Takolio hoặc mở ứng dụng tại takolio.app.'],
        jsonLd: null,
      },
      true,
    ),
  )
  .replace(
    '<!--TAKOLIO_SSR_OUTLET-->',
    `<main class="max-w-xl mx-auto px-6 py-16"><h1>Không tìm thấy trang</h1><p><a href="/">Về trang chủ Takolio</a></p></main>`,
  );
writeFileSync(path.join(DIST_SITE, '404.html'), notFoundHtml, 'utf8');

// Remove intermediate `dist/site/site` directory
rmSync(path.join(DIST_SITE, 'site'), { recursive: true, force: true });

console.log(
  JSON.stringify({
    status: 'OK',
    outDir: 'dist/site',
    prerenderedRoutes: ROUTES.length,
    seoDocs: ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt'],
  }),
);
