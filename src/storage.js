/**
 * 로컬 스토리지 & 상태 관리 모듈
 */
window.BlogStorage = {
  KEYS: {
    SETTINGS: 'travel_blog_settings_v1',
    QUICK_LINKS: 'travel_blog_quicklinks_v1',
    HISTORY: 'travel_blog_history_v1',
    DRAFT: 'travel_blog_draft_v1',
    THEME: 'travel_blog_theme_v1'
  },

  // 기본 설정
  getSettings() {
    try {
      const saved = localStorage.getItem(this.KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validModels = [
          'gemini-3.8-flash',
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-3.1-flash-lite',
          'gemini-3-flash-preview'
        ];
        if (!parsed.selectedModel || !validModels.includes(parsed.selectedModel)) {
          parsed.selectedModel = 'gemini-3.8-flash';
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return {
      geminiApiKey: '',
      selectedModel: 'gemini-3.8-flash',
      sheetsWebhookUrl: '',
      autoSaveToSheets: true
    };
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // 퀵 링크 관리
  getQuickLinks() {
    try {
      const saved = localStorage.getItem(this.KEYS.QUICK_LINKS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return window.DEFAULT_DATA?.quickLinks || [];
  },

  saveQuickLinks(links) {
    localStorage.setItem(this.KEYS.QUICK_LINKS, JSON.stringify(links));
  },

  // 히스토리 관리
  getHistory() {
    try {
      const saved = localStorage.getItem(this.KEYS.HISTORY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  },

  saveHistoryItem(item) {
    const list = this.getHistory();
    // 중복 id 검사
    const existingIndex = list.findIndex(h => h.id === item.id);
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item); // 최신순
    }
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(list));
    return list;
  },

  deleteHistoryItem(id) {
    const list = this.getHistory().filter(h => h.id !== id);
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(list));
    return list;
  },

  // 작업 임시저장
  getDraft() {
    try {
      const saved = localStorage.getItem(this.KEYS.DRAFT);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  },

  saveDraft(draft) {
    localStorage.setItem(this.KEYS.DRAFT, JSON.stringify(draft));
  }
};
