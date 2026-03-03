/**
 * 영림 웹 카탈로그 (GitHub Pages 연동 버전)
 */

const CONFIG = {
    // [CORS 대응] GitHub Pages URL 사용
    pdfUrl: 'https://kangho-jun.github.io/YL_cadalog/25-26%20%EC%98%81%EB%A6%BC%20%EC%9E%84%EC%97%85%20%EC%A2%85%ED%95%A9%20%EC%B9%B4%ED%83%88%EB%A1%9C%EA%B7%B8%202%EC%87%84_1212.pdf',

    // 카테고리별 표시할 페이지 번호 (현재 임시 데이터, 추후 수정 가능)
    mapping: {
        '제품A': [1, 2, 3, 4, 5],
        '제품B': [6, 7, 8, 9, 10],
        '제품C': [11, 12, 13, 14, 15],
        '제품D': [16, 17, 18, 19, 20]
    },

    // 카카오톡 채널 URL (전달 예정)
    kakaoTalkUrl: 'https://pf.kakao.com/',

    // [중요] PDF.js 워커 경로 (카페24 FTP 업로드 경로에 맞춰 수정)
    // 카페24 FTP의 html/ 폴더에 catalog.html과 함께 있을 경우 './pdf.worker.min.js' 등으로 수정 가능합니다.
    workerUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};

// --- PDF.js 설정 ---
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.workerUrl;

let pdfDoc = null;
let currentCategory = '제품A';

/**
 * 카탈로그 초기화 및 PDF 로드
 */
async function initCatalog() {
    const loadingTarget = document.getElementById('loading-spinner');

    // [캐시 방지] URL 뒤에 타임스탬프를 추가하여 항상 최신 파일을 불러오도록 합니다.
    const finalUrl = CONFIG.pdfUrl + (CONFIG.pdfUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    console.log('PDF 로드 시도 (절대 경로 확인):', finalUrl);

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: finalUrl,
            withCredentials: false,
            disableRange: true,
            disableAutoFetch: true
        });

        // 로드 진행률 표시
        loadingTask.onProgress = (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            const progressBar = document.getElementById('load-progress');
            if (progressBar && percent > 0) {
                progressBar.innerText = `로드 중... ${percent}%`;
            }
        };

        pdfDoc = await loadingTask.promise;
        console.log('PDF Loaded Successfully from GitHub Pages');

        // 초기 카테고리 렌더링
        renderCategory(currentCategory);
    } catch (error) {
        console.error('PDF 로드 실패 상세 원인:', error);

        let errorMsg = 'PDF를 불러오지 못했습니다.';
        if (error.name === 'SecurityError') {
            errorMsg = '이동된 경로의 보안 정책(CORS)으로 인해 차단되었습니다.';
        } else if (error.name === 'MissingPDFException') {
            errorMsg = 'PDF 파일을 찾을 수 없습니다. 경로를 확인해주세요.';
        }

        loadingTarget.innerHTML = `
            <p style="color: #ff4d4d; font-weight: bold;">${errorMsg}</p>
            <p style="font-size: 0.85rem; margin-top:10px; color: #666;">
                브라우저 콘솔(F12 > Console)의 에러 메시지를 확인해 주세요.<br>
                (에러 종류: ${error.name})
            </p>
        `;
    }
}

/**
 * 특정 페이지를 Canvas로 렌더링
 */
async function renderPage(pageNum, container) {
    const page = await pdfDoc.getPage(pageNum);

    // 모바일 대응 및 선명도를 위해 scale 설정 (2: 고해상도)
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    container.appendChild(canvas);

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
}

/**
 * 선택된 카테고리의 모든 페이지 렌더링
 */
async function renderCategory(category) {
    const target = document.getElementById('pdf-render-target');
    const pageNumbers = CONFIG.mapping[category];

    // 스피너 유지하며 배경 렌더링
    target.innerHTML = '<div class="spinner">페이지를 구성 중입니다...</div>';

    const pagesWrapper = document.createElement('div');
    pagesWrapper.className = 'rendered-pages-list';

    try {
        // 비연속 페이지들을 순차적으로 렌더링하여 하나의 스크롤 뷰 구현
        for (const num of pageNumbers) {
            await renderPage(num, pagesWrapper);
        }

        target.innerHTML = '';
        target.appendChild(pagesWrapper);

        // 렌더링 완료 후 최상단으로 스크롤 이동
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('페이지 렌더링 오류:', err);
        target.innerHTML = '<div class="spinner">페이지 렌더링 중 오류가 발생했습니다.</div>';
    }
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
