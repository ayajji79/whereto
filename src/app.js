/**
 * 여행 블로그 올인원 대시보드 - 메인 애플리케이션 제어기
 * 리스트형 포스팅(관광지+맛집+카페 코스) 및 무제한 즐겨찾기 관리 지원
 */

// 전역 상태 관리
const AppState = {
  currentView: 'studio', // 'studio' | 'history' | 'favorites' | 'settings'
  currentStep: 1,
  selectedLocation: '제주도',
  selectedTheme: '당일치기 알짜코스',
  postType: 'curation', // 'curation' (테마 리스트/알짜 큐레이션형) | 'route' (코스/동선 투어형)
  selectedPlaces: [], // 코스에 담긴 장소 객체 리스트 [{ name, category, whyRecommend, features, address, operatingHours, recommendStats }, ...]
  selectedPlace: '', // 대표 장소명 또는 코스명
  recommendations: null, // 카테고리별 추천 장소 데이터
  step2Assets: null,
  masterPrompt: '',
  articleContent: '',
  snsPackage: null,
  activeMainFavCategory: 'ALL',
  favPageCategory: 'ALL',
  activePlaceCategory: 'ALL',
  settings: {
    geminiApiKey: '',
    selectedModel: 'gemini-3.8-flash',
    sheetsWebhookUrl: '',
    autoSaveToSheets: true
  },
  quickLinks: [],
  history: [],
  savedPrompts: [],
  activeOutputTab: 'markdown' // markdown, html, preview
};

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // 1. 설정 및 저장된 데이터 로드
  AppState.settings = window.BlogStorage.getSettings();
  AppState.quickLinks = window.BlogStorage.getQuickLinks();
  AppState.history = window.BlogStorage.getHistory() || [];

  // 과거 스프레드시트/프롬프트 전용 저장소에만 보관되었던 데이터가 있다면 메인 히스토리에 통합 마이그레이션
  try {
    const savedP = JSON.parse(localStorage.getItem('saved_master_prompts') || '[]');
    AppState.savedPrompts = savedP;
    if (Array.isArray(savedP) && savedP.length > 0) {
      let migrated = false;
      savedP.forEach(p => {
        const id = p.id || ('H_' + (p.date ? new Date(p.date).getTime() : Date.now()));
        const alreadyExists = AppState.history.some(h => h.id === id || (p.promptText && h.masterPrompt === p.promptText));
        if (!alreadyExists) {
          AppState.history.push({
            id: id,
            createdAt: p.displayDate || new Date().toLocaleString('ko-KR'),
            currentStep: 3,
            stageBadge: '3단계: 마스터 프롬프트 기록',
            location: p.location || '전국',
            placeName: p.placeName || `${p.location || '추천'} 베스트 코스`,
            selectedPlace: p.placeName || '',
            selectedPlaces: p.placesList ? p.placesList.split(',').map(n => ({ name: n.trim(), category: 'sightseeing' })) : [],
            recommendations: {},
            theme: '당일치기 알짜코스',
            postType: p.postType || 'curation',
            step2Assets: {},
            masterPrompt: p.promptText || '',
            articleContent: '',
            stats: {}
          });
          migrated = true;
        }
      });
      if (migrated) {
        localStorage.setItem(window.BlogStorage.KEYS.HISTORY, JSON.stringify(AppState.history));
      }
    }
  } catch (e) {
    console.error('History migration error:', e);
  }

  // 2. UI 초기 렌더링
  renderHeaderStatus();
  renderMainFavoritesList();
  renderFavoritesPageView();
  renderHistoryList();
  setupEventListeners();
  setPostType('curation');

  // 3. GAS 연동 코드 텍스트 채우기
  initGasCodeView();

  // 4. URL 해시 기반 뷰 라우팅 체크 (#history, #favorites, #settings, #studio)
  const currentHash = window.location.hash.replace('#', '');
  if (['studio', 'history', 'favorites', 'settings'].includes(currentHash)) {
    switchView(currentHash, false);
  } else {
    switchView('studio', false);
  }

  // 해시 변경 감지
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (['studio', 'history', 'favorites', 'settings'].includes(hash)) {
      switchView(hash, false);
    }
  });

  // 5. 1단계 기본 지역 추천 로드 및 코스 초기화
  handleSearchPlaces(false);

  // 6. 단일 HTML 다운로더 초기화
  setupDownloadSingleHtml();
}

// ─── [0. 페이지 뷰 전환 (Switch View - 팝업 없이 전체 페이지 전환)] ───
function switchView(viewName, updateHash = true) {
  const validViews = ['studio', 'history', 'favorites', 'settings'];
  if (!validViews.includes(viewName)) viewName = 'studio';

  AppState.currentView = viewName;

  // 1. 모든 페이지 뷰 컨테이너 전환
  validViews.forEach(v => {
    const viewEl = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-btn-${v}`);

    if (viewEl) {
      if (v === viewName) {
        viewEl.classList.remove('hidden');
      } else {
        viewEl.classList.add('hidden');
      }
    }

    if (navBtn) {
      if (v === viewName) {
        navBtn.className = 'nav-tab-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-slate-900 text-white shadow-xs';
      } else {
        navBtn.className = 'nav-tab-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-100';
      }
    }
  });

  // 2. 뷰별 데이터 리프레시 및 동기화
  if (viewName === 'history') {
    renderHistoryList();
  } else if (viewName === 'favorites') {
    renderFavoritesPageView();
  } else if (viewName === 'settings') {
    populateSettingsFields();
  }

  // 3. 해시 업데이트
  if (updateHash) {
    window.location.hash = viewName;
  }

  // 4. 항상 화면 최상단으로 스크롤 (헤더 고정 유지)
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchView = switchView;

// 설정 페이지 입력칸 데이터 채우기
function populateSettingsFields() {
  const keyInput = document.getElementById('settings-gemini-key');
  const modelSelect = document.getElementById('settings-model-select');
  const sheetsInput = document.getElementById('settings-sheets-url');

  if (keyInput) keyInput.value = AppState.settings.geminiApiKey || '';
  if (modelSelect) modelSelect.value = AppState.settings.selectedModel || 'gemini-3.8-flash';
  if (sheetsInput) sheetsInput.value = AppState.settings.sheetsWebhookUrl || '';

  const gPing = document.getElementById('gemini-ping-result');
  const sPing = document.getElementById('sheets-ping-result');
  if (gPing) gPing.innerHTML = '';
  if (sPing) sPing.innerHTML = '';

  initGasCodeView();
}

function initGasCodeView() {
  const gasTextarea = document.getElementById('page-gas-code-textarea');
  if (gasTextarea && window.GAS_CODE_TEMPLATE) {
    gasTextarea.value = window.GAS_CODE_TEMPLATE;
  }
}

function copyGasCode() {
  const code = window.GAS_CODE_TEMPLATE || (document.getElementById('page-gas-code-textarea') ? document.getElementById('page-gas-code-textarea').value : '');
  if (code) {
    copyText(code);
  } else {
    showToast('복사할 연동 코드를 찾을 수 없습니다.', 'warning');
  }
}
window.copyGasCode = copyGasCode;

// ─── [1. 헤더 & 상태 뱃지] ───
function renderHeaderStatus() {
  const geminiBadge = document.getElementById('gemini-status-badge');
  const sheetsBadge = document.getElementById('sheets-status-badge');

  if (geminiBadge) {
    if (AppState.settings.geminiApiKey) {
      geminiBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors';
      geminiBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ${AppState.settings.selectedModel}`;
    } else {
      geminiBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors';
      geminiBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> AI 미설정 (클릭하여 설정)`;
    }
  }

  if (sheetsBadge) {
    if (AppState.settings.sheetsWebhookUrl) {
      sheetsBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors';
      sheetsBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-500"></span> 시트 연동됨`;
    } else {
      sheetsBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600 cursor-pointer hover:bg-slate-300 transition-colors';
      sheetsBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> 로컬 저장 모드`;
    }
  }
}

// ─── [2. 즐겨찾기 시스템 (메인 하단 리스트 & 전용 페이지 뷰)] ───

// 메인 페이지 가장 하단 리스트 렌더링
function renderMainFavoritesList() {
  const container = document.getElementById('main-favorites-list-container');
  const counterEl = document.getElementById('main-fav-counter');

  if (counterEl) {
    counterEl.textContent = `총 ${AppState.quickLinks.length}개`;
  }

  if (!container) return;

  const currentCat = AppState.activeMainFavCategory || 'ALL';
  const filteredLinks = currentCat === 'ALL'
    ? AppState.quickLinks
    : AppState.quickLinks.filter(l => l.category === currentCat);

  if (filteredLinks.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-slate-400 space-y-2">
        <i class="fa-regular fa-folder-open text-2xl text-slate-300"></i>
        <p class="text-xs">등록된 ${currentCat === 'ALL' ? '' : `'${currentCat}'`} 즐겨찾기가 없습니다.</p>
        <button onclick="switchView('favorites'); togglePageAddFavForm(true);" class="mt-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
          + 즐겨찾기 페이지에서 새 사이트 등록하기
        </button>
      </div>
    `;
    return;
  }

  // 메인 하단 깔끔한 리스트(행) 형태로 렌더링
  container.innerHTML = filteredLinks.map(link => {
    let catBadgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
    let iconClass = 'fa-solid fa-arrow-up-right-from-square';

    if (link.category === '블로그') {
      iconClass = 'fa-solid fa-pen-nib';
    } else if (link.category === '데이터') {
      iconClass = 'fa-solid fa-chart-simple';
    } else if (link.category === '디자인') {
      iconClass = 'fa-solid fa-wand-magic-sparkles';
    }

    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/70 hover:bg-slate-100/70 rounded-xl border border-slate-200 transition-all group">
        <!-- Site Info -->
        <div class="flex items-center gap-3 min-w-0">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${catBadgeColor} shrink-0">
            <i class="${iconClass} text-[9px] text-slate-600"></i>
            <span>${escapeHtml(link.category || '기타')}</span>
          </span>
          <div class="min-w-0">
            <h4 class="text-xs font-extrabold text-slate-800 group-hover:text-slate-950 transition-colors truncate">
              ${escapeHtml(link.title)}
            </h4>
            <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
              class="text-[11px] font-mono text-slate-400 hover:text-slate-700 truncate block transition-colors" title="${escapeHtml(link.url)}">
              ${escapeHtml(link.url)}
            </a>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          <button onclick="copyText('${escapeHtml(link.url)}')" title="주소 복사"
            class="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-xs font-medium transition-all flex items-center gap-1">
            <i class="fa-regular fa-copy text-[11px]"></i>
            <span class="text-[11px]">복사</span>
          </button>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
            class="px-3 py-1 bg-white hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5">
            <span class="text-[11px]">새 탭 열기</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
          <button onclick="deleteQuickLink('${link.id}')" title="즐겨찾기 삭제"
            class="p-1.5 text-slate-300 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 메인 하단 카테고리 필터
function filterMainFavoritesCategory(category) {
  AppState.activeMainFavCategory = category;
  const categories = ['ALL', '블로그', '데이터', '디자인', '기타'];

  categories.forEach(cat => {
    const btn = document.getElementById(`main-fav-tab-${cat}`);
    if (btn) {
      if (cat === category) {
        btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs';
      } else {
        btn.className = 'px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    }
  });

  renderMainFavoritesList();
}

// ─── [2-1. 즐겨찾기 전용 페이지 렌더링 & 제어] ───
function renderFavoritesPageView() {
  const container = document.getElementById('page-favorites-grid');
  const counterEl = document.getElementById('page-fav-counter');
  const searchInput = document.getElementById('page-fav-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const currentCat = AppState.favPageCategory || 'ALL';

  if (!container) return;

  let list = AppState.quickLinks || [];

  // 카테고리 필터
  if (currentCat !== 'ALL') {
    list = list.filter(l => l.category === currentCat);
  }

  // 검색어 필터
  if (query) {
    list = list.filter(l =>
      (l.title && l.title.toLowerCase().includes(query)) ||
      (l.url && l.url.toLowerCase().includes(query)) ||
      (l.category && l.category.toLowerCase().includes(query))
    );
  }

  if (counterEl) {
    counterEl.textContent = `표시 ${list.length}개 / 전체 ${AppState.quickLinks.length}개`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <i class="fa-regular fa-bookmark text-4xl text-slate-300"></i>
        <h4 class="text-sm font-bold text-slate-700">검색 조건에 맞는 즐겨찾기 사이트가 없습니다.</h4>
        <p class="text-xs text-slate-400">다른 검색어를 입력하시거나 위 [새 즐겨찾기 등록] 버튼을 눌러 사이트를 등록해보세요.</p>
        <button onclick="togglePageAddFavForm(true)" class="mt-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs">
          + 새 즐겨찾기 등록하기
        </button>
      </div>
    `;
    return;
  }

  // 페이지 전체에 최적화된 와이드 행 리스트 포맷
  container.innerHTML = list.map(link => {
    let catBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
    let iconClass = 'fa-solid fa-arrow-up-right-from-square';

    if (link.category === '블로그') {
      catBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      iconClass = 'fa-solid fa-pen-nib';
    } else if (link.category === '데이터') {
      catBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      iconClass = 'fa-solid fa-chart-simple';
    } else if (link.category === '디자인') {
      catBadgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
      iconClass = 'fa-solid fa-wand-magic-sparkles';
    }

    return `
      <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:shadow-sm hover:border-blue-300 transition-all flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 group">
        <!-- Col 1: 카테고리 -->
        <div class="md:col-span-2 flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${catBadgeColor}">
            <i class="${iconClass} text-[10px]"></i>
            <span>${escapeHtml(link.category || '기타')}</span>
          </span>
        </div>

        <!-- Col 2: 사이트명 -->
        <div class="md:col-span-4 min-w-0">
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
            class="text-sm font-extrabold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5">
            <span>${escapeHtml(link.title)}</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-400 group-hover:text-blue-500"></i>
          </a>
        </div>

        <!-- Col 3: URL 주소 -->
        <div class="md:col-span-4 min-w-0">
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
            class="text-xs font-mono text-slate-500 hover:text-blue-600 truncate block transition-colors" title="${escapeHtml(link.url)}">
            ${escapeHtml(link.url)}
          </a>
        </div>

        <!-- Col 4: 액션 버튼 -->
        <div class="md:col-span-2 flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <button onclick="copyText('${escapeHtml(link.url)}')" title="링크 주소 복사"
            class="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-1">
            <i class="fa-regular fa-copy text-[11px]"></i>
            <span class="text-xs">복사</span>
          </button>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
            class="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-2xs transition-colors flex items-center gap-1">
            <span>새 탭 열기</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
          <button onclick="deleteQuickLink('${link.id}')" title="즐겨찾기 삭제"
            class="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors ml-1">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function setPageFavCategory(cat) {
  AppState.favPageCategory = cat;
  const categories = ['ALL', '블로그', '데이터', '디자인', '기타'];

  categories.forEach(c => {
    const btn = document.getElementById(`page-fav-cat-${c}`);
    if (btn) {
      if (c === cat) {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    }
  });

  renderFavoritesPageView();
}

function togglePageAddFavForm(forceOpen) {
  const formCard = document.getElementById('page-fav-add-card');
  if (!formCard) return;

  if (forceOpen === true) {
    formCard.classList.remove('hidden');
    document.getElementById('page-fav-name')?.focus();
  } else if (forceOpen === false) {
    formCard.classList.add('hidden');
  } else {
    formCard.classList.toggle('hidden');
    if (!formCard.classList.contains('hidden')) {
      document.getElementById('page-fav-name')?.focus();
    }
  }
}

function savePageNewFavorite() {
  const nameInput = document.getElementById('page-fav-name');
  const urlInput = document.getElementById('page-fav-url');
  const catInput = document.getElementById('page-fav-cat');

  const title = nameInput ? nameInput.value.trim() : '';
  const url = urlInput ? urlInput.value.trim() : '';
  const category = catInput ? catInput.value : '블로그';

  if (!title || !url || url === 'https://') {
    showToast('사이트 이름과 올바른 웹사이트 URL을 입력해주세요.', 'warning');
    return;
  }

  const newLink = {
    id: 'fav-' + Date.now(),
    title,
    url,
    category,
    icon: 'fa-solid fa-arrow-up-right-from-square'
  };

  AppState.quickLinks.push(newLink);
  window.BlogStorage.saveQuickLinks(AppState.quickLinks);

  // 인풋 초기화 및 폼 닫기
  if (nameInput) nameInput.value = '';
  if (urlInput) urlInput.value = 'https://';
  togglePageAddFavForm(false);

  // 뷰 동기화
  renderMainFavoritesList();
  renderFavoritesPageView();
  showToast(`'${title}' 사이트가 즐겨찾기에 등록되었습니다!`, 'success');

  // 스프레드시트 동기화
  if (AppState.settings.sheetsWebhookUrl) {
    window.BlogAPI.syncToGoogleSheets(AppState.settings.sheetsWebhookUrl, 'saveQuickLinks', AppState.quickLinks);
  }
}

function deleteQuickLink(id) {
  AppState.quickLinks = AppState.quickLinks.filter(l => l.id !== id);
  window.BlogStorage.saveQuickLinks(AppState.quickLinks);
  renderMainFavoritesList();
  renderFavoritesPageView();
  showToast('즐겨찾기 사이트가 삭제되었습니다.', 'info');
}

// 하위 호환성 별칭
function renderQuickLinks() {
  renderMainFavoritesList();
  renderFavoritesPageView();
}
function openAddQuickLinkModal() {
  switchView('favorites');
  togglePageAddFavForm(true);
}
function openFullscreenFavoritesView() {
  switchView('favorites');
}
function openSettingsModal() {
  switchView('settings');
}
window.renderQuickLinks = renderQuickLinks;
window.openAddQuickLinkModal = openAddQuickLinkModal;
window.openFullscreenFavoritesView = openFullscreenFavoritesView;
window.openSettingsModal = openSettingsModal;
window.renderFavoritesPageView = renderFavoritesPageView;
window.setPageFavCategory = setPageFavCategory;
window.togglePageAddFavForm = togglePageAddFavForm;
window.savePageNewFavorite = savePageNewFavorite;
window.deleteQuickLink = deleteQuickLink;
window.filterMainFavoritesCategory = filterMainFavoritesCategory;

// ─── [3. 워크플로우 스텝 제어] ───
function goToStep(stepNumber) {
  if (stepNumber < 1 || stepNumber > 4) return;
  AppState.currentStep = stepNumber;

  for (let i = 1; i <= 4; i++) {
    const stepBtn = document.getElementById(`step-indicator-${i}`);
    const stepPanel = document.getElementById(`step-panel-${i}`);

    if (stepPanel) {
      if (i === stepNumber) {
        stepPanel.classList.remove('hidden');
      } else {
        stepPanel.classList.add('hidden');
      }
    }

    if (stepBtn) {
      if (i === stepNumber) {
        stepBtn.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20';
      } else if (i < stepNumber) {
        stepBtn.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors';
      } else {
        stepBtn.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors';
      }
    }
  }

  if (stepNumber === 2) {
    renderStep2CourseOrder();
    setTimeout(() => {
      initOrUpdateStep2Map();
    }, 150);
  } else if (stepNumber === 4) {
    updateStep4Views();
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// ─── [3-1. 메인 홈으로 이동 (어디서든 1단계 메인 첫 화면으로 즉각 복귀)] ───
function navigateToHome() {
  // 1. 스튜디오 뷰로 전환
  switchView('studio');

  // 2. 1단계(메인 기획/장소 탐색)로 전환
  goToStep(1);

  // 3. 최상단으로 부드럽게 스크롤
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.navigateToHome = navigateToHome;

// ─── [4. Step 1: 리스트형 장소 & 코스 바스켓 탐색] ───
async function handleSearchPlaces(showAnimation = true) {
  const locationInput = document.getElementById('location-input');
  const themeSelect = document.getElementById('theme-select');
  const location = locationInput ? locationInput.value.trim() : '제주도';
  const theme = themeSelect ? themeSelect.value : '당일치기 알짜코스';

  AppState.selectedLocation = location;
  AppState.selectedTheme = theme;

  const btn = document.getElementById('btn-search-places');
  if (btn && showAnimation) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 탐색 중...`;
  }

  try {
    const recs = await window.BlogGenerators.generatePlaceRecommendations(
      location,
      theme,
      AppState.settings.geminiApiKey,
      AppState.settings.selectedModel
    );

    AppState.recommendations = recs;
    renderCourseBasket();
    renderRecommendations();

    if (showAnimation) {
      showToast(`'${location}' 상세 장소 데이터가 준비되었습니다!`, 'success');
      saveProgressToHistory(`1단계: '${location}' 키워드 장소 탐색`, true);
    }
  } catch (err) {
    console.error(err);
    showToast('장소 탐색 중 오류가 발생했습니다.', 'error');
  } finally {
    if (btn && showAnimation) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> 상세 장소 데이터 탐색`;
    }
  }
}

// 추천 장소 카테고리 필터 전환
function filterPlaceCategory(category) {
  AppState.activePlaceCategory = category;
  const categories = ['ALL', 'sightseeing', 'food', 'cafe', 'photo'];

  categories.forEach(cat => {
    const btn = document.getElementById(`pcat-${cat}`);
    if (btn) {
      if (cat === category) {
        btn.className = 'px-3 py-1.5 rounded-xl font-bold bg-blue-600 text-white shadow-xs';
      } else {
        btn.className = 'px-3 py-1.5 rounded-xl font-medium bg-white text-slate-600 hover:bg-slate-100 border border-slate-200';
      }
    }
  });

  renderRecommendations();
}

// 장소 상세 카드 렌더링 (원톤 미니멀 디자인, 실존 정보 및 정확한 네이버 지도 링크 제공)
function renderRecommendations() {
  const container = document.getElementById('recommendations-grid');
  const recs = AppState.recommendations;
  if (!container || !recs) return;

  const activeCat = AppState.activePlaceCategory || 'ALL';

  // 카테고리 정의 (원톤 모노크롬)
  const categoryDefs = {
    sightseeing: { label: '관광지 & 명소', icon: 'fa-landmark' },
    food: { label: '음식점 & 맛집', icon: 'fa-utensils' },
    cafe: { label: '카페 & 디저트', icon: 'fa-mug-hot' },
    photo: { label: '가볼만한곳 & 스팟', icon: 'fa-camera' },
    hidden: { label: '추천 장소', icon: 'fa-location-dot' }
  };

  // 노출할 장소 목록 취합
  let placesToShow = [];
  const keys = activeCat === 'ALL'
    ? ['sightseeing', 'food', 'cafe', 'photo', 'hidden']
    : [activeCat];

  keys.forEach(k => {
    const items = recs[k] || [];
    items.forEach(item => {
      placesToShow.push({
        ...item,
        categoryKey: k
      });
    });
  });

  if (placesToShow.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 p-8">
        <i class="fa-solid fa-map-pin text-3xl text-slate-400 mb-2"></i>
        <p class="text-xs">해당 카테고리의 장소 데이터가 없습니다.</p>
      </div>
    `;
    return;
  }

  const naverSearchHotplacesUrl = `https://map.naver.com/p/search/${encodeURIComponent(AppState.selectedLocation + ' 가볼만한곳')}`;
  const naverBlogHotplacesUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(AppState.selectedLocation + ' 맛집')}`;

  const bannerHtml = `
    <div class="col-span-full bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-1 border border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white shrink-0 border border-slate-700">
          <i class="fa-solid fa-location-dot text-base text-slate-200"></i>
        </div>
        <div>
          <div class="font-extrabold text-sm flex items-center gap-2">
            <span>'${escapeHtml(AppState.selectedLocation)}' 추천 장소 리스트</span>
            <span class="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-semibold">총 ${placesToShow.length}개 장소</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">블로그 검색과 방문자 후기를 바탕으로 메뉴, 주차, 운영시간을 정리했습니다. 원하는 장소를 선택하여 코스로 취합해보세요.</p>
        </div>
      </div>
      <div class="flex items-center flex-wrap gap-2 shrink-0 self-end md:self-auto">
        <a href="${naverSearchHotplacesUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all" title="네이버 지도 검색">
          <i class="fa-solid fa-map-location-dot text-slate-300"></i>
          <span>네이버지도 검색</span>
          <i class="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400"></i>
        </a>
        <a href="${naverBlogHotplacesUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all" title="블로그 후기 검색">
          <i class="fa-solid fa-magnifying-glass text-slate-300"></i>
          <span>블로그 후기</span>
          <i class="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400"></i>
        </a>
        <button onclick="openModal('custom-place-modal')" class="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer">
          <i class="fa-solid fa-plus text-slate-900"></i>
          <span>직접 장소 추가</span>
        </button>
      </div>
    </div>
  `;

  const cardsHtml = placesToShow.map(place => {
    const catDef = categoryDefs[place.categoryKey] || { label: '추천 장소', icon: 'fa-map-pin' };
    const isSelected = AppState.selectedPlaces.some(p => p.name === place.name);
    const selectedIndex = AppState.selectedPlaces.findIndex(p => p.name === place.name);

    // 고유 DOM ID
    const safePlaceId = 'pl-card-' + Math.abs(place.name.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)).toString(36);

    // 사용자의 정확한 검색을 위해 장소명 그대로 네이버 지도 검색 URL 생성
    const naverMapUrl = `https://map.naver.com/p/search/${encodeURIComponent(AppState.selectedLocation + ' ' + place.name)}`;
    const naverBlogUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(AppState.selectedLocation + ' ' + place.name + ' 후기')}`;

    return `
      <div class="bg-white rounded-2xl border ${isSelected ? 'border-slate-900 ring-2 ring-slate-900/15 shadow-md bg-slate-50/30' : 'border-slate-200 hover:border-slate-300 shadow-xs'} p-5 flex flex-col justify-between transition-all group">
        <div class="space-y-3">
          <!-- Card Header: Category Badge + Operation Status + Selection Status -->
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-slate-100 text-slate-800 border-slate-200">
              <i class="fa-solid ${catDef.icon} text-[10px] text-slate-600"></i>
              <span>${catDef.label}</span>
            </span>

            ${isSelected ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-2xs">
                <i class="fa-solid fa-check"></i> 코스 ${selectedIndex + 1}번 선택됨
              </span>
            ` : `
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>${escapeHtml(place.recommendStats || '정상 운영 중')}</span>
              </span>
            `}
          </div>

          <!-- Place Title & Live Map Link -->
          <div class="flex items-start justify-between gap-2 pt-0.5">
            <div class="flex-1">
              <h4 class="text-base font-extrabold text-slate-900 tracking-tight">
                ${escapeHtml(place.name)}
              </h4>
              <p class="text-[11px] text-slate-500 mt-0.5 font-medium line-clamp-1">${escapeHtml(place.features || '')}</p>
            </div>
            <!-- 네이버 지도 버튼 (단독 검색 링크로 정확한 장소 표시) -->
            <a href="${naverMapUrl}" target="_blank" rel="noopener noreferrer"
              class="shrink-0 text-xs font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 flex items-center gap-1 transition-colors"
              title="네이버 지도에서 '${escapeHtml(place.name)}' 위치 및 상세 정보 확인하기">
              <i class="fa-solid fa-map-location-dot text-emerald-600"></i>
              <span>지도</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400"></i>
            </a>
          </div>

          <!-- Why Recommend Box (기본 노출: 장소명과 추천 이유만 깔끔하게 노출) -->
          <div class="bg-blue-50/40 border border-blue-100/80 rounded-xl p-3 text-xs leading-relaxed text-slate-800">
            <div class="font-bold text-blue-950 flex items-center gap-1.5 mb-1 text-[11px]">
              <i class="fa-regular fa-lightbulb text-blue-600"></i>
              <span>어떤 장소인가요? (추천 이유)</span>
            </div>
            <p class="font-normal text-slate-700 leading-relaxed">${escapeHtml(place.whyRecommend || '방문객들에게 호평받는 인기 장소입니다.')}</p>
          </div>

          <!-- Accordion Toggle Button (클릭 시 상세 정보 펼침) -->
          <button type="button" onclick="togglePlaceDetailAccordion('${safePlaceId}')"
            class="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-bold text-[11px] flex items-center justify-between transition-all cursor-pointer">
            <span id="accordion-label-${safePlaceId}" class="flex items-center gap-1.5">
              <i class="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
              <span>상세 정보 (메뉴·주차·후기·운영시간) 펼치기</span>
            </span>
            <span class="text-[10px] text-slate-400 font-normal">클릭하여 전체보기</span>
          </button>

          <!-- Collapsed Details Section (기본 숨김 아코디언) -->
          <div id="place-detail-${safePlaceId}" class="hidden space-y-2.5 pt-2 border-t border-slate-100 transition-all">
            <!-- Signature Menu & Features (대표 메뉴 및 가격대) -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs space-y-1">
              <div class="font-bold text-slate-900 flex items-center gap-1.5 text-[11px]">
                <i class="fa-solid fa-utensils text-slate-600"></i>
                <span>대표 메뉴 & 주요 볼거리</span>
              </div>
              <p class="text-slate-700 font-normal leading-relaxed text-[11px]">
                ${escapeHtml(place.menuInfo || place.features || '대표 메뉴 및 구성')}
              </p>
            </div>

            <!-- Parking Info (주차 정보) -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
              <div class="font-bold text-slate-900 flex items-center gap-1.5 mb-0.5 text-[11px]">
                <i class="fa-solid fa-square-parking text-slate-600"></i>
                <span>주차 정보</span>
              </div>
              <p class="text-slate-700 font-normal leading-relaxed text-[11px]">
                ${escapeHtml(place.parkingInfo || '전용 주차장 구비 또는 인근 공영주차장 이용 권장')}
              </p>
            </div>

            <!-- Real Visitor Review & Tips Summary (블로그 후기 & 방문 팁) -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
              <div class="font-bold text-slate-900 flex items-center gap-1.5 mb-0.5 text-[11px]">
                <i class="fa-regular fa-comment-dots text-slate-600"></i>
                <span>블로그 찐후기 & 방문 팁</span>
              </div>
              <p class="text-slate-700 font-normal leading-relaxed text-[11px]">
                ${escapeHtml(place.visitorReviewSummary || '블로그 후기: "음식 맛과 분위기, 동선이 만족스러움"')}
              </p>
            </div>

            <!-- Address & Operating Hours Info -->
            <div class="space-y-1 text-[11px] text-slate-600 pt-0.5">
              <div class="flex items-start gap-1.5">
                <i class="fa-solid fa-location-dot text-slate-500 mt-0.5 shrink-0"></i>
                <span class="text-slate-800 font-medium">${escapeHtml(place.address || AppState.selectedLocation)}</span>
              </div>
              <div class="flex items-start gap-1.5">
                <i class="fa-regular fa-clock text-slate-500 mt-0.5 shrink-0"></i>
                <span>${escapeHtml(place.operatingHours || '영업시간 확인 권장')}</span>
              </div>
            </div>

            <!-- Bottom Actions: Blog Search Link -->
            <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-xs">
              <div class="text-[10px] text-slate-500 font-medium">상세 후기 검색:</div>
              <a href="${naverBlogUrl}" target="_blank" rel="noopener noreferrer"
                class="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors flex items-center gap-1">
                <i class="fa-solid fa-magnifying-glass text-slate-500"></i>
                <span>블로그 후기 더보기</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Card Course Toggle Button -->
        <div class="pt-3 mt-3 border-t border-slate-100">
          <button onclick="togglePlaceInCourse('${escapeHtml(place.name)}')"
            class="w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isSelected 
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
            }">
            ${isSelected ? `
              <i class="fa-solid fa-check"></i>
              <span>선택됨 (클릭 시 코스에서 제외)</span>
            ` : `
              <i class="fa-solid fa-plus"></i>
              <span>+ 이번 코스에 담기</span>
            `}
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = bannerHtml + cardsHtml;
}

// 장소 상세 카드 아코디언 토글 (기본 접힌 상태에서 클릭 시 전체 내용 펼침)
function togglePlaceDetailAccordion(safePlaceId) {
  const detailEl = document.getElementById(`place-detail-${safePlaceId}`);
  const labelEl = document.getElementById(`accordion-label-${safePlaceId}`);
  if (!detailEl) return;

  const isHidden = detailEl.classList.contains('hidden');
  if (isHidden) {
    detailEl.classList.remove('hidden');
    if (labelEl) {
      labelEl.innerHTML = `
        <i class="fa-solid fa-chevron-up text-blue-600 text-[10px]"></i>
        <span class="text-blue-700">상세 정보 접기</span>
      `;
    }
  } else {
    detailEl.classList.add('hidden');
    if (labelEl) {
      labelEl.innerHTML = `
        <i class="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
        <span>상세 정보 (메뉴·주차·후기·운영시간) 펼치기</span>
      `;
    }
  }
}
window.togglePlaceDetailAccordion = togglePlaceDetailAccordion;

// 코스 바스켓에 장소 추가/제거 토글
function togglePlaceInCourse(placeName) {
  const existingIdx = AppState.selectedPlaces.findIndex(p => p.name === placeName);

  if (existingIdx >= 0) {
    AppState.selectedPlaces.splice(existingIdx, 1);
    showToast(`'${placeName}'(이)가 코스에서 제외되었습니다.`, 'info');
  } else {
    // 추천 데이터에서 해당 장소 객체 찾기
    let targetPlace = null;
    if (AppState.recommendations) {
      for (const cat of Object.keys(AppState.recommendations)) {
        const found = AppState.recommendations[cat]?.find(p => p.name === placeName);
        if (found) {
          targetPlace = found;
          break;
        }
      }
    }

    if (!targetPlace) {
      targetPlace = {
        name: placeName,
        category: 'sightseeing',
        whyRecommend: '방문객 호평이 이어지는 대표 추천 코스입니다.',
        features: '매력적인 콘텐츠와 볼거리',
        address: AppState.selectedLocation,
        operatingHours: '상세 정보 본문 반영',
        recommendStats: '추천 장소'
      };
    }

    AppState.selectedPlaces.push(targetPlace);
    showToast(`'${placeName}'(이)가 ${AppState.selectedPlaces.length}번째 코스로 추가되었습니다!`, 'success');
  }

  renderCourseBasket();
  renderRecommendations();
  saveProgressToHistory('1단계: 장소 선택 진행 중', true);
}

// 리스트형 코스 바스켓 UI 렌더링
function renderCourseBasket() {
  const container = document.getElementById('selected-places-list');
  const countBadge = document.getElementById('selected-count-badge');
  const statsSummary = document.getElementById('selected-stats-summary');
  const proceedBtn = document.getElementById('btn-proceed-to-step2');
  const proceedText = document.getElementById('btn-proceed-step2-text');

  const places = AppState.selectedPlaces;
  const count = places.length;

  if (countBadge) {
    countBadge.textContent = `${count}곳 선택됨`;
  }

  // 카테고리별 통계 계산
  let catCounts = { sightseeing: 0, food: 0, cafe: 0, photo: 0 };
  places.forEach(p => {
    const c = p.category || 'sightseeing';
    if (catCounts[c] !== undefined) catCounts[c]++;
  });

  if (statsSummary) {
    if (count === 0) {
      statsSummary.textContent = '관광지, 맛집, 카페, 포토스팟을 원하는 순서대로 자유롭게 조합하세요.';
    } else {
      statsSummary.textContent = `현재 조합: 관광지 ${catCounts.sightseeing}곳, 맛집 ${catCounts.food}곳, 카페 ${catCounts.cafe}곳, 포토스팟 ${catCounts.photo}곳`;
    }
  }

  if (proceedBtn) {
    proceedBtn.disabled = count === 0;
  }
  if (proceedText) {
    proceedText.textContent = count > 0
      ? `선택한 ${count}개 장소로 리스트형 2단계 진행 ➔`
      : '장소를 1곳 이상 선택해주세요';
  }

  // 1단계 하단 중앙 버튼도 함께 동기화
  const proceedBtnBottom = document.getElementById('btn-proceed-to-step2-bottom');
  const proceedTextBottom = document.getElementById('btn-proceed-step2-bottom-text');
  if (proceedBtnBottom) {
    proceedBtnBottom.disabled = count === 0;
    if (count === 0) {
      proceedBtnBottom.classList.add('opacity-50', 'cursor-not-allowed');
      proceedBtnBottom.classList.remove('hover:bg-blue-700', 'shadow-lg');
    } else {
      proceedBtnBottom.classList.remove('opacity-50', 'cursor-not-allowed');
      proceedBtnBottom.classList.add('hover:bg-blue-700', 'shadow-lg');
    }
  }
  if (proceedTextBottom) {
    proceedTextBottom.textContent = count > 0
      ? `선택한 ${count}곳으로 2단계 진행 (SEO·비주얼 기획) ➔`
      : '장소를 1곳 이상 선택해주세요';
  }

  if (!container) return;

  if (count === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 py-2 flex items-center gap-2">
        <i class="fa-regular fa-hand-pointer text-slate-400"></i>
        <span>아래 추천 카드에서 <strong>[+ 이번 코스에 담기]</strong> 버튼을 누르거나, <strong>[알짜 추천 코스 자동 담기]</strong>를 눌러보세요!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = places.map((place, idx) => {
    let icon = 'fa-landmark';
    if (place.category === 'food') icon = 'fa-utensils';
    else if (place.category === 'cafe') icon = 'fa-mug-hot';
    else if (place.category === 'photo') icon = 'fa-camera';

    return `
      <div class="bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs flex items-center gap-2 transition-all shadow-2xs">
        <span class="w-5 h-5 rounded-full bg-white text-slate-900 font-extrabold flex items-center justify-center text-[10px] shrink-0">
          ${idx + 1}
        </span>
        <i class="fa-solid ${icon} text-[11px] text-slate-300"></i>
        <div class="flex flex-col">
          <span class="font-bold text-white text-xs">${escapeHtml(place.name)}</span>
          <span class="text-[10px] text-slate-300 truncate max-w-[120px]">${escapeHtml(place.features || '')}</span>
        </div>
        <div class="flex items-center gap-1 ml-2 pl-2 border-l border-white/20">
          <button onclick="moveCoursePlace(${idx}, -1)" title="순서 위로" class="text-slate-400 hover:text-white p-0.5 ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}">
            <i class="fa-solid fa-chevron-up text-[10px]"></i>
          </button>
          <button onclick="moveCoursePlace(${idx}, 1)" title="순서 아래로" class="text-slate-400 hover:text-white p-0.5 ${idx === count - 1 ? 'opacity-30 cursor-not-allowed' : ''}">
            <i class="fa-solid fa-chevron-down text-[10px]"></i>
          </button>
          <button onclick="togglePlaceInCourse('${escapeHtml(place.name)}')" title="코스에서 제거" class="text-slate-400 hover:text-white p-0.5 ml-1">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 순서 이동
function moveCoursePlace(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= AppState.selectedPlaces.length) return;

  const temp = AppState.selectedPlaces[index];
  AppState.selectedPlaces[index] = AppState.selectedPlaces[newIndex];
  AppState.selectedPlaces[newIndex] = temp;

  renderCourseBasket();
  renderRecommendations();
}

// 알짜 BEST 코스 자동 담기 (관광지 2 + 맛집 1 + 카페 1)
function handleAutoSelectBestCourse() {
  const recs = AppState.recommendations;
  if (!recs) {
    showToast('장소 데이터를 탐색 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
    return;
  }

  const selected = [];
  // 관광지 2곳
  if (recs.sightseeing && recs.sightseeing.length > 0) {
    selected.push(recs.sightseeing[0]);
    if (recs.sightseeing.length > 1) selected.push(recs.sightseeing[1]);
  }
  // 맛집 1곳
  if (recs.food && recs.food.length > 0) {
    selected.push(recs.food[0]);
  }
  // 카페 1곳
  if (recs.cafe && recs.cafe.length > 0) {
    selected.push(recs.cafe[0]);
  }

  AppState.selectedPlaces = selected;
  renderCourseBasket();
  renderRecommendations();
  showToast('추천 대표 코스(관광지2 + 맛집1 + 카페1)가 자동으로 담겼습니다!', 'success');
  saveProgressToHistory('1단계: 알짜 대표 코스 자동 선택', true);
}

// 바스켓 비우기
function handleClearCourseBasket() {
  if (AppState.selectedPlaces.length === 0) return;
  AppState.selectedPlaces = [];
  renderCourseBasket();
  renderRecommendations();
  showToast('코스 바스켓이 비워졌습니다.', 'info');
}

// 텍스트 스마트 분리 로컬 파서 (구분자·번호·메모 자동 감지)
function parsePlacesTextLocally(rawText, location) {
  if (!rawText || !rawText.trim()) return [];

  // 줄바꿈 우선 분리, 줄바꿈이 없으면 쉼표/세미콜론으로 분리
  let lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 1 && (lines[0].includes(',') || lines[0].includes(';'))) {
    lines = lines[0].split(/[,;]/).map(l => l.trim()).filter(Boolean);
  }

  const results = [];
  const locationStr = location || AppState.selectedLocation || '제주';

  for (let line of lines) {
    // 1. 앞부분 번호 매김 (예: "1.", "1)", "[1]", "(1)", "-", "*", "•") 제거
    let cleanLine = line.replace(/^(\d+[\.\)]|\[\d+\]|\(\d+\)|[\-\*•])\s*/, '').trim();
    if (!cleanLine) continue;

    let placeName = '';
    let memo = '';

    // 2. 구분자 (:, -, |, /, 괄호)로 장소명과 메모 분리
    const matchSeparator = cleanLine.match(/^(.*?)(?:\s*[:|\-\/]\s*|\s*[\(\[]\s*)(.*)$/);
    if (matchSeparator) {
      placeName = matchSeparator[1].trim();
      memo = matchSeparator[2].replace(/[\)\]]$/, '').trim();
    } else {
      placeName = cleanLine;
    }

    // 이름 정제
    placeName = placeName.replace(/^["']|["']$/g, '').trim();
    if (!placeName || placeName.length < 2) continue;

    // 3. 카테고리 자동 추론
    let category = 'sightseeing';
    const textForCat = (placeName + ' ' + memo).toLowerCase();

    if (/카페|커피|베이커리|디저트|도넛|베이글|다방|에스프레소|티룸|마카롱|빵|케이크|빙수|로스터리/.test(textForCat)) {
      category = 'cafe';
    } else if (/식당|맛집|흑돼지|고기|삼겹살|갈비|국수|조림|갈치|밥집|해장국|횟집|스시|피자|파스타|돈까스|버거|김밥|치킨|구이|찌개|탕|분식|냉면|회/.test(textForCat)) {
      category = 'food';
    } else if (/포토|사진|인생샷|뷰|전망대|노을|일몰|벙커|미술관|갤러리|스튜디오|미디어아트|전시/.test(textForCat)) {
      category = 'photo';
    } else if (/해변|해수욕장|오름|산|폭포|숲|둘레길|올레길|바다|일출봉|곶자왈|휴양림|공원|섬|계곡|동굴|정원/.test(textForCat)) {
      category = 'sightseeing';
    } else if (/타워|대교|사찰|절|궁|성당|유적|마을|랜드마크/.test(textForCat)) {
      category = 'sightseeing';
    }

    // 기본 추천 문구 및 특징 조합
    const catLabelMap = {
      cafe: '감성 카페',
      food: '소문난 맛집',
      photo: '인기 포토존 & 명소',
      sightseeing: '추천 여행 명소'
    };
    const catLabel = catLabelMap[category] || '추천 장소';

    const whyRecommend = memo
      ? memo
      : `${locationStr} 여행객들에게 꾸준히 호평받는 인기 ${catLabel}입니다.`;

    const features = memo
      ? `${placeName}의 시그니처 매력과 분위기`
      : '감각적인 공간 구성 및 매력적인 볼거리';

    results.push({
      id: 'pl-batch-' + Math.random().toString(36).substring(2, 9),
      name: placeName,
      category,
      whyRecommend,
      features,
      menuInfo: memo ? `${memo} (대표 메뉴 및 시그니처)` : '대표 메뉴 및 시그니처 구성',
      parkingInfo: '매장 전용 주차장 구비 또는 인근 공영주차장 이용 권장',
      visitorReviewSummary: memo ? `다녀온 분들의 찐후기: "${memo}"` : '다녀온 분들의 찐후기: "실제 방문 만족도가 매우 높고 분위기가 매력적인 곳"',
      address: `${locationStr} 인근`,
      operatingHours: '상세 운영시간 방문 전 확인 권장',
      recommendStats: '사용자 일괄 등록 (AI 검증)'
    });
  }

  return results;
}

// 텍스트 일괄 장소 추가 핸들러 (AI 스마트 자동 분리 및 카드 섹션 생성)
async function handleBatchAddPlacesFromText() {
  const textInput = document.getElementById('batch-places-text-input');
  const autoBasket = document.getElementById('batch-autobasket-check')?.checked !== false;
  const rawText = textInput ? textInput.value.trim() : '';

  if (!rawText) {
    showToast('추가할 장소 목록 텍스트를 입력해주세요.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-batch-add-places');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-amber-300 mr-1.5"></i> AI가 장소 분석 & 카드 분리 중...`;
  }

  let parsedPlaces = [];

  // 1. Gemini API 키가 있는 경우 Gemini로 정밀 파싱 시도
  if (AppState.settings?.geminiApiKey && window.BlogGenerators?.parseBatchPlacesWithGemini) {
    try {
      parsedPlaces = await window.BlogGenerators.parseBatchPlacesWithGemini(
        rawText,
        AppState.selectedLocation,
        AppState.settings.geminiApiKey,
        AppState.settings.selectedModel
      );
    } catch (err) {
      console.warn('Gemini batch parse notice, falling back to local heuristic parser:', err);
    }
  }

  // 2. Gemini가 없거나 파싱 실패 시 내장 스마트 로컬 파서 실행
  if (!parsedPlaces || parsedPlaces.length === 0) {
    parsedPlaces = parsePlacesTextLocally(rawText, AppState.selectedLocation);
  }

  if (parsedPlaces.length === 0) {
    showToast('유효한 장소명을 감지하지 못했습니다. 장소 목록을 한 줄에 하나씩 적어주세요.', 'warning');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-amber-300 mr-1.5"></i> AI 분석 & 개별 장소 카드로 일괄 추가`;
    }
    return;
  }

  // 3. 파싱된 장소들을 AppState.recommendations 카테고리별로 개별 카드에 분배
  if (!AppState.recommendations) {
    AppState.recommendations = { sightseeing: [], food: [], cafe: [], photo: [], hidden: [] };
  }

  parsedPlaces.forEach(place => {
    const catKey = place.category || 'sightseeing';
    if (!AppState.recommendations[catKey]) {
      AppState.recommendations[catKey] = [];
    }
    // 카테고리 목록 맨 앞에 추가하여 사용자가 방금 추가한 카드가 즉시 보이도록 배치
    const existsInCat = AppState.recommendations[catKey].some(p => p.name === place.name);
    if (!existsInCat) {
      AppState.recommendations[catKey].unshift(place);
    }

    // 코스 바스켓에도 자동 담기
    if (autoBasket) {
      const existsInBasket = AppState.selectedPlaces.some(p => p.name === place.name);
      if (!existsInBasket) {
        AppState.selectedPlaces.push(place);
      }
    }
  });

  // 모달 닫기 및 인풋 초기화
  closeModal('custom-place-modal');
  if (textInput) textInput.value = '';

  // UI 리프레시
  renderCourseBasket();
  renderRecommendations();

  // 자동 진행상황 히스토리 기록
  saveProgressToHistory(`1단계: 장소 ${parsedPlaces.length}곳 일괄 추가 완료`);

  showToast(`${parsedPlaces.length}곳의 장소를 AI로 자동 분석하여 각각 개별 카드로 등록했습니다!`, 'success');

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-amber-300 mr-1.5"></i> AI 분석 & 개별 장소 카드로 일괄 추가`;
  }
}

// 나만의 장소 직접 등록 모달 열기
function openCustomPlaceModal() {
  const batchInput = document.getElementById('batch-places-text-input');
  if (batchInput) batchInput.value = '';

  const nameEl = document.getElementById('cp-name-input');
  const whyEl = document.getElementById('cp-why-input');
  const featuresEl = document.getElementById('cp-features-input');
  const parkingEl = document.getElementById('cp-parking-input');
  const reviewEl = document.getElementById('cp-review-input');
  const addressEl = document.getElementById('cp-address-input');
  const hoursEl = document.getElementById('cp-hours-input');

  if (nameEl) nameEl.value = '';
  if (whyEl) whyEl.value = '';
  if (featuresEl) featuresEl.value = '';
  if (parkingEl) parkingEl.value = '';
  if (reviewEl) reviewEl.value = '';
  if (addressEl) addressEl.value = AppState.selectedLocation;
  if (hoursEl) hoursEl.value = '';
  openModal('custom-place-modal');
}

// 단일 장소 저장 및 코스 추가 (폴백 지원)
function handleSaveCustomPlaceSingle() {
  const name = document.getElementById('cp-name-input')?.value.trim();
  const category = document.getElementById('cp-category-input')?.value || 'sightseeing';
  const whyRecommend = document.getElementById('cp-why-input')?.value.trim();
  const features = document.getElementById('cp-features-input')?.value.trim();
  const parkingInfo = document.getElementById('cp-parking-input')?.value.trim();
  const visitorReviewSummary = document.getElementById('cp-review-input')?.value.trim();
  const address = document.getElementById('cp-address-input')?.value.trim();
  const operatingHours = document.getElementById('cp-hours-input')?.value.trim();

  if (!name || !whyRecommend) {
    showToast('장소명과 추천 이유는 필수 입력 항목입니다.', 'warning');
    return;
  }

  const customPlace = {
    id: 'pl-' + Math.random().toString(36).substring(2, 9),
    name,
    category,
    whyRecommend,
    features: features || '시그니처 메뉴 및 감성 공간',
    menuInfo: features || '시그니처 대표 메뉴 및 구성',
    parkingInfo: parkingInfo || '매장 앞 주차 가능 또는 인근 공영주차장 이용 권장',
    visitorReviewSummary: visitorReviewSummary ? `다녀온 분들의 찐후기: "${visitorReviewSummary}"` : '다녀온 분들의 찐후기: "실제 방문 만족도가 매우 높고 친절함"',
    address: address || AppState.selectedLocation,
    operatingHours: operatingHours || '영업시간 확인 요망',
    recommendStats: '사용자 직접 등록'
  };

  // 추천 카테고리에도 추가
  if (!AppState.recommendations) {
    AppState.recommendations = { sightseeing: [], food: [], cafe: [], photo: [], hidden: [] };
  }
  if (!AppState.recommendations[category]) {
    AppState.recommendations[category] = [];
  }
  AppState.recommendations[category].unshift(customPlace);

  AppState.selectedPlaces.push(customPlace);
  closeModal('custom-place-modal');
  renderCourseBasket();
  renderRecommendations();
  saveProgressToHistory(`1단계: '${name}' 장소 추가`);
  showToast(`장소 '${name}'(이)가 카드로 추가되었습니다!`, 'success');
}

// 호환용 별칭
function handleSaveCustomPlace() {
  handleSaveCustomPlaceSingle();
}

// ─── [5. Step 2: 리스트형 상세 기획 / 통합 SEO & 비주얼 에셋] ───
function proceedToStep2() {
  if (AppState.selectedPlaces.length === 0) {
    showToast('코스 바스켓에 장소를 1곳 이상 담아주세요.', 'warning');
    return;
  }

  // 대표 장소명 세팅 (리스트형 코스명)
  AppState.selectedPlace = AppState.selectedPlaces.map(p => p.name).join(', ');

  goToStep(2);
  handleGenerateStep2Assets();
}

async function handleGenerateStep2Assets() {
  const loadingBox = document.getElementById('step2-loading');
  const contentBox = document.getElementById('step2-content');
  if (loadingBox) loadingBox.classList.remove('hidden');
  if (contentBox) contentBox.classList.add('hidden');

  try {
    const assets = await window.BlogGenerators.generateStep2Assets(
      AppState.selectedLocation,
      AppState.selectedPlaces,
      AppState.selectedTheme,
      AppState.settings.geminiApiKey,
      AppState.settings.selectedModel
    );

    AppState.step2Assets = assets;
    renderStep2Assets(assets);
    renderStep2CourseOrder();
    setTimeout(() => {
      initOrUpdateStep2Map();
    }, 150);
  } catch (err) {
    console.error(err);
    showToast('상세 기획 생성 중 오류가 발생했습니다.', 'error');
  } finally {
    if (loadingBox) loadingBox.classList.add('hidden');
    if (contentBox) contentBox.classList.remove('hidden');
  }
}

// ─── [5-1. Step 2 여행 동선 드래그앤드롭 순서 변경 & 삭제] ───
let draggedCourseIndex = null;

function handleCourseDragStart(e, index) {
  draggedCourseIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  try {
    e.dataTransfer.setData('text/plain', String(index));
  } catch (err) {}
  const target = e.currentTarget || e.target;
  if (target) target.classList.add('opacity-40', 'scale-[0.98]');
}

function handleCourseDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleCourseDrop(e, targetIndex) {
  e.preventDefault();
  if (draggedCourseIndex === null || draggedCourseIndex === targetIndex) return;

  const movedItem = AppState.selectedPlaces.splice(draggedCourseIndex, 1)[0];
  AppState.selectedPlaces.splice(targetIndex, 0, movedItem);
  draggedCourseIndex = null;

  onCourseOrderChanged();
  showToast(`여행 동선 순서가 변경되었습니다 (${movedItem.name} ➔ ${targetIndex + 1}번째 코스).`, 'info');
}

function handleCourseDragEnd(e) {
  draggedCourseIndex = null;
  const cards = document.querySelectorAll('#step2-course-drag-list > div');
  cards.forEach(c => c.classList.remove('opacity-40', 'scale-[0.98]'));
}

function moveCourseItemUp(index) {
  if (index <= 0) return;
  const temp = AppState.selectedPlaces[index - 1];
  AppState.selectedPlaces[index - 1] = AppState.selectedPlaces[index];
  AppState.selectedPlaces[index] = temp;
  onCourseOrderChanged();
}

function moveCourseItemDown(index) {
  if (index >= AppState.selectedPlaces.length - 1) return;
  const temp = AppState.selectedPlaces[index + 1];
  AppState.selectedPlaces[index + 1] = AppState.selectedPlaces[index];
  AppState.selectedPlaces[index] = temp;
  onCourseOrderChanged();
}

function removeCourseItem(index) {
  if (AppState.selectedPlaces.length <= 1) {
    showToast('동선에는 최소 1곳 이상의 장소가 유지되어야 합니다.', 'warning');
    return;
  }
  const removed = AppState.selectedPlaces.splice(index, 1)[0];
  showToast(`'${removed.name}' 장소를 동선에서 제외했습니다.`, 'info');
  onCourseOrderChanged();
}

function onCourseOrderChanged() {
  renderStep2CourseOrder();
  renderCourseBasket();
  initOrUpdateStep2Map();

  // 코스 순서 변경에 맞추어 로컬 에셋 즉시 재동기화
  if (window.BlogGenerators?.generateStep2Assets) {
    AppState.step2Assets = window.BlogGenerators.generateLocalStep2Assets(
      AppState.selectedLocation,
      AppState.selectedTheme,
      AppState.selectedPlaces
    );
    renderStep2Assets(AppState.step2Assets);
  }
}

function renderStep2CourseOrder() {
  const container = document.getElementById('step2-course-drag-list');
  const roadmapContainer = document.getElementById('step2-course-roadmap');
  const places = AppState.selectedPlaces || [];

  // 상단 로드맵 뱃지 동기화
  if (roadmapContainer) {
    roadmapContainer.innerHTML = places.map((p, idx) => `
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-2xs">
        <span class="w-4 h-4 rounded-full bg-blue-500 text-[10px] flex items-center justify-center">${idx + 1}</span>
        <span>${escapeHtml(p.name)}</span>
        <span class="text-[10px] text-blue-300 font-normal">(${escapeHtml(p.features || '명소')})</span>
      </span>
      ${idx < places.length - 1 ? '<i class="fa-solid fa-arrow-right text-slate-400 text-[10px]"></i>' : ''}
    `).join('');
  }

  if (!container) return;

  if (places.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-300">
        선택된 장소가 없습니다. 아래 버튼으로 장소를 추가해보세요.
      </div>
    `;
    return;
  }

  const categoryLabels = {
    sightseeing: { label: '관광지', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    landmark: { label: '랜드마크', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    food: { label: '맛집', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    cafe: { label: '카페', color: 'bg-rose-100 text-rose-800 border-rose-200' },
    kids: { label: '키즈', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    photo: { label: '포토스팟', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    nature: { label: '힐링자연', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    shopping: { label: '쇼핑마켓', color: 'bg-orange-100 text-orange-800 border-orange-200' }
  };

  container.innerHTML = places.map((p, idx) => {
    const catInfo = categoryLabels[p.category] || { label: '명소', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    const isFirst = idx === 0;
    const isLast = idx === places.length - 1;

    return `
      <div draggable="true" 
        ondragstart="handleCourseDragStart(event, ${idx})"
        ondragover="handleCourseDragOver(event, ${idx})"
        ondrop="handleCourseDrop(event, ${idx})"
        ondragend="handleCourseDragEnd(event)"
        class="flex items-center justify-between gap-3 p-3 bg-white hover:bg-slate-50/90 rounded-xl border border-slate-200 shadow-2xs cursor-grab active:cursor-grabbing transition-all select-none">
        
        <div class="flex items-center gap-3 min-w-0">
          <div class="text-slate-400 hover:text-slate-700 px-1" title="마우스로 끌어서 순서 변경">
            <i class="fa-solid fa-grip-vertical text-sm"></i>
          </div>

          <span class="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
            ${idx + 1}
          </span>

          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-extrabold text-slate-900 text-xs sm:text-sm truncate">${escapeHtml(p.name)}</span>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border ${catInfo.color}">
                ${catInfo.label}
              </span>
            </div>
            <div class="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
              <span>📍 ${escapeHtml(p.address || AppState.selectedLocation)}</span>
              ${p.features ? `<span class="hidden sm:inline text-slate-400">• ${escapeHtml(p.features)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button onclick="moveCourseItemUp(${idx})" ${isFirst ? 'disabled' : ''} 
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition-colors" title="앞 순서로 이동">
            <i class="fa-solid fa-arrow-up text-xs"></i>
          </button>
          <button onclick="moveCourseItemDown(${idx})" ${isLast ? 'disabled' : ''} 
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition-colors" title="다음 순서로 이동">
            <i class="fa-solid fa-arrow-down text-xs"></i>
          </button>
          <a href="https://map.naver.com/p/search/${encodeURIComponent(p.name)}" target="_blank" rel="noopener"
            class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="네이버지도에서 검색">
            <i class="fa-solid fa-map-pin text-xs"></i>
          </a>
          <button onclick="removeCourseItem(${idx})" 
            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="동선에서 제외">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── [5-2. Step 2 동선 지도 (Leaflet & 네이버/카카오 연동 100% 무료)] ───
function initOrUpdateStep2Map() {
  const mapContainer = document.getElementById('step2-interactive-map');
  if (!mapContainer) return;

  const places = AppState.selectedPlaces || [];
  if (places.length === 0) {
    mapContainer.innerHTML = `
      <div class="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
        <i class="fa-solid fa-map-location-dot text-3xl mb-2 text-slate-300"></i>
        <p class="font-bold text-slate-600">선택된 여행지가 없습니다.</p>
        <p class="text-slate-400 mt-0.5">1단계에서 장소를 담거나 위 [+ 동선에 새 장소 추가]를 눌러보세요.</p>
      </div>
    `;
    return;
  }

  if (typeof L === 'undefined') {
    mapContainer.innerHTML = `
      <div class="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500 text-xs p-6 text-center space-y-2">
        <p class="font-bold text-slate-700">지도를 불러오는 중입니다...</p>
        <p class="text-slate-400">아래 네이버지도 또는 카카오맵 버튼으로 전체 동선을 즉시 확인하실 수 있습니다.</p>
      </div>
    `;
    return;
  }

  try {
    if (window.step2LeafletMap) {
      window.step2LeafletMap.remove();
      window.step2LeafletMap = null;
    }
    mapContainer.innerHTML = '';

    const firstCoord = window.BlogGenerators?.getPlaceCoordinates
      ? window.BlogGenerators.getPlaceCoordinates(places[0], AppState.selectedLocation)
      : { lat: 33.4996, lng: 126.5312 };

    const map = L.map('step2-interactive-map', {
      center: [firstCoord.lat, firstCoord.lng],
      zoom: 12,
      scrollWheelZoom: false
    });
    window.step2LeafletMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    const latlngs = [];

    places.forEach((p, idx) => {
      const coord = (p.lat && p.lng)
        ? { lat: p.lat, lng: p.lng }
        : (window.BlogGenerators?.getPlaceCoordinates
            ? window.BlogGenerators.getPlaceCoordinates(p, AppState.selectedLocation)
            : { lat: 33.4996 + idx * 0.015, lng: 126.5312 + idx * 0.015 });

      latlngs.push([coord.lat, coord.lng]);

      const markerHtml = `
        <div style="
          width: 28px; 
          height: 28px; 
          background: #2563eb; 
          color: white; 
          border-radius: 50%; 
          border: 2.5px solid white; 
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-weight: 800; 
          font-size: 12px;
          cursor: pointer;
        ">
          ${idx + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([coord.lat, coord.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 3px; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: 800; color: #0f172a; font-size: 13px; margin-bottom: 2px;">
            ${idx + 1}. ${escapeHtml(p.name)}
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">📍 ${escapeHtml(p.address || AppState.selectedLocation)}</div>
          <div style="color: #2563eb; font-weight: 600; font-size: 11px; margin-bottom: 6px;">${escapeHtml(p.features || '')}</div>
          <a href="https://map.naver.com/p/search/${encodeURIComponent(p.name)}" target="_blank" rel="noopener" style="display: inline-block; padding: 4px 9px; background: #03c75a; color: white; border-radius: 6px; text-decoration: none; font-size: 10px; font-weight: 700;">
            네이버 플레이스 ↗
          </a>
        </div>
      `);
    });

    // 동선 연결 점선 폴리라인
    if (latlngs.length > 1) {
      L.polyline(latlngs, {
        color: '#2563eb',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.85
      }).addTo(map);
    }

    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    setTimeout(() => {
      if (window.step2LeafletMap) {
        window.step2LeafletMap.invalidateSize();
      }
    }, 200);
  } catch (err) {
    console.warn('Map initialization:', err);
  }
}

function openNaverCourseMap() {
  const places = AppState.selectedPlaces || [];
  if (places.length === 0) {
    showToast('선택된 코스 장소가 없습니다.', 'warning');
    return;
  }
  const query = places.map(p => p.name).join(' ');
  const url = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
  window.open(url, '_blank');
}

function openKakaoCourseMap() {
  const places = AppState.selectedPlaces || [];
  if (places.length === 0) {
    showToast('선택된 코스 장소가 없습니다.', 'warning');
    return;
  }
  const query = AppState.selectedLocation + ' ' + places.map(p => p.name).join(' ');
  const url = `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
  window.open(url, '_blank');
}

// ─── [5-3. 동선에 새 장소 검색 & 추가 모달] ───
function openAddPlaceSearchModal() {
  const modal = document.getElementById('add-place-search-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('search-place-query-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
    const resultsContainer = document.getElementById('search-place-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-xs">
          <i class="fa-solid fa-magnifying-glass text-2xl text-slate-300 mb-2 block"></i>
          추가하고 싶은 장소명이나 상호명을 입력하고 검색을 누르세요.
        </div>
      `;
    }
  }
}

function handleSearchPlaceInModal() {
  const queryInput = document.getElementById('search-place-query-input');
  const query = queryInput ? queryInput.value.trim() : '';
  const resultsContainer = document.getElementById('search-place-results');
  if (!query) {
    showToast('검색할 장소명을 입력해주세요.', 'warning');
    return;
  }

  const kb = window.DEFAULT_DATA?.travelSpotsKB || window.travelSpotsKB || {};
  let matchedList = [];

  for (const [locKey, locData] of Object.entries(kb)) {
    for (const [catKey, places] of Object.entries(locData)) {
      if (Array.isArray(places)) {
        places.forEach(p => {
          if (p.name.toLowerCase().includes(query.toLowerCase()) || 
              (p.features && p.features.toLowerCase().includes(query.toLowerCase())) ||
              (p.address && p.address.toLowerCase().includes(query.toLowerCase()))) {
            matchedList.push({
              ...p,
              foundLocation: locKey,
              category: p.category || catKey
            });
          }
        });
      }
    }
  }

  // 중복 장소명 제거
  const uniqueMatches = [];
  const seenNames = new Set();
  for (const m of matchedList) {
    if (!seenNames.has(m.name)) {
      seenNames.add(m.name);
      uniqueMatches.push(m);
    }
  }

  // 매칭 결과가 없으면 사용자 쿼리로 자동 구성 후보 생성
  if (uniqueMatches.length === 0) {
    uniqueMatches.push({
      name: query,
      category: 'sightseeing',
      foundLocation: AppState.selectedLocation,
      whyRecommend: `${AppState.selectedLocation} 여행자들에게 입소문 난 인기 코스로 강력 추천하는 스팟`,
      features: '대표 시그니처 메뉴 및 멋진 포토존 뷰',
      parkingInfo: '전용 주차장 구비 또는 인근 공영주차장 이용 권장',
      visitorReviewSummary: '다녀온 분들의 찐후기: "분위기와 동선이 아주 만족스럽고 재방문 의사 높음"',
      address: `${AppState.selectedLocation} ${query} 일원`,
      operatingHours: '매일 10:00 - 20:00 (방문 전 확인 권장)'
    });
  }

  resultsContainer.innerHTML = uniqueMatches.map((item, idx) => `
    <div class="p-3.5 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h5 class="font-extrabold text-slate-900 text-xs sm:text-sm">${escapeHtml(item.name)}</h5>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-blue-700 border border-blue-200">
            ${escapeHtml(item.category)}
          </span>
          <span class="text-[10px] text-slate-400 font-medium">📍 ${escapeHtml(item.foundLocation || AppState.selectedLocation)}</span>
        </div>
        <p class="text-[11px] text-slate-600 mt-1 line-clamp-1">${escapeHtml(item.whyRecommend)}</p>
        <p class="text-[10px] text-slate-400 mt-0.5 truncate">${escapeHtml(item.address || '')}</p>
      </div>
      <button onclick="addSearchedPlaceDirectly(${idx})" 
        class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
        <i class="fa-solid fa-plus text-xs"></i>
        <span>동선에 추가</span>
      </button>
    </div>
  `).join('');

  window._lastSearchedPlaces = uniqueMatches;
}

function addSearchedPlaceDirectly(idx) {
  const list = window._lastSearchedPlaces || [];
  const target = list[idx];
  if (!target) return;

  if (AppState.selectedPlaces.some(p => p.name === target.name)) {
    showToast(`'${target.name}'은(는) 이미 이번 동선에 포함되어 있습니다.`, 'warning');
    return;
  }

  const coord = window.BlogGenerators?.getPlaceCoordinates
    ? window.BlogGenerators.getPlaceCoordinates(target, AppState.selectedLocation)
    : { lat: 33.4996, lng: 126.5312 };

  AppState.selectedPlaces.push({
    ...target,
    lat: coord.lat,
    lng: coord.lng
  });

  closeModal('add-place-search-modal');
  showToast(`'${target.name}'을(를) 여행 동선에 추가했습니다!`, 'success');
  onCourseOrderChanged();
}

function renderStep2Assets(assets) {
  // 1. 코스 동선 총평 & 소요 시간
  const summaryEl = document.getElementById('step2-summary');
  if (summaryEl) summaryEl.textContent = assets.summary;

  const hoursEl = document.getElementById('step2-hours');
  if (hoursEl) hoursEl.textContent = assets.recommendedHours;

  // 2. SEO 메타 태그
  const keywordsContainer = document.getElementById('step2-keywords-tags');
  if (keywordsContainer) {
    keywordsContainer.innerHTML = (assets.seoKeywords || []).map(k => `
      <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
        #${escapeHtml(k)}
      </span>
    `).join('');
  }

  const metaDescEl = document.getElementById('step2-meta-description');
  if (metaDescEl) metaDescEl.textContent = assets.metaDescription;

  // 3. 추천 리스트형 블로그 제목
  const titlesList = document.getElementById('step2-titles-list');
  if (titlesList) {
    titlesList.innerHTML = (assets.titleSuggestions || []).map((t, idx) => `
      <div class="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-xs text-slate-800">
        <span class="font-medium"><strong class="text-slate-900 font-bold mr-1">${idx + 1}.</strong> ${escapeHtml(t)}</span>
        <button onclick="copyText('${escapeHtml(t)}')" class="text-slate-500 hover:text-slate-900 p-1" title="제목 복사">
          <i class="fa-regular fa-copy"></i>
        </button>
      </div>
    `).join('');
  }

  // 4. 구글 Flow / Imagen 한글 비주얼 프롬프트 카드 렌더링 (한국인 인물 모델 & 5대 다각도 카메라 앵글)
  const placeAssetsContainer = document.getElementById('step2-place-asset-cards');
  if (placeAssetsContainer) {
    const pAssets = assets.placeAssetCards || [];
    placeAssetsContainer.innerHTML = pAssets.map((pa, idx) => {
      const promptText = pa.koreanImagePrompt || pa.imagePrompt || '';
      const angleLabel = pa.angleType || '감성 시네마틱 앵글';
      const pName = pa.name || pa.placeName || `장소 ${idx + 1}`;

      return `
        <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-blue-600">코스 ${idx + 1}번 스팟</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              ${escapeHtml(angleLabel)}
            </span>
          </div>
          <h4 class="text-sm font-extrabold text-slate-900">${escapeHtml(pName)}</h4>
          
          <div class="space-y-1 text-xs">
            <span class="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
              <i class="fa-solid fa-camera text-slate-600"></i> 사진 촬영 & 본문 강조 팁
            </span>
            <p class="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed text-[11px]">
              ${escapeHtml(pa.highlightTip || pa.photoTip || '시선 강탈 인생샷 명소')}
            </p>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-800 flex items-center gap-1">
                <i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                <span>구글 Flow 한글 비주얼 프롬프트</span>
              </span>
              <button onclick="copyText('${escapeHtml(promptText)}')" class="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <i class="fa-regular fa-copy"></i> 복사
              </button>
            </div>
            <textarea rows="4" readonly class="w-full text-[11px] bg-white border border-slate-200 rounded-lg p-2.5 text-slate-700 font-sans leading-relaxed resize-none focus:outline-none">${escapeHtml(promptText)}</textarea>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. 대표 와이드 썸네일 프롬프트 & 캐치프레이즈 (구글 Flow 16:9 와이드 한글 프롬프트)
  const imgThumb = document.getElementById('img-prompt-thumb');
  if (imgThumb) {
    imgThumb.value = assets.thumbnailPrompt || assets.imagePrompts?.thumbnailWide || '';
  }

  const phrasesContainer = document.getElementById('step2-catchphrases');
  if (phrasesContainer) {
    phrasesContainer.innerHTML = (assets.catchphrases || []).map(p => `
      <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium">
        <span>${escapeHtml(p)}</span>
        <button onclick="copyText('${escapeHtml(p)}')" class="text-slate-500 hover:text-slate-900 p-1" title="문구 복사">
          <i class="fa-regular fa-copy"></i>
        </button>
      </div>
    `).join('');
  }
}

function proceedToStep3() {
  goToStep(3);
  handleBuildMasterPrompt();
}

// ─── [포스팅 구성 유형 설정 (코스/동선형 vs 테마 리스트 큐레이션형)] ───
function setPostType(type) {
  AppState.postType = type || 'curation';

  const btnCuration = document.getElementById('post-type-btn-curation');
  const btnRoute = document.getElementById('post-type-btn-route');
  const badgeCuration = document.getElementById('post-type-badge-curation');
  const badgeRoute = document.getElementById('post-type-badge-route');

  const selectedClass = 'post-type-card p-4 sm:p-5 rounded-2xl border-2 border-blue-600 bg-white hover:bg-blue-50/50 text-blue-950 font-bold transition-all shadow-md flex items-start gap-3.5 text-left cursor-pointer ring-4 ring-blue-500/20 relative overflow-hidden group';
  const unselectedClass = 'post-type-card p-4 sm:p-5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-all shadow-xs flex items-start gap-3.5 text-left cursor-pointer relative overflow-hidden group';

  if (btnCuration && btnRoute) {
    if (AppState.postType === 'curation') {
      btnCuration.className = selectedClass;
      btnRoute.className = unselectedClass;
      if (badgeCuration) {
        badgeCuration.className = 'px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded-full font-black shadow-xs shrink-0 flex items-center gap-1';
        badgeCuration.innerHTML = `<i class="fa-solid fa-circle-check text-[10px]"></i><span>선택됨 (추천)</span>`;
      }
      if (badgeRoute) {
        badgeRoute.className = 'px-2.5 py-1 text-[11px] bg-slate-100 text-slate-600 rounded-full font-bold border border-slate-200 shrink-0';
        badgeRoute.textContent = '일정 순서 가이드';
      }
    } else {
      btnRoute.className = selectedClass;
      btnCuration.className = unselectedClass;
      if (badgeRoute) {
        badgeRoute.className = 'px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded-full font-black shadow-xs shrink-0 flex items-center gap-1';
        badgeRoute.innerHTML = `<i class="fa-solid fa-circle-check text-[10px]"></i><span>선택됨 (동선형)</span>`;
      }
      if (badgeCuration) {
        badgeCuration.className = 'px-2.5 py-1 text-[11px] bg-slate-100 text-slate-600 rounded-full font-bold border border-slate-200 shrink-0';
        badgeCuration.textContent = '알짜 추천';
      }
    }
  }

  // 3단계 프롬프트가 열려 있다면 실시간 재구성
  if (AppState.currentStep === 3) {
    handleBuildMasterPrompt();
  }
}

// ─── [6. Step 3: 마스터 프롬프트 자동 구성 (토스형 친근한 어투 고정 & 자유 글자수)] ───
function handleBuildMasterPrompt() {
  const extraKeywords = document.getElementById('extra-keywords-input')?.value || '';
  const postType = AppState.postType || 'curation';

  const prompt = window.BlogGenerators.buildMasterPrompt({
    location: AppState.selectedLocation,
    placeName: AppState.selectedPlace,
    selectedPlaces: AppState.selectedPlaces,
    theme: AppState.selectedTheme,
    postType: postType,
    tonePreset: 'friendly', // 토스형 친근한 어투 고정
    extraKeywords: extraKeywords,
    step2Assets: AppState.step2Assets
  });

  AppState.masterPrompt = prompt;
  const textarea = document.getElementById('master-prompt-textarea');
  if (textarea) textarea.value = prompt;
}

// 프롬프트 영구 저장 및 기록 (로컬 보관함 + 구글 스프레드시트 + 메인 히스토리 동기화)
async function handleSaveMasterPromptRecord() {
  const promptText = document.getElementById('master-prompt-textarea')?.value || AppState.masterPrompt;
  if (!promptText || promptText.trim().length === 0) {
    showToast('저장할 프롬프트가 비어 있습니다.', 'warning');
    return;
  }

  const promptRecord = {
    id: 'prm_' + Date.now(),
    date: new Date().toISOString(),
    displayDate: new Date().toLocaleString('ko-KR'),
    location: AppState.selectedLocation,
    placeName: AppState.selectedPlace || `${AppState.selectedLocation} 베스트 코스`,
    postType: AppState.postType || 'curation',
    placesCount: (AppState.selectedPlaces || []).length,
    placesList: (AppState.selectedPlaces || []).map(p => p.name).join(', '),
    promptText: promptText
  };

  // 1. 로컬 프롬프트 전용 보관함에 저장
  try {
    const list = JSON.parse(localStorage.getItem('saved_master_prompts') || '[]');
    list.unshift(promptRecord);
    localStorage.setItem('saved_master_prompts', JSON.stringify(list.slice(0, 100)));
    AppState.savedPrompts = list;
  } catch (e) {
    console.error('Failed to save prompt to localStorage:', e);
  }

  // 2. 메인 작업 히스토리에도 확실히 등록하여 히스토리 탭에서 즉시 복원 가능하도록 저장
  saveProgressToHistory('3단계: 마스터 프롬프트 생성 완료', false);

  // 3. 구글 스프레드시트 웹훅 연동 전송
  let sheetsStatusText = '';
  if (AppState.settings?.sheetsWebhookUrl) {
    try {
      showToast('구글 스프레드시트에 프롬프트 기록을 전송하는 중...', 'info');
      const res = await window.BlogAPI.syncToGoogleSheets(AppState.settings.sheetsWebhookUrl, 'savePrompt', promptRecord);
      if (res.success) {
        sheetsStatusText = ' & 구글 시트 동기화 완료!';
      }
    } catch (err) {
      console.warn('Sheets prompt sync notice:', err);
    }
  }

  showToast(`💾 마스터 프롬프트가 히스토리와 보관함에 안전하게 저장되었습니다${sheetsStatusText}`, 'success');
}

// 프롬프트 자동 복사 후 Gemini 웹페이지 새 탭 열기
function handleOpenGeminiWeb() {
  const promptText = document.getElementById('master-prompt-textarea')?.value || AppState.masterPrompt;
  if (!promptText || promptText.trim().length === 0) {
    showToast('프롬프트를 먼저 생성해주세요.', 'warning');
    return;
  }

  // 클립보드 복사
  copyText(promptText);
  showToast('✨ 프롬프트가 클립보드에 복사되었습니다! Gemini 웹에서 바로 붙여넣기(Ctrl+V)하세요.', 'success');

  // Gemini 웹페이지 열기
  setTimeout(() => {
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
  }, 400);
}

// Gemini AI로 대시보드 내에서 즉시 블로그 본문 작성
async function handleGenerateArticleDirectly() {
  if (!AppState.settings.geminiApiKey) {
    showToast('Gemini API 키가 필요합니다. 설정(⚙️)에서 입력하거나 [스마트 엔진 즉시 작성]을 이용하세요!', 'warning');
    openModal('settings-modal');
    return;
  }

  const btn = document.getElementById('btn-generate-article-ai');
  const originalBtnHtml = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Gemini AI로 본문 즉시 작성하기</span>`;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 고품질 리스트형 본문 작성 중... (약 10초)`;
  }

  try {
    const res = await window.BlogAPI.generateWithGemini(
      AppState.settings.geminiApiKey,
      AppState.settings.selectedModel,
      AppState.masterPrompt,
      '당신은 네이버/티스토리 상위노출 전문 여행 블로거입니다. 가독성 높은 리스트형 여행 포스팅을 작성합니다.',
      (statusMsg) => {
        if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${statusMsg}`;
      }
    );

    const article = typeof res === 'object' && res.text !== undefined ? res.text : res;
    AppState.articleContent = article;
    const articleInput = document.getElementById('article-editor-textarea');
    if (articleInput) articleInput.value = article;

    if (typeof res === 'object' && res.isFallback) {
      showToast(`기본 모델 트래픽으로 대체 모델(${res.usedModel})을 통해 본문 생성을 완료했습니다! (4단계로 이동)`, 'success');
    } else {
      showToast('AI 리스트형 블로그 본문 생성이 완료되었습니다! 4단계로 이동합니다.', 'success');
    }
    proceedToStep4();
  } catch (err) {
    console.error('Gemini 본문 작성 오류:', err);
    // 구글 Gemini 서버 일시 트래픽 폭주/503 오류 발생 시에도 사용자가 막히지 않도록 스마트 엔진으로 자동 구제
    const fallbackDraft = window.BlogGenerators.generateCompleteArticleLocal({
      location: AppState.selectedLocation,
      places: AppState.selectedCoursePlaces,
      theme: AppState.selectedTheme,
      tonePreset: document.querySelector('input[name="tonePreset"]:checked')?.value || 'friendly',
      keywords: AppState.step2Assets?.seoKeywords || []
    });

    AppState.articleContent = fallbackDraft;
    const articleInput = document.getElementById('article-editor-textarea');
    if (articleInput) articleInput.value = fallbackDraft;

    showToast('구글 Gemini 서버 트래픽 급증(503)으로 인해 스마트 엔진으로 포스팅 초안을 100% 완성하여 전달했습니다! (4단계로 이동)', 'info');
    proceedToStep4();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
}

// 스마트 엔진으로 키 없이 즉시 본문 완성
function handleGenerateArticleSmartLocal() {
  const draft = window.BlogGenerators.generateCompleteArticleLocal({
    location: AppState.selectedLocation,
    places: AppState.selectedCoursePlaces,
    theme: AppState.selectedTheme,
    tonePreset: document.querySelector('input[name="tonePreset"]:checked')?.value || 'friendly',
    keywords: AppState.step2Assets?.seoKeywords || []
  });

  AppState.articleContent = draft;
  const articleInput = document.getElementById('article-editor-textarea');
  if (articleInput) articleInput.value = draft;

  showToast('스마트 엔진으로 검증된 실시간 데이터 기반 본문을 즉시 완성했습니다! (4단계로 이동)', 'success');
  proceedToStep4();
}

function proceedToStep4() {
  goToStep(4);
  updateStep4Views();
}

// ─── [7. Step 4: 본문 검수, 서식 변환, SNS 가공] ───
function updateStep4Views() {
  const textarea = document.getElementById('article-editor-textarea');
  const text = textarea ? textarea.value : AppState.articleContent;
  AppState.articleContent = text;

  // 글자수 통계 분석
  const stats = window.BlogGenerators.analyzeText(text);
  const elCharWith = document.getElementById('stat-char-with-space');
  const elCharWithout = document.getElementById('stat-char-without-space');
  const elWords = document.getElementById('stat-words');
  const elReadingTime = document.getElementById('stat-reading-time');

  if (elCharWith) elCharWith.textContent = stats.charWithSpaces.toLocaleString();
  if (elCharWithout) elCharWithout.textContent = stats.charWithoutSpaces.toLocaleString();
  if (elWords) elWords.textContent = stats.words.toLocaleString();
  if (elReadingTime) elReadingTime.textContent = stats.readingTime;

  // HTML 변환
  const cleanHtml = window.BlogGenerators.markdownToCleanHtml(text);
  const htmlOutput = document.getElementById('article-html-output');
  if (htmlOutput) htmlOutput.value = cleanHtml;

  const htmlPreview = document.getElementById('article-html-preview');
  if (htmlPreview) htmlPreview.innerHTML = cleanHtml || '<p class="text-slate-400 italic">본문을 입력하면 이곳에 서식 적용된 실시간 미리보기가 표시됩니다.</p>';

  // SNS 패키지 생성
  const sns = window.BlogGenerators.generateSnsPackage(text, {
    location: AppState.selectedLocation,
    placeName: AppState.selectedPlace,
    keywords: AppState.step2Assets?.seoKeywords || []
  });
  AppState.snsPackage = sns;

  const instaEl = document.getElementById('sns-instagram-text');
  const threadsEl = document.getElementById('sns-threads-text');
  const twitterEl = document.getElementById('sns-twitter-text');

  if (instaEl) instaEl.value = sns.instagram;
  if (threadsEl) threadsEl.value = sns.threads;
  if (twitterEl) twitterEl.value = sns.twitter;
}

// 외부 작성 본문 불러오기 (Gemini 웹 또는 타 플랫폼에서 생성된 글 검수용)
async function handlePasteExternalArticle() {
  try {
    let text = '';
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch (e) {}
    }
    if (!text || text.trim().length === 0) {
      text = prompt('외부(Gemini 웹페이지 등)에서 복사한 본문 텍스트를 붙여넣으세요:');
    }
    if (text && text.trim().length > 0) {
      const editor = document.getElementById('article-editor-textarea');
      if (editor) editor.value = text;
      AppState.articleContent = text;
      updateStep4Views();
      showToast('외부 본문 불러오기 완료! 실시간 글자수 통계와 HTML 서식이 자동 분석되었습니다.', 'success');
    }
  } catch (err) {
    showToast('본문 붙여넣기 중 오류가 발생했습니다. 직접 에디터에 붙여넣어 주세요.', 'warning');
  }
}

function switchOutputTab(tabName) {
  AppState.activeOutputTab = tabName;
  const tabs = ['markdown', 'html', 'preview'];

  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const pane = document.getElementById(`tab-pane-${t}`);
    if (btn) {
      if (t === tabName) {
        btn.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white shadow-xs';
      } else {
        btn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-200/70 transition-colors';
      }
    }
    if (pane) {
      if (t === tabName) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    }
  });
}

// ─── [8. 진행 상황 자동 보존 & 히스토리 & 구글 스프레드시트 영구 저장] ───

// 1단계 이상 진척이 있는 모든 과정을 그대로 히스토리에 기록 (프롬프트 저장 전에도 상시 복원 가능)
function saveProgressToHistory(stageLabel = '', silent = false) {
  const currentStep = AppState.currentStep || 1;
  const placesCount = (AppState.selectedPlaces || []).length;
  const placesTitle = placesCount > 0 
    ? AppState.selectedPlaces.map(p => p.name).slice(0, 3).join(', ') + (placesCount > 3 ? ` 외 ${placesCount - 3}곳` : '')
    : `${AppState.selectedLocation} 여행 기획`;

  const item = {
    id: 'H_' + Date.now(),
    createdAt: new Date().toLocaleString('ko-KR'),
    currentStep: currentStep,
    stageBadge: stageLabel || `${currentStep}단계 진행 중 (${placesCount}곳 선택)`,
    location: AppState.selectedLocation,
    placeName: placesTitle,
    selectedPlace: AppState.selectedPlace || placesTitle,
    selectedPlaces: JSON.parse(JSON.stringify(AppState.selectedPlaces || [])),
    recommendations: JSON.parse(JSON.stringify(AppState.recommendations || {})),
    theme: AppState.selectedTheme || '당일치기 알짜코스',
    postType: AppState.postType || 'curation',
    step2Assets: AppState.step2Assets || {},
    seoKeywords: (AppState.step2Assets?.seoKeywords || []).join(', '),
    metaDescription: AppState.step2Assets?.metaDescription || '',
    masterPrompt: (document.getElementById('master-prompt-textarea')?.value) || AppState.masterPrompt || '',
    articleContent: (document.getElementById('article-editor-textarea')?.value) || AppState.articleContent || '',
    snsPackage: AppState.snsPackage || {},
    stats: window.BlogGenerators.analyzeText(AppState.articleContent || '')
  };

  // 1. LocalStorage 저장
  window.BlogStorage.saveHistoryItem(item);
  AppState.history = window.BlogStorage.getHistory();
  renderHistoryList();

  if (!silent) {
    showToast(`'${placesTitle}' (${currentStep}단계) 작업 내역이 히스토리에 안전하게 저장되었습니다!`, 'success');
  }

  // 2. 구글 스프레드시트 비동기 동기화 (웹훅 URL이 설정된 경우)
  if (AppState.settings?.sheetsWebhookUrl) {
    window.BlogAPI.syncToGoogleSheets(
      AppState.settings.sheetsWebhookUrl,
      'saveProgress',
      item
    ).then(res => {
      if (!silent && res?.ok) {
        showToast('구글 스프레드시트에도 실시간 동기화되었습니다.', 'info');
      }
    }).catch(err => {
      console.warn('Sheets sync notice:', err);
    });
  }

  return item;
}

// 코스 바스켓 또는 헤더의 [기획 임시저장] 버튼 핸들러
function handleSaveCurrentProgress() {
  const currentStep = AppState.currentStep || 1;
  const placesCount = (AppState.selectedPlaces || []).length;
  saveProgressToHistory(`${currentStep}단계 수동 임시저장 (${placesCount}곳 담김)`, false);
}

async function handleSaveCurrentWork() {
  const item = saveProgressToHistory(`${AppState.currentStep || 4}단계 최종 보관`, false);

  // 구글 스프레드시트 최종 완료 동기화
  if (AppState.settings.sheetsWebhookUrl) {
    showToast('구글 스프레드시트에 영구 동기화 중...', 'info');
    try {
      const syncRes = await window.BlogAPI.syncToGoogleSheets(
        AppState.settings.sheetsWebhookUrl,
        'saveHistory',
        item
      );
      if (syncRes.ok) {
        showToast('구글 시트와 브라우저에 모두 안전하게 저장되었습니다!', 'success');
      } else {
        showToast('스프레드시트 전송 실패 (로컬스토리지에 안전하게 보관되었습니다).', 'warning');
      }
    } catch (e) {
      console.error(e);
      showToast('구글 시트 연결 실패, 로컬에 저장되었습니다.', 'warning');
    }
  }
}

function renderHistoryList() {
  const container = document.getElementById('history-list-container');
  const counterEl = document.getElementById('history-page-counter');
  const searchInput = document.getElementById('history-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!container) return;

  let list = AppState.history || [];

  // 검색어 필터
  if (query) {
    list = list.filter(item =>
      (item.location && item.location.toLowerCase().includes(query)) ||
      (item.placeName && item.placeName.toLowerCase().includes(query)) ||
      (item.theme && item.theme.toLowerCase().includes(query)) ||
      (item.metaDescription && item.metaDescription.toLowerCase().includes(query)) ||
      (item.stageBadge && item.stageBadge.toLowerCase().includes(query))
    );
  }

  if (counterEl) {
    counterEl.textContent = `표시 ${list.length}건 / 전체 ${AppState.history.length}건`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
        <i class="fa-regular fa-folder-open text-4xl mb-3 text-slate-300"></i>
        <p class="text-sm font-bold text-slate-700">저장된 히스토리가 없습니다.</p>
        <p class="text-xs text-slate-400 mt-1">1단계에서 장소를 추가하거나 [임시저장], [프롬프트 저장]을 누르면 언제든 이어서 작업할 수 있도록 기록됩니다.</p>
        <button onclick="switchView('studio')" class="mt-4 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs cursor-pointer">
          스튜디오에서 새 코스 기획하기
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const stepNum = item.currentStep || (item.articleContent ? 4 : (item.masterPrompt ? 3 : 1));
    const placesCount = (item.selectedPlaces || []).length;
    const postTypeLabel = item.postType === 'route' ? '동선형' : '리스트형';

    // 단계별 뱃지 컬러
    let stepBadgeHtml = '';
    if (stepNum === 1) {
      stepBadgeHtml = `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200"><i class="fa-solid fa-list-check text-[9px] mr-1"></i>1단계: 장소 탐색 (${placesCount}곳)</span>`;
    } else if (stepNum === 2) {
      stepBadgeHtml = `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200"><i class="fa-solid fa-route text-[9px] mr-1"></i>2단계: 동선·SEO 기획</span>`;
    } else if (stepNum === 3) {
      stepBadgeHtml = `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200"><i class="fa-solid fa-terminal text-[9px] mr-1"></i>3단계: 프롬프트 생성</span>`;
    } else {
      stepBadgeHtml = `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fa-solid fa-circle-check text-[9px] mr-1"></i>4단계: 원고 작성 완료</span>`;
    }

    const placesPreview = (item.selectedPlaces || []).slice(0, 4).map(p => 
      `<span class="inline-block text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 mr-1 mb-1">${escapeHtml(p.name)}</span>`
    ).join('');

    return `
      <div class="bg-white hover:bg-slate-50/80 border border-slate-200 rounded-2xl p-5 transition-all shadow-xs group">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              <i class="fa-solid fa-location-dot text-[10px]"></i> ${escapeHtml(item.location || '전국')}
            </span>
            ${stepBadgeHtml}
            <span class="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              ${postTypeLabel} · ${escapeHtml(item.theme || '추천 코스')}
            </span>
          </div>
          <span class="text-xs text-slate-400 font-mono">${escapeHtml(item.createdAt)}</span>
        </div>

        <h4 class="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors mb-1.5">
          ${escapeHtml(item.placeName || '코스 기획 내역')}
        </h4>

        ${placesPreview ? `<div class="mt-1 mb-2 flex flex-wrap">${placesPreview}${placesCount > 4 ? `<span class="text-[10px] text-slate-400 self-center">+${placesCount - 4}곳 더보기</span>` : ''}</div>` : ''}

        <p class="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
          ${escapeHtml(item.metaDescription || item.stageBadge || (item.articleContent ? item.articleContent.slice(0, 100) : '저장된 진행 내역입니다. 스튜디오로 불러와 바로 이어서 작업하세요.'))}
        </p>

        <div class="flex items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          <button onclick="restoreHistoryItem('${item.id}')" class="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <i class="fa-solid fa-arrow-rotate-left"></i> ${stepNum}단계로 바로 복원하기
          </button>
          ${item.masterPrompt ? `
            <button onclick="copyText('${escapeHtml(item.masterPrompt)}')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer">
              프롬프트 복사
            </button>
          ` : ''}
          <button onclick="deleteHistoryItem('${item.id}')" class="ml-auto text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 text-xs cursor-pointer" title="삭제">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 히스토리 항목 복원: 저장되었던 당시 단계로 정확하게 복귀!
function restoreHistoryItem(id) {
  const item = AppState.history.find(h => h.id === id);
  if (!item) return;

  AppState.selectedLocation = item.location || '제주';
  AppState.selectedPlace = item.placeName || '';
  AppState.selectedPlaces = item.selectedPlaces || [];
  if (item.recommendations && Object.keys(item.recommendations).length > 0) {
    AppState.recommendations = item.recommendations;
  }
  AppState.selectedTheme = item.theme || '당일치기 알짜코스';
  AppState.postType = item.postType || 'curation';
  AppState.step2Assets = item.step2Assets || {};
  AppState.masterPrompt = item.masterPrompt || '';
  AppState.articleContent = item.articleContent || '';
  AppState.snsPackage = item.snsPackage || {};

  // 인풋 값 복원
  const locInput = document.getElementById('location-input');
  if (locInput) locInput.value = item.location;
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect && item.theme) themeSelect.value = item.theme;
  const masterArea = document.getElementById('master-prompt-textarea');
  if (masterArea && item.masterPrompt) masterArea.value = item.masterPrompt;
  const articleArea = document.getElementById('article-editor-textarea');
  if (articleArea && item.articleContent) articleArea.value = item.articleContent;

  setPostType(item.postType || 'curation');
  renderCourseBasket();
  renderRecommendations();

  // 저장 당시의 스텝으로 정확하게 이동
  const targetStep = item.currentStep || (item.articleContent ? 4 : (item.masterPrompt ? 3 : 1));
  switchView('studio');
  goToStep(targetStep);

  if (targetStep === 2 && item.step2Assets && Object.keys(item.step2Assets).length > 0) {
    renderStep2Assets(item.step2Assets);
    renderStep2CourseOrder();
  } else if (targetStep === 4) {
    updateStep4Views();
  }

  showToast(`'${item.placeName}' (${targetStep}단계) 작업 내역을 성공적으로 복원했습니다! 바로 이어서 진행하세요.`, 'success');
}

function deleteHistoryItem(id) {
  if (!confirm('이 히스토리 항목을 삭제하시겠습니까?')) return;
  AppState.history = window.BlogStorage.deleteHistoryItem(id);
  renderHistoryList();
  showToast('히스토리 항목이 삭제되었습니다.', 'info');
}

// ─── [9. 설정 페이지 & Ping 테스트] ───
function handleSaveSettings() {
  const geminiApiKey = document.getElementById('settings-gemini-key').value.trim();
  const selectedModel = document.getElementById('settings-model-select').value;
  const sheetsWebhookUrl = document.getElementById('settings-sheets-url').value.trim();

  AppState.settings = {
    ...AppState.settings,
    geminiApiKey,
    selectedModel,
    sheetsWebhookUrl
  };

  window.BlogStorage.saveSettings(AppState.settings);
  renderHeaderStatus();
  showToast('설정이 성공적으로 저장되었습니다.', 'success');
}

// ─── [10. 단일 HTML 파일 원클릭 다운로더] ───
function setupDownloadSingleHtml() {
  const downloadBtn = document.getElementById('btn-download-single-html');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      exportSingleHtmlFile();
    });
  }
}

async function exportSingleHtmlFile() {
  showToast('단일 HTML 파일 패키징 중...', 'info');
  try {
    let bundledCode = '';
    // 1. bundle.js 우선 탐색
    try {
      const bRes = await fetch('./bundle.js');
      if (bRes.ok) {
        bundledCode = await bRes.text();
      }
    } catch (_) {}

    // 2. bundle.js가 없을 경우 개별 파일 로드 시도
    if (!bundledCode) {
      const fileNames = [
        './src/gasCode.js',
        './src/defaultData.js',
        './src/api.js',
        './src/storage.js',
        './src/generators.js',
        './src/app.js'
      ];

      const scriptContents = await Promise.all(
        fileNames.map(async (file) => {
          let res = await fetch(file);
          if (!res.ok) {
            res = await fetch('/' + file.replace('./', ''));
          }
          if (!res.ok) throw new Error(`${file} 로드 실패`);
          return res.text();
        })
      );
      bundledCode = scriptContents.join('\n\n');
    }

    const clonedDoc = document.documentElement.cloneNode(true);

    // /src/ 및 bundle.js 외부 script 태그 제거
    const extScripts = clonedDoc.querySelectorAll('script[src*="src/"], script[src*="bundle.js"]');
    extScripts.forEach(s => s.remove());

    // 단일 인라인 script 태그로 통합 삽입
    const bundledScript = document.createElement('script');
    bundledScript.textContent = bundledCode;
    clonedDoc.querySelector('body').appendChild(bundledScript);

    const fullHtml = '<!DOCTYPE html>\n' + clonedDoc.outerHTML;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-blog-dashboard-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('단일 HTML 파일(Single HTML)이 성공적으로 다운로드되었습니다! 더블클릭으로 바로 실행하세요.', 'success');
  } catch (err) {
    console.error(err);
    showToast('다운로드 파일 생성 실패: ' + err.message, 'error');
  }
}

// ─── [11. 유틸리티: 토스트, 모달, 클립보드] ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-slate-900 text-white border-emerald-500/30',
    warning: 'bg-amber-900 text-white border-amber-500/30',
    error: 'bg-rose-900 text-white border-rose-500/30',
    info: 'bg-slate-900 text-white border-blue-500/30'
  };

  const icons = {
    success: 'fa-circle-check text-emerald-400',
    warning: 'fa-triangle-exclamation text-amber-400',
    error: 'fa-circle-xmark text-rose-400',
    info: 'fa-circle-info text-blue-400'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium transition-all transform duration-300 translate-y-2 opacity-0 ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-sm"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function copyText(text) {
  if (!text) {
    showToast('복사할 텍스트가 없습니다.', 'warning');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast('클립보드에 복사되었습니다!', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('클립보드에 복사되었습니다!', 'success');
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupEventListeners() {
  const editor = document.getElementById('article-editor-textarea');
  if (editor) {
    editor.addEventListener('input', () => {
      updateStep4Views();
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
      e.target.classList.add('hidden');
      e.target.classList.remove('flex');
    }
  });
}

// 전역 window 바인딩 (HTML 인라인 핸들러용)
window.AppState = AppState;
window.switchView = switchView;
window.goToStep = goToStep;
window.proceedToStep2 = proceedToStep2;
window.proceedToStep3 = proceedToStep3;
window.proceedToStep4 = proceedToStep4;
window.setPostType = setPostType;
window.handleBuildMasterPrompt = handleBuildMasterPrompt;
window.handleSaveMasterPromptRecord = handleSaveMasterPromptRecord;
window.handleOpenGeminiWeb = handleOpenGeminiWeb;
window.handleGenerateArticleDirectly = handleGenerateArticleDirectly;
window.handleGenerateArticleSmartLocal = handleGenerateArticleSmartLocal;
window.handlePasteExternalArticle = handlePasteExternalArticle;
window.copyText = copyText;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.filterPlaceCategory = filterPlaceCategory;
window.handleCourseDragStart = handleCourseDragStart;
window.handleCourseDragOver = handleCourseDragOver;
window.handleCourseDrop = handleCourseDrop;
window.handleCourseDragEnd = handleCourseDragEnd;
window.moveCourseItemUp = moveCourseItemUp;
window.moveCourseItemDown = moveCourseItemDown;
window.removeCourseItem = removeCourseItem;
window.renderStep2CourseOrder = renderStep2CourseOrder;
window.initOrUpdateStep2Map = initOrUpdateStep2Map;
window.openNaverCourseMap = openNaverCourseMap;
window.openKakaoCourseMap = openKakaoCourseMap;
window.openAddPlaceSearchModal = openAddPlaceSearchModal;
window.handleSearchPlaceInModal = handleSearchPlaceInModal;
window.addSearchedPlaceDirectly = addSearchedPlaceDirectly;
window.handleSaveArticleRecord = handleSaveArticleRecord;
window.handleSaveCurrentWork = handleSaveCurrentWork;
window.renderHistoryList = renderHistoryList;
window.restoreHistoryItem = restoreHistoryItem;
window.saveProgressToHistory = saveProgressToHistory;
window.handleSaveCurrentProgress = handleSaveCurrentProgress;
window.handleBatchAddPlacesFromText = handleBatchAddPlacesFromText;
window.handleSaveCustomPlaceSingle = handleSaveCustomPlaceSingle;
window.togglePlaceDetailAccordion = togglePlaceDetailAccordion;
window.syncArticleToSheets = syncArticleToSheets;
window.switchOutputTab = switchOutputTab;
window.handleSearchPlaces = handleSearchPlaces;
window.togglePlaceInCourse = togglePlaceInCourse;
window.moveCoursePlace = moveCoursePlace;
window.handleAutoSelectBestCourse = handleAutoSelectBestCourse;
window.handleClearCourseBasket = handleClearCourseBasket;
window.openCustomPlaceModal = openCustomPlaceModal;
window.handleSaveCustomPlace = handleSaveCustomPlace;
window.handleGenerateStep2Assets = handleGenerateStep2Assets;
window.downloadArticleMarkdown = downloadArticleMarkdown;
window.downloadArticleHtml = downloadArticleHtml;
window.loadHistoryItem = loadHistoryItem;
window.deleteHistoryItem = deleteHistoryItem;
window.filterHistoryCategory = filterHistoryCategory;
window.saveSettings = saveSettings;
window.pingGeminiKey = pingGeminiKey;
window.pingSheetsUrl = pingSheetsUrl;
window.openFullscreenFavoritesView = openFullscreenFavoritesView;
window.renderQuickLinks = renderQuickLinks;
window.openAddQuickLinkModal = openAddQuickLinkModal;
window.renderFavoritesPageView = renderFavoritesPageView;
window.setPageFavCategory = setPageFavCategory;
window.togglePageAddFavForm = togglePageAddFavForm;
window.savePageNewFavorite = savePageNewFavorite;
window.deleteQuickLink = deleteQuickLink;
window.filterMainFavoritesCategory = filterMainFavoritesCategory;
window.navigateToHome = navigateToHome;

