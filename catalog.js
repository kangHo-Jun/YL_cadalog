/**
 * 영림 웹 카탈로그 (GitHub Pages 연동 버전)
 */

const CONFIG = {
    // [CORS 대응] GitHub Pages URL 사용
    pdfUrl: 'https://kangho-jun.github.io/YL_cadalog/25-26%20%EC%98%81%EB%A6%BC%20%EC%9E%84%EC%97%85%20%EC%A2%85%ED%95%A9%20%EC%B9%B4%ED%83%88%EB%A1%9C%EA%B7%B8%202%EC%87%84_1212.pdf',

    // 카테고리별 표시할 페이지 번호 (사용자 제공 최신 데이터)
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

let pdfDoc = null;
let currentCategory = '문틀';
let currentCategoryPages = [];
let currentPageIndex = 0;
let allItems = [];
let colorDB = null;
let isColorSearching = false;

// 스와이프 관련 변수
let touchStartX = 0;
let touchEndX = 0;

// 색상 DB 로드 능
async function loadColorDB() {
    if (colorDB) return;
    try {
        const res = await fetch(CONFIG.colorsUrl);
        colorDB = await res.json();
    } catch (e) {
        console.error("Color DB load failed", e);
    }
}

/**
 * 카탈로그 초기화 및 PDF 로드
 */
async function initCatalog() {
    const loadingTarget = document.getElementById('loading-spinner');
    const finalUrl = CONFIG.pdfUrl + (CONFIG.pdfUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: finalUrl,
            withCredentials: false,
            disableRange: true,
            disableAutoFetch: true
        });

        loadingTask.onProgress = (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            const progressBar = document.getElementById('load-progress');
            if (progressBar && percent > 0) {
                progressBar.innerText = `로드 중... ${percent}%`;
            }
        };

        pdfDoc = await loadingTask.promise;
        renderCategory(currentCategory);
    } catch (error) {
        loadingTarget.innerHTML = `<p style="color:red">로드 실패: ${error.message}</p>`;
    }
}

/**
 * 인쇄 페이지 번호를 PDF 인덱스와 '좌/우' 정보로 변환하여 렌더링
 * 스프레드 방식 PDF를 절반으로 잘라 한 페이지씩 표시합니다.
 */
async function renderPrintedPage(printedPageNum, container) {
    // 매핑 공식: 
    // 짝수 페이지 P -> PDF index (P/2 + 2), side 'left'
    // 홀수 페이지 P -> PDF index (floor(P/2) + 2), side 'right'
    let pdfIdx, side;
    if (printedPageNum % 2 === 0) {
        pdfIdx = (printedPageNum / 2) + 2;
        side = 'left';
    } else {
        pdfIdx = Math.floor(printedPageNum / 2) + 2;
        side = 'right';
    }

    try {
        const page = await pdfDoc.getPage(pdfIdx);
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
    slideWrapper.addEventListener('touchstart', handleTouchStart, false);
    slideWrapper.addEventListener('touchend', handleTouchEnd, false);
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

    // 인디케이터 및 버튼 상태 업데이트
    pageIndicator.innerText = `${currentPageIndex + 1} / ${currentCategoryPages.length}`;
    prevBtn.disabled = currentPageIndex === 0;
    nextBtn.disabled = currentPageIndex === currentCategoryPages.length - 1;

    // 현재 페이지 렌더링
    const printedPageNum = currentCategoryPages[currentPageIndex];
    await renderPrintedPage(printedPageNum, slideWrapper);
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

    // 필름 카테고리는 API 데이터 및 전용 UI 활
    if (category === '필름') {
        const controlsHtml = `
            <div class="controls-header">
                <div class="search-container">
                    <svg class="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="yl-search-input" class="search-input" placeholder="제품명 또는 제품코드로 검색..." oninput="handleKeywordSearch()">
                </div>
                <button class="color-search-btn" onclick="document.getElementById('yl-color-input').click()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    색상 검색
                    <div id="yl-color-preview" class="color-preview"></div>
                </button>
                <input type="file" id="yl-color-input" style="display: none" accept="image/*" onchange="handleImageUpload(event)">
            </div>
            <div id="film-grid-container"></div>
        `;
        target.innerHTML = controlsHtml;
        loadColorDB(); // 필름 탭 선택 시 색상 DB 로드 시작
        fetchFilmProducts(1);
        return;
    }

    // PDF 문서 로드 대기 확인
    if (!pdfDoc) {
        target.innerHTML = '<div class="spinner">PDF 문서를 로드 중입니다. 잠시만 기다려주세요...</div>';
        // 로드가 완료될 때까지 약간의 대기 후 재시도 가능하도록 로직 보완 가능 (현재는 문구 표시)
        return;
    }

    // 상태 초기화
    currentCategoryPages = CONFIG.mapping[category];
    currentPageIndex = 0;

    initSliderUI(target);
    await updateSlider();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 영림 필름 데이터 가져오기 (CORS 대응)
 */
async function fetchFilmProducts(page) {
    const target = document.getElementById('film-grid-container');
    if (!target) return;
    target.innerHTML = '<div class="spinner">제품 목록을 불러오는 중입니다...</div>';

    // 상태 초기화
    isColorSearching = false;
    const searchInput = document.getElementById('yl-search-input');
    if (searchInput) searchInput.value = '';
    const colorPreview = document.getElementById('yl-color-preview');
    if (colorPreview) colorPreview.style.display = 'none';

    try {
        const response = await fetch(`${CONFIG.filmApiUrl}?page=${page}&category=Category_1`);
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

/**
 * 필름 제품 그리드 렌더링
 */
function renderFilmGrid(items, currentPage, totalPages, isSorted = false) {
    const target = document.getElementById('film-grid-container');
    if (!target) return;

    let html = '<div class="film-grid">';

    items.forEach(item => {
        let imgSrc = item.image_url;
        if (imgSrc && !imgSrc.startsWith('http')) {
            imgSrc = 'https://www.ylfilm.co.kr' + imgSrc;
        }
        const simDisplay = (isColorSearching && item.similarity) ? 'flex' : 'none';

        html += `
            <div class="film-card" data-name="${item.film_name.toLowerCase()}" data-code="${item.film_no.toLowerCase()}">
                <div class="similarity-badge" style="display: ${simDisplay}">${item.similarity}% 일치</div>
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

    // 페이지네이션 또는 초기화 버튼
    if (!isSorted && totalPages > 1) {
        html += '<div class="pagination-wrap">';
        html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="fetchFilmProducts(${currentPage - 1})">&lt;</button>`;
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="fetchFilmProducts(${i})">${i}</button>`;
        }
        html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="fetchFilmProducts(${currentPage + 1})">&gt;</button>`;
        html += '</div>';
    } else if (isSorted) {
        html += '<div style="text-align:center; padding: 20px; color: var(--text-muted); cursor: pointer;" onclick="fetchFilmProducts(1)">검색 결과 초기화 (목록으로 돌아가기)</div>';
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
