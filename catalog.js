/**
 * 영림 웹 카탈로그 (GitHub Pages 연동 버전)
 */

const CONFIG = {
    // 카테고리별 분할 PDF (73MB → 탭별 1~3MB)
    categoryPdfs: {
        '문틀': 'https://kangho-jun.github.io/YL_cadalog/doorframe.pdf',
        '몰딩': 'https://kangho-jun.github.io/YL_cadalog/molding.pdf',
        '손잡이': 'https://kangho-jun.github.io/YL_cadalog/handle.pdf'
    },

    // 카테고리별 표시할 실제 인쇄 페이지 번호 (PDF 인덱스가 아닌 종이에 적힌 번호)
    mapping: {
        '문틀': [326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337],
        '몰딩': [448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458, 459, 460, 461, 462, 463, 464],
        '손잡이': [340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353]
    },

    // 카카오톡 채널 URL
    kakaoTalkUrl: 'https://pf.kakao.com/',

    // 영림 필름 API 설정
    filmApiUrl: 'https://yl-cadalog.vercel.app/api/film',
    colorsUrl: 'https://yl-cadalog.vercel.app/colors.json',

    // PDF.js 워커 경로
    workerUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};

// --- PDF.js 설정 ---
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.workerUrl;

const categoryPdfDocs = {};
let currentCategory = '문틀';
let currentCategoryPages = [];
let currentPageIndex = 0;
let allItems = [];
let isStockOnly = false; // 방염재고운영 필터 상태

// 스와이프 관련 변수
let touchStartX = 0;
let touchEndX = 0;

/**
 * 카테고리별 분할 PDF 로드 (lazy)
 */
async function loadCategoryPdf(category) {
    if (categoryPdfDocs[category]) return categoryPdfDocs[category];

    const url = CONFIG.categoryPdfs[category];
    if (!url) return null;

    const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
    categoryPdfDocs[category] = await loadingTask.promise;
    return categoryPdfDocs[category];
}

/**
 * 인쇄 페이지 번호 → 분할 PDF 내 인덱스 변환
 */
function getSplitPdfIndex(printedPageNum, category) {
    const originalIdx = (printedPageNum % 2 === 0)
        ? printedPageNum / 2 + 2
        : Math.floor(printedPageNum / 2) + 2;
    const firstPage = CONFIG.mapping[category][0];
    const firstOrigIdx = (firstPage % 2 === 0) ? firstPage / 2 + 2 : Math.floor(firstPage / 2) + 2;
    return originalIdx - firstOrigIdx + 1;
}

/**
 * 카탈로그 초기화
 */
async function initCatalog() {
    renderCategory(currentCategory);
}

// 간단한 페이지 캐시 시스템
const pageCache = new Map();

/**
 * 페이지 선행 로딩 (Pre-rendering)
 */
async function prefetchAdjacentPages() {
    const nextIdx = currentPageIndex + 1;
    const prevIdx = currentPageIndex - 1;

    // 다음 페이지 미리 로드
    if (nextIdx < currentCategoryPages.length) {
        const info = currentCategoryPages[nextIdx];
        if (info.type === 'PDF' && !pageCache.has(info.num)) {
            fetchPageToCache(info.num);
        }
    }
    // 이전 페이지 미리 로드
    if (prevIdx >= 0) {
        const info = currentCategoryPages[prevIdx];
        if (info.type === 'PDF' && !pageCache.has(info.num)) {
            fetchPageToCache(info.num);
        }
    }
}

async function fetchPageToCache(printedPageNum) {
    const doc = categoryPdfDocs[currentCategory];
    if (!doc) return;
    const pdfIdx = getSplitPdfIndex(printedPageNum, currentCategory);

    try {
        const page = await doc.getPage(pdfIdx);
        pageCache.set(printedPageNum, page);
    } catch (e) {
        console.warn(`Pre-fetch failed for ${printedPageNum}`, e);
    }
}

/**
 * 인쇄 페이지 번호를 PDF 인덱스와 '좌/우' 정보로 변환하여 렌더링
 * 스프레드 방식 PDF를 절반으로 잘라 한 페이지씩 표시합니다.
 */
async function renderPrintedPage(printedPageNum, container) {
    const side = (printedPageNum % 2 === 0) ? 'left' : 'right';
    const pdfIdx = getSplitPdfIndex(printedPageNum, currentCategory);
    const doc = categoryPdfDocs[currentCategory];

    try {
        let page;
        if (pageCache.has(printedPageNum)) {
            page = pageCache.get(printedPageNum);
        } else {
            page = await doc.getPage(pdfIdx);
            pageCache.set(printedPageNum, page);
        }

        const scale = 2; // 고해상도 유지
        const viewport = page.getViewport({ scale: scale });

        // 실제 화면에 보여줄 캔버스 (크롭된 크기)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = viewport.width / 2;
        canvas.height = viewport.height;
        canvas.className = 'pdf-canvas-container fade-in';

        container.innerHTML = ''; // 기존 슬라이드 제거
        container.appendChild(canvas);

        // 임시 캔버스로 전체 스프레드 렌더링 후 필요한 부분만 복사
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const tempCtx = tempCanvas.getContext('2d');

        await page.render({
            canvasContext: tempCtx,
            viewport: viewport
        }).promise;

        const sourceX = (side === 'left') ? 0 : viewport.width / 2;
        ctx.drawImage(tempCanvas, sourceX, 0, viewport.width / 2, viewport.height, 0, 0, viewport.width / 2, viewport.height);

        // 애니메이션 효과를 위해 클래스 추가
        setTimeout(() => canvas.classList.add('active'), 50);

    } catch (err) {
        console.error(`Page ${printedPageNum} (PDF idx ${pdfIdx}) rendering failed:`, err);
        throw err; // 바깥 catch로 에러 전파
    }
}

/**
 * 슬라이더 UI 구성
 */
function initSliderUI(container) {
    container.innerHTML = `
        <div class="pdf-slider-container">
            <div id="pdf-slide-wrapper" class="pdf-slide-wrapper">
                <div class="spinner">페이지를 구성 중입니다...</div>
            </div>
            <div class="slider-controls">
                <button id="prev-btn" class="nav-btn" onclick="changePage(-1)" title="이전 페이지">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div id="page-indicator" class="page-indicator">0 / 0</div>
                <button id="next-btn" class="nav-btn" onclick="changePage(1)" title="다음 페이지">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
        </div>
    `;

    const slideWrapper = document.getElementById('pdf-slide-wrapper');
    slideWrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
    slideWrapper.addEventListener('touchend', handleTouchEnd, { passive: true });

    // 키보드 방향키 지원 (중복 등록 방지)
    document.removeEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleKeydown);
}

/**
 * 키보드 방향키 핸들러
 */
function handleKeydown(e) {
    if (currentCategory === '필름') return;
    if (e.key === 'ArrowLeft') changePage(-1);
    if (e.key === 'ArrowRight') changePage(1);
}

/**
 * 페이지 변경 함수
 */
async function changePage(direction) {
    const newIndex = currentPageIndex + direction;
    if (newIndex < 0 || newIndex >= currentCategoryPages.length) return;

    currentPageIndex = newIndex;
    await updateSlider();
}

/**
 * 슬라이더 상태 업데이트 및 렌더링
 */
async function updateSlider() {
    const slideWrapper = document.getElementById('pdf-slide-wrapper');
    const pageIndicator = document.getElementById('page-indicator');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (!slideWrapper) return;

    pageIndicator.innerText = `${currentPageIndex + 1} / ${currentCategoryPages.length}`;
    prevBtn.disabled = currentPageIndex === 0;
    nextBtn.disabled = currentPageIndex === currentCategoryPages.length - 1;

    const pageInfo = currentCategoryPages[currentPageIndex];

    if (pageInfo.type === 'IMAGE') {
        renderImageSlide(pageInfo.url, slideWrapper);
    } else {
        await renderPrintedPage(pageInfo.num, slideWrapper);
    }

    prefetchAdjacentPages();
}

/**
 * 이미지 슬라이드 렌더링
 */
function renderImageSlide(url, container) {
    const img = document.createElement('img');
    img.src = url;
    img.className = 'pdf-canvas-container fade-in'; // 기존 스타일 재사용
    img.style.objectFit = 'contain';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';

    container.innerHTML = '';
    container.appendChild(img);

    setTimeout(() => img.classList.add('active'), 50);
}

// 스와이프 핸들러
function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const threshold = 50;
    if (touchEndX < touchStartX - threshold) {
        changePage(1); // 왼쪽으로 쓸기 -> 다음
    }
    if (touchEndX > touchStartX + threshold) {
        changePage(-1); // 오른쪽으로 쓸기 -> 이전
    }
}

/**
 * 선택된 카테고리의 모든 페이지 렌더링
 */
async function renderCategory(category) {
    const target = document.getElementById('pdf-render-target');
    currentCategory = category;

    if (category === '필름') {
        const controlsHtml = `
            <div class="controls-header">
                <div class="search-container">
                    <svg class="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="yl-search-input" class="search-input" placeholder="제품명 또는 제품코드로 검색..." oninput="handleKeywordSearch()">
                </div>
                <button id="stock-filter-btn" class="stock-filter-btn" onclick="toggleInStockFilter()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 11.08 12 19 2 9"></polyline><polyline points="22 4 12 11.92 2 1.92"></polyline></svg>
                    방염재고운영
                </button>
            </div>
            <div id="film-grid-container"></div>
        `;
        target.innerHTML = controlsHtml;
        fetchFilmProducts(1);
        return;
    }

    // 상태 초기화
    currentPageIndex = 0;
    pageCache.clear();

    // 탭별 PDF lazy-load
    target.innerHTML = '<div class="spinner">카탈로그를 불러오고 있습니다...</div>';
    try {
        await loadCategoryPdf(category);
    } catch (error) {
        target.innerHTML = `<div class="spinner" style="color:red">PDF 로드 실패: ${error.message}</div>`;
        console.error('PDF Load Error:', error);
        return;
    }

    if (category === '몰딩') {
        const pages = CONFIG.mapping['몰딩'] || [];
        currentCategoryPages = [
            { type: 'IMAGE', url: 'https://ecimg.cafe24img.com/pg2383b21973322017/daesan3833/intro/image/%E1%84%86%E1%85%A9%E1%86%AF%E1%84%83%E1%85%B5%E1%86%BC_%E1%84%8C%E1%85%A2%E1%84%80%E1%85%A9.png' },
            ...pages.map(p => ({ type: 'PDF', num: p }))
        ];
    } else if (category === '손잡이') {
        const pages = CONFIG.mapping['손잡이'] || [];
        currentCategoryPages = [
            { type: 'IMAGE', url: 'https://kangho-jun.github.io/YL_cadalog/docs/추가이미지/domus.png' },
            { type: 'IMAGE', url: 'https://kangho-jun.github.io/YL_cadalog/docs/추가이미지/beplan.png' },
            ...pages.map(p => ({ type: 'PDF', num: p }))
        ];
    } else {
        const pages = CONFIG.mapping[category] || [];
        currentCategoryPages = pages.map(p => ({ type: 'PDF', num: p }));
    }

    initSliderUI(target);
    await updateSlider();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 방염재고운영 필터 토글
 */
function toggleInStockFilter() {
    isStockOnly = !isStockOnly;
    const btn = document.getElementById('stock-filter-btn');
    if (btn) btn.classList.toggle('active', isStockOnly);

    fetchFilmProducts(1);
}

/**
 * 영림 필름 데이터 가져오기 (CORS 대응)
 */
async function fetchFilmProducts(page) {
    const target = document.getElementById('film-grid-container');
    if (!target) return;
    target.innerHTML = '<div class="spinner">제품 목록을 불러오는 중입니다...</div>';

    // 상태 초기화
    const searchInput = document.getElementById('yl-search-input');
    if (searchInput) searchInput.value = '';

    try {
        // 방염재고운영 필터 적용 여부에 따른 URL 구성
        let url = `${CONFIG.filmApiUrl}?page=${page}`;
        if (isStockOnly) {
            url += `&search_filter=IsStock`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        allItems = data.film_items || [];
        renderFilmGrid(allItems, page, data.total_pages);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('필름 데이터 로드 오류:', err);
        target.innerHTML = '<div class="spinner" style="color:red">데이터 로드 실패</div>';
    }
}

// 키워드 검색 핸들러
function handleKeywordSearch() {
    const query = document.getElementById('yl-search-input').value.toLowerCase().trim();
    const cards = document.querySelectorAll('.film-card');
    const pagination = document.querySelector('.pagination-wrap');

    let visibleCount = 0;
    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        const code = card.getAttribute('data-code');
        if (name.includes(query) || code.includes(query)) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    if (pagination) pagination.style.display = query ? 'none' : 'flex';
    updateNoResults(visibleCount);
}

// 이미지 업로드 핸들러
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = () => {
            const rgb = extractAverageColor(img);
            performColorSearch(rgb);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function extractAverageColor(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = 1;
    canvas.height = 1;
    ctx.drawImage(img, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2]];
}

async function performColorSearch(targetRGB) {
    const gridContainer = document.getElementById('film-grid-container');
    if (!colorDB) await loadColorDB();

    isColorSearching = true;
    const preview = document.getElementById('yl-color-preview');
    if (preview) {
        preview.style.backgroundColor = `rgb(${targetRGB[0]},${targetRGB[1]},${targetRGB[2]})`;
        preview.style.display = 'block';
    }

    const scoredItems = allItems.map(item => {
        const dbRGB = colorDB[item.film_no];
        let similarity = 0;
        if (dbRGB) {
            const dist = Math.sqrt(
                Math.pow(targetRGB[0] - dbRGB[0], 2) +
                Math.pow(targetRGB[1] - dbRGB[1], 2) +
                Math.pow(targetRGB[2] - dbRGB[2], 2)
            );
            similarity = Math.max(0, 100 - (dist / 441.67 * 100)).toFixed(1);
        }
        return { ...item, similarity };
    });

    scoredItems.sort((a, b) => b.similarity - a.similarity);
    renderFilmGrid(scoredItems, 1, 1, true);
}

function updateNoResults(count) {
    let noResults = document.getElementById('yl-no-results');
    const grid = document.querySelector('.film-grid');
    if (!grid) return;

    if (count === 0 && !noResults) {
        noResults = document.createElement('div');
        noResults.id = 'yl-no-results';
        noResults.className = 'no-results';
        noResults.innerHTML = '검색 결과가 없습니다.';
        grid.parentNode.insertBefore(noResults, grid.nextSibling);
    }
    if (noResults) noResults.style.display = (count === 0) ? 'block' : 'none';
}

function renderFilmGrid(items, currentPage, totalPages, isSorted = false) {
    const target = document.getElementById('film-grid-container');
    if (!target) return;

    let html = '<div class="film-grid">';

    items.forEach(item => {
        let imgSrc = item.image_url;
        if (imgSrc && !imgSrc.startsWith('http')) {
            imgSrc = 'https://www.ylfilm.co.kr' + imgSrc;
        }

        html += `
            <div class="film-card" data-name="${item.film_name.toLowerCase()}" data-code="${item.film_no.toLowerCase()}">
                <div class="thumb-wrap">
                    <img src="${imgSrc}" alt="${item.film_name}" loading="lazy">
                </div>
                <div class="info-wrap">
                    <span class="brand">YOUNGLIM FILM</span>
                    <p class="name">${item.film_name}</p>
                    <p class="code">${item.film_no}</p>
                </div>
            </div>
        `;
    });

    html += '</div>';

    if (!isSorted && totalPages > 1) {
        html += '<div class="pagination-wrap">';
        // ... (이동 로직은 그대로 유지)
        html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="fetchFilmProducts(${currentPage - 1})">&lt;</button>`;
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="fetchFilmProducts(${i})">${i}</button>`;
        }
        html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="fetchFilmProducts(${currentPage + 1})">&gt;</button>`;
        html += '</div>';
    } else if (isSorted) {
        html += '<div style="text-align:center; padding: 20px; color: var(--text-muted); cursor: pointer;" onclick="fetchFilmProducts(1)">필터 해제 (목록으로 돌아가기)</div>';
    }

    target.innerHTML = html;
}

// --- 이벤트 핸들링 ---

document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', (e) => {
        const category = e.target.getAttribute('data-category');
        if (category === currentCategory) return;

        // UI 업데이트
        document.querySelector('.tab-item.active').classList.remove('active');
        e.target.classList.add('active');

        currentCategory = category;
        renderCategory(category);
    });
});

// 카톡 링크 적용
document.getElementById('kakao-talk-btn').href = CONFIG.kakaoTalkUrl;

// 실행 시작
document.addEventListener('DOMContentLoaded', initCatalog);
