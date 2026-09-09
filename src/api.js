/**
 * Gemini API 및 Google Apps Script 연동 모듈
 */
window.BlogAPI = {
  // 1. Gemini API Ping 테스트
  async pingGemini(apiKey, model = 'gemini-3.8-flash') {
    if (!apiKey) {
      throw new Error('Gemini API 키가 입력되지 않았습니다.');
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with: "OK"' }] }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status}: API 호출 실패`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { ok: true, message: 'Gemini API 연결 성공!', model, text: text.trim() };
  },

  // 2. Gemini 텍스트 생성 (트래픽 급증 503/429 시 자동 재시도 및 대체 모델 Fallback 체인 내장)
  async generateWithGemini(apiKey, model, prompt, systemInstruction = '', onProgress = null) {
    if (!apiKey) {
      throw new Error('API 키가 설정되지 않았습니다. 설정창에서 입력해주세요.');
    }

    const trimmedKey = apiKey.trim();
    const primaryModel = model || 'gemini-3.8-flash';

    // 트래픽 분산 및 장애 대응을 위한 순차 Fallback 모델 체인
    const candidateModels = Array.from(new Set([
      primaryModel,
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ]));

    let lastError = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      if (i > 0 && typeof onProgress === 'function') {
        onProgress(`서버 트래픽으로 대체 모델(${currentModel})로 자동 전환하여 작성 중...`);
      }

      // 각 모델별로 트래픽 급증(503/429) 발생 시 1회 짧은 대기 후 재시도
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${trimmedKey}`;
          const payload = {
            contents: [{ parts: [{ text: prompt }] }]
          };

          if (systemInstruction) {
            payload.systemInstruction = {
              parts: [{ text: systemInstruction }]
            };
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `AI 생성 실패 (HTTP ${response.status})`;
            const status = response.status;

            const isHighDemand = status === 503 || status === 429 || status === 500 || status === 502 || status === 504 ||
              /high demand|overloaded|spikes in demand|try again later|resource_exhausted|unavailable|rate limit/i.test(errMsg);

            if (isHighDemand) {
              lastError = new Error(errMsg);
              if (attempt === 1) {
                if (typeof onProgress === 'function') {
                  onProgress(`트래픽 일시 대기로 1.5초 후 재시도 중... (${currentModel})`);
                }
                await new Promise(resolve => setTimeout(resolve, 1500));
                continue;
              } else {
                // 다음 대체 모델로 즉시 진행
                break;
              }
            } else {
              // API 키 오류나 잘못된 요청 등은 모델을 바꿔도 동일하므로 즉시 throw
              throw new Error(errMsg);
            }
          }

          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            return {
              text,
              usedModel: currentModel,
              isFallback: currentModel !== primaryModel
            };
          }
        } catch (err) {
          lastError = err;
          // 트래픽/네트워크 관련 에러가 아니면 즉시 중단
          if (!/high demand|overloaded|spikes in demand|try again later|resource_exhausted|unavailable|rate limit|fetch/i.test(err.message)) {
            throw err;
          }
        }
      }
    }

    throw lastError || new Error('Google AI 서버의 일시적 트래픽 급증으로 응답이 지연되었습니다.');
  },

  // 3. Google Apps Script Webhook Ping 테스트
  async pingGoogleSheets(webhookUrl) {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      throw new Error('올바른 Google Apps Script 웹앱 URL을 입력해주세요.');
    }

    const separator = webhookUrl.includes('?') ? '&' : '?';
    const testUrl = `${webhookUrl}${separator}action=ping&t=${Date.now()}`;

    try {
      // GAS Web App은 302 리디렉션 후 JSON을 반환하므로 redirect: 'follow' 필수
      const response = await fetch(testUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`스프레드시트 응답 오류 (HTTP ${response.status})`);
      }

      const resJson = await response.json().catch(() => null);
      if (resJson && resJson.status === 'ok') {
        return { ok: true, message: resJson.message || '스프레드시트 연결 확인 완료!' };
      }
      return { ok: true, message: '스프레드시트 엔드포인트 응답 수신 완료!' };
    } catch (err) {
      // 브라우저 CORS 제한으로 인해 실패할 경우 안내
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('CORS 또는 배포 권한 오류: Apps Script 배포 시 액세스 권한을 "모든 사용자(Anyone)"로 설정했는지 확인하세요.');
      }
      throw err;
    }
  },

  // 4. 구글 시트로 데이터 전송 (POST)
  async syncToGoogleSheets(webhookUrl, action, data) {
    if (!webhookUrl) {
      return { ok: false, fallback: true, message: '스프레드시트 미연동 (LocalStorage 전용 모드)' };
    }

    const payload = JSON.stringify({
      action: action,
      data: data,
      timestamp: new Date().toISOString()
    });

    try {
      // Google Apps Script는 Content-Type: application/json 에 대해 가끔 OPTIONS preflight를 차단할 수 있어
      // text/plain이나 일반 JSON으로 fetch
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const res = await response.json().catch(() => ({ status: 'ok' }));
      return { ok: true, data: res };
    } catch (err) {
      console.warn('Google Sheets Sync Fallback:', err);
      return { ok: false, fallback: true, error: err.message };
    }
  },

  // 5. 구글 시트에서 히스토리 데이터 로드 (GET)
  async loadFromGoogleSheets(webhookUrl) {
    if (!webhookUrl) return null;
    const separator = webhookUrl.includes('?') ? '&' : '?';
    const fetchUrl = `${webhookUrl}${separator}action=getHistory&t=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      redirect: 'follow'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.data || [];
  }
};
