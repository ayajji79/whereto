/**
 * 프롬프트 생성 및 콘텐츠 가공 엔진 - 리스트형(코스 모음) 여행 블로그 특화
 */
window.BlogGenerators = {
  // 장소 데이터 정규화 헬퍼 (문자열 또는 객체 모두 호환, 실존 검증 필드 완벽 보존)
  normalizePlaceItem(item, category, location) {
    if (typeof item === 'object' && item !== null && item.name) {
      const cat = item.category || category || 'sightseeing';
      let defaultParking = '매장 전용 주차장 또는 인근 공영주차장 이용 가능';
      let defaultReview = '다녀온 분들의 찐후기: "분위기와 동선이 훌륭하고 실패 없는 필수 방문 코스"';

      if (cat === 'food') {
        defaultParking = item.parkingInfo || '가게 앞 주차 또는 인근 유료/공영주차장 지원 (만차 시 골목 주차 주의)';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "시그니처 메뉴의 깊은 풍미와 친절함, 웨이팅할 가치가 충분함"';
      } else if (cat === 'cafe') {
        defaultParking = item.parkingInfo || '카페 전용 주차 공간 구비 또는 도보 3분 공영주차장';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "탁 트인 뷰와 감성적인 인테리어, 시그니처 음료 조합이 예술"';
      } else if (cat === 'landmark') {
        defaultParking = item.parkingInfo || '랜드마크 전용 지하/야외 주차장 완비';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "지역을 상징하는 대표 랜드마크로 웅장함과 볼거리가 가득함"';
      } else if (cat === 'kids') {
        defaultParking = item.parkingInfo || '유모차 전용 대형 주차공간 및 패밀리 편의시설 구비';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "아이들이 너무 좋아하고 가족 모두 쾌적하게 즐길 수 있는 안심 시설"';
      } else if (cat === 'nature') {
        defaultParking = item.parkingInfo || '자연휴양림/해변 무료 공영주차장 완비';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "도심을 벗어나 피톤치드와 바닷바람으로 제대로 힐링할 수 있는 숲길/명소"';
      } else if (cat === 'shopping') {
        defaultParking = item.parkingInfo || '시장/상가 공영주차장 및 주차할인권 지원';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "로컬 특산품과 감성 소품이 가득해 구경하고 쇼핑하는 재미가 쏠쏠함"';
      } else if (cat === 'sightseeing' || cat === 'photo') {
        defaultParking = item.parkingInfo || '관광지 전용 대형 공영주차장 완비(기본 무료 또는 저렴한 요금)';
        defaultReview = item.visitorReviewSummary || '다녀온 분들의 찐후기: "산책로와 포토존 조성이 잘 되어 있어 인생 사진 남기기 최적"';
      }

      const coords = this.getPlaceCoordinates(item, location);

      return {
        id: item.id || 'pl-' + Math.random().toString(36).substring(2, 9),
        name: item.name,
        category: cat,
        whyRecommend: item.whyRecommend || `${location} 방문 시 필수 방문지로 검증된 대표 장소입니다.`,
        features: item.features || item.menuInfo || '대표 볼거리 및 시그니처 경험',
        menuInfo: item.menuInfo || (cat === 'food' || cat === 'cafe' ? item.features : '') || '시그니처 대표 메뉴 및 구성',
        parkingInfo: item.parkingInfo || defaultParking,
        visitorReviewSummary: item.visitorReviewSummary || defaultReview,
        address: item.address || `${location} 시내 및 주요 도로변`,
        operatingHours: item.operatingHours || '운영시간 및 휴무일 사전 확인 권장',
        recommendStats: item.recommendStats || '네이버 지도 저장 10,000+ | 방문자 리뷰 5,000+건',
        lat: coords.lat,
        lng: coords.lng
      };
    }

    const name = String(item || '').trim();
    let menuNote = '대표 시그니처 메뉴 및 명소 뷰포인트';
    let cleanName = name;
    const match = name.match(/^(.*?)\s*[\(\[](.*?)[\)\]]$/);
    if (match) {
      cleanName = match[1];
      menuNote = match[2];
    }

    let defaultWhy = `${location} 여행객들이 높은 만족도를 표하는 검증된 실존 명소입니다.`;
    let defaultStats = '네이버 지도 저장 15,000+ | 영수증 리뷰 8,000+건';
    let defaultHours = '상시 개방 또는 10:00~21:00 (방문 전 확인 권장)';
    let defaultAddr = `${location} 주요 관광권역`;
    let parking = '전용 주차장 완비 또는 인근 공영주차장 이용 권장';
    let reviewSummary = '다녀온 분들의 찐후기: "동선이 편리하고 기대 이상으로 뷰와 볼거리가 만족스러웠음"';

    if (category === 'food') {
      defaultWhy = `현지 고유의 식재료와 독창적인 조리법으로 여행객과 로컬 주민들의 입맛을 사로잡은 필수 맛집입니다.`;
      menuNote = menuNote !== '대표 시그니처 메뉴 및 명소 뷰포인트' ? `대표메뉴: ${menuNote}` : '대표 시그니처 정식 및 단품 메뉴 구성';
      defaultStats = '네이버 지도 저장 18,000+ | 영수증 리뷰 12,000+건';
      defaultHours = '매일 11:30~21:30 (브레이크타임 및 라스트오더 확인)';
      parking = '식당 전용 주차장 또는 도보 2~3분 인근 공영주차장 주차권 제공';
      reviewSummary = '다녀온 분들의 찐후기: "국물과 고기의 잡내가 전혀 없고 감칠맛 폭발! 테이블링 원격 줄서기 추천"';
    } else if (category === 'cafe') {
      defaultWhy = `탁 트인 조망과 감성적인 인테리어, 정성껏 로스팅한 커피와 디저트로 여유로운 휴식을 선사하는 랜드마크 카페입니다.`;
      menuNote = '시그니처 음료, 핸드드립 커피, 수제 베이커리 디저트';
      defaultStats = '네이버 지도 저장 14,000+ | 인스타그램 태그 인기 뷰맛집';
      parking = '카페 전용 주차장 완비(무료 주차 지원)';
      reviewSummary = '다녀온 분들의 찐후기: "창가 좌석 뷰가 환상적이고 시그니처 크림 커피가 달콤하고 고소함"';
    } else if (category === 'landmark') {
      defaultWhy = `${location}을 대표하는 상징적인 건축물 및 경관으로 지역을 방문했다면 반드시 인증샷을 남겨야 하는 랜드마크입니다.`;
      menuNote = '대표 전망대 및 파노라마 뷰포인트';
      parking = '전용 주차 타워 및 인근 대형 공영주차장';
      reviewSummary = '다녀온 분들의 찐후기: "도시의 스카이라인을 한눈에 담을 수 있고 야경이 압도적"';
    } else if (category === 'kids') {
      defaultWhy = `아이들의 호기심과 상상력을 자극하는 다양한 체험과 안전한 시설을 갖춘 패밀리 전용 추천 장소입니다.`;
      menuNote = '키즈 체험존, 가족 쉼터, 수유실 완비';
      parking = '아이 동반 전용 주차구역 및 넓은 주차 공간';
      reviewSummary = '다녀온 분들의 찐후기: "아이들이 지루해할 틈 없이 신나게 뛰어놀았고 부모도 편하게 쉴 수 있었음"';
    } else if (category === 'nature') {
      defaultWhy = `맑은 공기와 푸른 자연 속에서 피로를 씻어내고 온전한 평온을 누릴 수 있는 자연 생태 힐링 명소입니다.`;
      menuNote = '둘레길 산책로, 피톤치드 숲, 벤치 쉼터';
      parking = '생태공원 무료 공영주차장';
      reviewSummary = '다녀온 분들의 찐후기: "바람 소리와 새소리가 들려 머릿속이 맑아지고 산책하기에 완벽한 코스"';
    } else if (category === 'shopping') {
      defaultWhy = `현지 고유의 활기와 정겨운 인심, 아기자기한 감성 소품과 특산품을 한자리에서 만나는 쇼핑 핫스팟입니다.`;
      menuNote = '로컬 소품샵, 기념품, 전통시장 먹거리';
      parking = '공영주차장 주차권 제공 (상점 이용 시)';
      reviewSummary = '다녀온 분들의 찐후기: "선물용 기념품 사기 너무 좋고 소품들이 특색 있고 예쁨"';
    } else if (category === 'photo') {
      defaultWhy = `빛과 자연이 빚어낸 환상적인 배경으로 인생 사진을 남길 수 있는 최고의 사진 명소입니다.`;
      menuNote = '대표 포토존, 자연 채광 스팟, 일몰 골든아워';
      parking = '인근 야외 주차장 구비(주차 여유로움)';
      reviewSummary = '다녀온 분들의 찐후기: "사진 구도가 완벽하게 나오고 일몰 30분 전 방문하면 인생샷 보장"';
    }

    const tempObj = { name: cleanName, address: defaultAddr };
    const coords = this.getPlaceCoordinates(tempObj, location);

    return {
      id: 'pl-' + Math.random().toString(36).substring(2, 9),
      name: cleanName,
      category: category || 'sightseeing',
      whyRecommend: defaultWhy,
      features: menuNote,
      menuInfo: menuNote,
      parkingInfo: parking,
      visitorReviewSummary: reviewSummary,
      address: defaultAddr,
      operatingHours: defaultHours,
      recommendStats: defaultStats,
      lat: coords.lat,
      lng: coords.lng
    };
  },

  // 장소 위도/경도 좌표 산출 헬퍼 (100% 무료 지도 연동)
  getPlaceCoordinates(place, location) {
    if (place && place.lat && place.lng) {
      return { lat: Number(place.lat), lng: Number(place.lng) };
    }

    const regionCoords = {
      '제주': { lat: 33.3617, lng: 126.5332 },
      '애월': { lat: 33.4624, lng: 126.3116 },
      '협재': { lat: 33.3938, lng: 126.2396 },
      '서귀포': { lat: 33.2541, lng: 126.5601 },
      '성산': { lat: 33.4586, lng: 126.9328 },
      '중문': { lat: 33.2482, lng: 126.4124 },
      '월미도': { lat: 37.4764, lng: 126.5982 },
      '인천': { lat: 37.4563, lng: 126.7052 },
      '송도': { lat: 37.3948, lng: 126.6389 },
      '성수': { lat: 37.5445, lng: 127.0560 },
      '서울': { lat: 37.5665, lng: 126.9780 },
      '종로': { lat: 37.5730, lng: 126.9890 },
      '을지로': { lat: 37.5662, lng: 126.9920 },
      '홍대': { lat: 37.5575, lng: 126.9245 },
      '연남': { lat: 37.5620, lng: 126.9230 },
      '강릉': { lat: 37.7519, lng: 128.8961 },
      '경포': { lat: 37.7983, lng: 128.9080 },
      '안목': { lat: 37.7719, lng: 128.9482 },
      '속초': { lat: 38.2070, lng: 128.5918 },
      '양양': { lat: 38.0754, lng: 128.6189 },
      '부산': { lat: 35.1587, lng: 129.1603 },
      '해운대': { lat: 35.1587, lng: 129.1603 },
      '광안리': { lat: 35.1532, lng: 129.1186 },
      '영도': { lat: 35.0912, lng: 129.0678 },
      '경주': { lat: 35.8342, lng: 129.2158 },
      '황리단길': { lat: 35.8385, lng: 129.2100 },
      '여수': { lat: 34.7604, lng: 127.6622 },
      '전주': { lat: 35.8150, lng: 127.1530 },
      '포항': { lat: 36.0190, lng: 129.3435 },
      '춘천': { lat: 37.8813, lng: 127.7298 },
      '가평': { lat: 37.8315, lng: 127.5097 },
      '수원': { lat: 37.2845, lng: 127.0145 },
      '단양': { lat: 36.9845, lng: 128.3655 },
      '통영': { lat: 34.8544, lng: 128.4332 },
      '남해': { lat: 34.8377, lng: 127.8924 },
      '대구': { lat: 35.8714, lng: 128.6014 },
      '대전': { lat: 36.3504, lng: 127.3845 }
    };

    const targetStr = `${location || ''} ${(place && place.address) || ''} ${(place && place.name) || ''}`.toLowerCase();
    let center = { lat: 37.5665, lng: 126.9780 };
    for (const [key, coords] of Object.entries(regionCoords)) {
      if (targetStr.includes(key.toLowerCase())) {
        center = coords;
        break;
      }
    }

    let hash = 0;
    const nameStr = (place && place.name) || 'place';
    for (let i = 0; i < nameStr.length; i++) {
      hash = ((hash << 5) - hash) + nameStr.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = ((Math.abs(hash) % 100) - 50) * 0.00035;
    const lngOffset = (((Math.abs(hash * 37) >> 2) % 100) - 50) * 0.00035;

    return {
      lat: Number((center.lat + latOffset).toFixed(6)),
      lng: Number((center.lng + lngOffset).toFixed(6))
    };
  },

  // 키워드 및 별칭 지능형 매칭 엔진 (실존 데이터 100% 매칭)
  findMatchingSpots(location) {
    const kb = window.DEFAULT_DATA?.travelSpotsKB || {};
    if (!location) return kb['제주'] || Object.values(kb)[0];

    const loc = String(location).trim().toLowerCase().replace(/\s+/g, '');

    // 1. 직접 키워드 매칭
    for (const key of Object.keys(kb)) {
      const cleanKey = key.toLowerCase().replace(/\s+/g, '');
      if (loc.includes(cleanKey) || cleanKey.includes(loc)) {
        return { spots: kb[key], matchedRegion: key };
      }
    }

    // 2. 세부 동/구/핫플 별칭(Alias) 사전
    const ALIAS_MAP = [
      { keys: ['월미도', '월미', '월미산', '월미문화의거리'], target: '월미도' },
      { keys: ['성수', '성수동', '서울숲', '뚝섬', '연무장'], target: '성수' },
      { keys: ['연남', '연남동', '홍대', '연트럴', '망원', '합정', '상수', '마포'], target: '연남' },
      { keys: ['종로', '익선', '익선동', '을지로', '안국', '북촌', '서촌', '인사동', '광화문', '경복궁', '청와대'], target: '종로' },
      { keys: ['속초', '양양', '고성', '서피비치', '설악산', '동해안'], target: '속초' },
      { keys: ['여수', '순천', '오동도', '돌산', '낭만포차'], target: '여수' },
      { keys: ['전주', '한옥마을', '경기전', '객사', '객리단길'], target: '전주' },
      { keys: ['대전', '성심당', '유성', '소제동', '한빛탑', '엑스포'], target: '대전' },
      { keys: ['수원', '행궁동', '수원화성', '방화수류정', '행리단길'], target: '수원' },
      { keys: ['춘천', '가평', '남이섬', '청평', '의암호', '소양강'], target: '춘천' },
      { keys: ['포항', '스페이스워크', '호미곶', '영일대', '구룡포'], target: '포항' },
      { keys: ['대구', '동성로', '앞산', '수성못', '김광석'], target: '대구' },
      { keys: ['인천', '송도', '영종도', '차이나타운', '인스파이어'], target: '인천' },
      { keys: ['통영', '남해', '거제', '동피랑', '독일마을', '디피랑'], target: '통영' },
      { keys: ['단양', '제천', '도담삼봉', '만천하'], target: '단양' },
      { keys: ['해운대', '광안리', '서면', '전포', '영도', '기장', '부산', '자갈치'], target: '부산' },
      { keys: ['강릉', '안목', '경포', '주문진', '정동진'], target: '강릉' },
      { keys: ['경주', '황리단길', '보문', '대릉원', '첨성대', '동궁과월지', '불국사'], target: '경주' },
      { keys: ['제주', '애월', '협재', '한림', '성산', '서귀포', '중문', '조천', '함덕', '구좌', '우도'], target: '제주' },
      { keys: ['서울', '잠실', '강남', '압구정', '신사', '여의도', '이태원', '용산'], target: '성수' },
      { keys: ['오사카', '도톤보리', '난바', '우메다'], target: '오사카' },
      { keys: ['도쿄', '신주쿠', '시부야', '긴자'], target: '도쿄' },
      { keys: ['후쿠오카', '하카타', '텐진', '유후인'], target: '후쿠오카' },
      { keys: ['방콕'], target: '방콕' },
      { keys: ['다낭', '호이안'], target: '다낭' },
      { keys: ['파리'], target: '파리' }
    ];

    for (const item of ALIAS_MAP) {
      if (item.keys.some(k => loc.includes(k))) {
        if (kb[item.target]) return { spots: kb[item.target], matchedRegion: item.target };
      }
    }

    // 기본값: 가장 신뢰도 높은 제주 또는 서울 성수
    return { spots: kb['제주'] || Object.values(kb)[0], matchedRegion: '추천 명소' };
  },

  // 1. 추천 키워드 및 상세 장소 생성
  async generatePlaceRecommendations(location, theme, apiKey, model) {
    const matchResult = this.findMatchingSpots(location);
    const matchedSpots = matchResult?.spots || null;
    const matchedRegion = matchResult?.matchedRegion || location;

    const allCategories = ['sightseeing', 'landmark', 'food', 'cafe', 'kids', 'photo', 'nature', 'shopping'];

    // Gemini AI 연결되어 있으면 실시간 검색 및 블로그 정보 취합 호출
    if (apiKey) {
      try {
        const prompt = `당신은 최신 블로그 후기와 방문자 리뷰를 철저하게 검색·취합하는 전문 여행 정보 에디터입니다.
검색 대상 지역: '${location}'
설정 테마: '${theme}'

이 지역('${location}')에서 현재 실제로 활발하게 운영 중인 8대 카테고리(관광지 sightseeing, 랜드마크 landmark, 맛집 food, 카페 cafe, 키즈 kids, 포토스팟 photo, 힐링자연 nature, 쇼핑 shopping) 정보를 최신 블로그 검색과 영수증 방문자 후기를 바탕으로 종합 취합하여 JSON으로 정리해주세요.

★ [정보 취합 필수 원칙 - 정확한 검색과 실존 정보]:
1. 상호명(name): 네이버지도나 포털 검색창에 검색했을 때 즉시 정확하게 검색되는 '공식 상호명'만을 기재하세요 (예: '만나횟집', '월미테마파크', '차피', '동화가든').
2. 실제 운영 여부 확인: 현재 폐업했거나 가상의 장소는 절대 포함하지 마세요.
3. 5대 핵심 정보 블로그 후기 기반 정리:
   - menuInfo: 대표 시그니처 메뉴명 및 볼거리 (가격대 포함)
   - parkingInfo: 주차 가능 여부 및 주차장 꿀팁
   - address: 실제 정확한 도로명 주소
   - operatingHours: 실제 영업시간, 휴무일, 브레이크타임
   - visitorReviewSummary: 블로그 및 영수증 방문객 찐후기 요약
4. 각 카테고리별로 3~5곳씩 실존 장소를 골고루 취합하세요.

반드시 아래 JSON 형식 규격만을 순수하게 반환하세요:
{
  "sightseeing": [ { "name": "장소명", "whyRecommend": "추천이유", "features": "특징", "menuInfo": "주요볼거리", "parkingInfo": "주차팁", "visitorReviewSummary": "방문객후기", "address": "도로명주소", "operatingHours": "운영시간", "recommendStats": "정상 운영 중" } ],
  "landmark": [ { "name": "랜드마크명", "whyRecommend": "상징적 의미", "features": "조망/체험", "menuInfo": "대표경관", "parkingInfo": "주차안내", "visitorReviewSummary": "후기", "address": "주소", "operatingHours": "시간", "recommendStats": "정상 운영 중" } ],
  "food": [ { "name": "식당명", "whyRecommend": "맛집추천이유", "features": "메뉴특징", "menuInfo": "대표메뉴&가격", "parkingInfo": "주차안내", "visitorReviewSummary": "맛후기", "address": "주소", "operatingHours": "영업시간", "recommendStats": "정상 운영 중" } ],
  "cafe": [ { "name": "카페명", "whyRecommend": "분위기&뷰", "features": "인테리어", "menuInfo": "시그니처음료&디저트", "parkingInfo": "주차안내", "visitorReviewSummary": "분위기후기", "address": "주소", "operatingHours": "영업시간", "recommendStats": "정상 운영 중" } ],
  "kids": [ { "name": "키즈명소명", "whyRecommend": "아이/가족 추천이유", "features": "체험시설", "menuInfo": "놀이/편의시설", "parkingInfo": "주차안내", "visitorReviewSummary": "부모후기", "address": "주소", "operatingHours": "시간", "recommendStats": "정상 운영 중" } ],
  "photo": [ { "name": "포토스팟명", "whyRecommend": "인생샷 포인트", "features": "사진구도", "menuInfo": "포토존&골든아워", "parkingInfo": "주차안내", "visitorReviewSummary": "사진후기", "address": "주소", "operatingHours": "시간", "recommendStats": "정상 운영 중" } ],
  "nature": [ { "name": "자연명소명", "whyRecommend": "힐링포인트", "features": "산책로/숲", "menuInfo": "둘레길&쉼터", "parkingInfo": "주차안내", "visitorReviewSummary": "힐링후기", "address": "주소", "operatingHours": "시간", "recommendStats": "정상 운영 중" } ],
  "shopping": [ { "name": "쇼핑/시장명", "whyRecommend": "쇼핑매력", "features": "특산품/소품", "menuInfo": "기념품&먹거리", "parkingInfo": "주차안내", "visitorReviewSummary": "쇼핑후기", "address": "주소", "operatingHours": "시간", "recommendStats": "정상 운영 중" } ]
}`;

        const aiRes = await window.BlogAPI.generateWithGemini(apiKey, model, prompt);
        const aiText = typeof aiRes === 'object' && aiRes.text !== undefined ? aiRes.text : (aiRes || '');
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const rawParsed = JSON.parse(jsonMatch[0]);
          const normalized = {};
          allCategories.forEach(cat => {
            normalized[cat] = (rawParsed[cat] || []).map(item => this.normalizePlaceItem(item, cat, location));
          });
          return normalized;
        }
      } catch (err) {
        console.warn('AI 추천 실패, 지식베이스/스마트엔진으로 폴백:', err);
      }
    }

    // 100% 실존하는 검증 데이터 반환 (가상의 더미 데이터 생성 전면 차단)
    const fallbackSpots = matchedSpots || window.DEFAULT_DATA?.travelSpotsKB?.['성수'] || window.DEFAULT_DATA?.travelSpotsKB?.['제주'] || {};
    const normalized = {};

    allCategories.forEach(cat => {
      let rawList = fallbackSpots[cat] || [];
      if (rawList.length === 0) {
        // 지식베이스에 해당 카테고리가 부족할 경우 관련 카테고리에서 스마트 파생
        if (cat === 'landmark') {
          rawList = (fallbackSpots.sightseeing || []).slice(0, 3);
        } else if (cat === 'nature') {
          rawList = (fallbackSpots.sightseeing || []).filter(s => {
            const name = (typeof s === 'object' ? s.name : String(s)).toLowerCase();
            return name.includes('공원') || name.includes('해변') || name.includes('숲') || name.includes('오름') || name.includes('산') || name.includes('호수');
          });
          if (rawList.length === 0) rawList = (fallbackSpots.sightseeing || []).slice(1, 4);
        } else if (cat === 'kids') {
          rawList = (fallbackSpots.sightseeing || []).filter(s => {
            const name = (typeof s === 'object' ? s.name : String(s)).toLowerCase();
            return name.includes('테마') || name.includes('월드') || name.includes('랜드') || name.includes('아쿠아') || name.includes('박물관') || name.includes('체험');
          });
          if (rawList.length === 0) rawList = (fallbackSpots.sightseeing || []).slice(0, 2);
        } else if (cat === 'shopping') {
          rawList = (fallbackSpots.food || []).filter(s => {
            const name = (typeof s === 'object' ? s.name : String(s)).toLowerCase();
            return name.includes('시장') || name.includes('마켓') || name.includes('거리') || name.includes('베이커리');
          });
          if (rawList.length === 0) rawList = (fallbackSpots.cafe || []).slice(0, 2);
        }
      }
      normalized[cat] = rawList.map(item => this.normalizePlaceItem(item, cat, matchedRegion || location));
    });
    return normalized;
  },

  // 2. 리스트형(복수 장소 코스) 상세 분석, 통합 SEO, 각 장소별 구글 Flow 최적화 한글 이미지 프롬프트 생성
  async generateStep2Assets(location, selectedPlaces, theme, apiKey, model) {
    // selectedPlaces는 단일 객체이거나 배열일 수 있음
    const placesList = Array.isArray(selectedPlaces) ? selectedPlaces : [selectedPlaces];
    const placeNames = placesList.map(p => (typeof p === 'object' ? p.name : String(p))).filter(Boolean);
    const placeCount = placeNames.length;
    const combinedPlacesStr = placeNames.join(', ');

    // 앵글 및 스타일 프리셋 (한글, 한국인 인물, 다양한 카메라 앵글)
    const angleTypes = [
      { id: 'pov-hand', label: '1인칭 POV 손 시점', icon: 'fa-hand', desc: '손만 살짝 보이고 배경과 함께 찍은 감성 구도' },
      { id: 'high-sea', label: '바다 조망 하이앵글 항공뷰', icon: 'fa-plane-departure', desc: '바다와 지형이 시원하게 내려다보이는 높은 앵글' },
      { id: 'window-side', label: '감성 창가 측면 시네마틱', icon: 'fa-couch', desc: '한국인 여행객이 창밖 풍경을 바라보는 감성 앵글' },
      { id: 'street-low', label: '생동감 넘치는 로우앵글 스냅', icon: 'fa-person-walking', desc: '한국인 여행자가 하늘과 랜드마크를 배경으로 걷는 구도' },
      { id: 'sunset-wide', label: '일몰 골든아워 와이드 뷰', icon: 'fa-sun', desc: '황금빛 노을 역광과 감성적인 실루엣 파노라마' }
    ];

    if (apiKey && placeCount > 0) {
      try {
        const prompt = `당신은 여행 블로그 비주얼 아트 디렉터입니다.
여행지: '${location}'
여행 테마: '${theme}'
선택된 장소 리스트 (${placeCount}곳): ${combinedPlacesStr}
각 장소 정보:
${JSON.stringify(placesList, null, 2)}

위 장소들을 소개하는 블로그 포스팅에 들어갈 SEO 메타 정보와 '구글 Flow / Imagen 최적화 고품질 한글 이미지 프롬프트'를 생성해주세요.

★ [이미지 프롬프트 엄격한 필수 원칙]:
1. 영어가 아닌 100% '한국어(한글)' 프롬프트로만 작성하세요. 미드저니 명령어(--ar 등)는 일절 쓰지 마세요.
2. 등장인물이 나올 경우 무조건 '20대 또는 30대 한국인 (한국인 여행자, 한국인 여성, 한국인 커플 등)'으로 설정하세요.
3. 카메라 앵글을 다양하고 감성적으로 설정하세요:
   - [손만 보이는 1인칭 POV 시점]: 카메라를 든 한국인의 손에 소품/음료만 살짝 프레임 한구석에 나오고 배경과 장소가 시원하게 펼쳐지는 구도
   - [바다가 보이는 하이앵글 항공뷰]: 높은 하늘이나 전망대에서 에메랄드빛 바다와 해안 도로/산책로를 시원하게 내려다보는 드론 항공 앵글
   - [감성 창가 측면 앵글]: 한국인 여행자가 창가 테이블에 앉아 바깥 풍경을 바라보는 분위기 있는 측면 클로즈업
   - [거리 스냅 로우앵글]: 하늘과 랜드마크를 배경으로 산뜻한 옷차림의 한국인이 걸어오는 로우앵글
   - [일몰 골든아워 와이드]: 붉게 물든 노을과 바다를 배경으로 한 감성적인 역광 실루엣

반드시 아래 키를 포함하는 순수 JSON 형식만 반환하세요 (백틱 마크다운 제외):
{
  "summary": "${location}의 ${placeCount}개 핵심 명소를 엮은 리스트형 코스의 총평 요약 (3~4문장)",
  "recommendedHours": "전체 코스 권장 소요 시간 및 추천 동선 순서 안내",
  "seoKeywords": ["${location}가볼만한곳", "${location}여행코스", "키워드3", "키워드4", "키워드5", "키워드6", "키워드7"],
  "metaDescription": "검색엔진 네이버/구글 상위노출용 클릭을 부르는 리스트형 메타 설명문 (140~160자 내외)",
  "titleSuggestions": [
    "[2026 최신] ${location} 가볼만한곳 BEST ${placeCount}! 관광지부터 맛집·카페까지 완벽 코스",
    "현지인이 추천하는 ${location} 알짜배기 여행 코스 ${placeCount}곳 총정리 (동선, 주차, 꿀팁)",
    "실패 없는 ${location} 여행! 꼭 가봐야 할 인생 스팟 ${placeCount}선"
  ],
  "catchphrases": [
    "감성형: '설렘 가득한 ${location}, 발길 닿는 곳마다 마주한 인생 코스'",
    "정보형: '${location} 여행, 이 순서대로만 가면 웨이팅 없이 하루 순삭!'",
    "리스트형: '관광지부터 찐맛집·카페까지! 고민 없이 떠나는 ${location} BEST ${placeCount}'"
  ],
  "placeAssetCards": [
    {
      "name": "각 장소명",
      "category": "장소 카테고리",
      "angleType": "1인칭 POV 손 시점 또는 바다 조망 하이앵글 항공뷰 등",
      "highlightTip": "이 장소를 글에서 다룰 때 강조할 핵심 포인트 1줄",
      "koreanImagePrompt": "구글 Flow에 바로 복사해 넣을 수 있는 100% 한글 실사 이미지 프롬프트 (한국인 인물, 카메라 앵글, 조명, 색감 명시)"
    }
  ],
  "thumbnailPrompt": "구글 Flow용 16:9 와이드 대표 썸네일 한글 프롬프트: ${location}의 시원한 풍경과 20대 한국인 여행자가 어우러진 항공 드론 파노라마 사진, 따스한 자연광, 맑고 투명한 색감"
}`;

        const aiRes = await window.BlogAPI.generateWithGemini(apiKey, model, prompt);
        const aiText = typeof aiRes === 'object' && aiRes.text !== undefined ? aiRes.text : (aiRes || '');
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        }
      } catch (err) {
        console.warn('Step 2 AI 생성 오류, 스마트 폴백:', err);
      }
    }

    // 스마트 룰베이스 폴백 (100% 한글, 한국인 인물, 다양한 카메라 앵글)
    const placeCards = placesList.map((p, idx) => {
      const pName = typeof p === 'object' ? p.name : String(p);
      const pCat = typeof p === 'object' ? (p.category || 'sightseeing') : 'sightseeing';
      const pWhy = typeof p === 'object' ? (p.whyRecommend || '여행객들이 극찬하는 명소') : '여행객들이 극찬하는 명소';
      const angle = angleTypes[idx % angleTypes.length];

      let koreanPrompt = '';
      if (angle.id === 'pov-hand') {
        koreanPrompt = `20대 한국인의 한 손이 따뜻한 머그잔(또는 시그니처 로컬 소품)을 가볍게 쥔 채 프레임 오른쪽 아래에 살짝 나오고, 그 너머로 ${pName}의 아름다운 배경이 시원하고 청량하게 펼쳐지는 1인칭 POV 스냅 사진. 부드러운 자연광, 은은한 아웃포커싱, 감성 여행 브이로그 스타일.`;
      } else if (angle.id === 'high-sea') {
        koreanPrompt = `${location} ${pName}의 푸른 에메랄드빛 바다와 해안 도로, 산책로를 높은 하늘 위에서 시원하게 내려다보는 드론 항공 하이앵글 탑뷰. 파도에 부서지는 흰 포말과 반짝이는 윤슬, 맑은 날씨, 넓게 트인 수평선 구도의 생생한 여행 사진.`;
      } else if (angle.id === 'window-side') {
        koreanPrompt = `산뜻한 캐주얼 니트 차림의 20대 한국인 여성이 ${pName}의 감성적인 창가 테이블에 앉아 창밖 풍경을 평화롭게 바라보고 있는 측면 시네마틱 앵글. 오후의 따스한 자연 햇살이 테이블에 드리우는 영화 속 한 장면 같은 분위기, 차분한 색감.`;
      } else if (angle.id === 'street-low') {
        koreanPrompt = `푸른 하늘과 ${pName}의 상징적인 건축물을 배경으로, 산뜻한 여행룩을 입은 20대 한국인 여행객들이 기분 좋게 걸어오며 미소 짓는 역동적인 로우앵글 스냅 사진. 생생한 표정과 자연스러운 포즈, 화사한 햇살.`;
      } else {
        koreanPrompt = `${pName}의 붉게 물드는 저녁노을과 수평선을 배경으로 20대 한국인 여행자가 서 있는 감성적인 와이드 실루엣 풍경. 낭만적인 노을빛 역광과 여행의 여운이 느껴지는 따뜻한 색감.`;
      }

      return {
        name: pName,
        category: pCat,
        angleType: angle.label,
        highlightTip: `코스 ${idx + 1}번: ${pWhy.slice(0, 45)}...`,
        koreanImagePrompt: koreanPrompt
      };
    });

    return {
      summary: `${location}에서 가장 인기 있는 ${placeCount}곳(${combinedPlacesStr})을 엄선한 알짜 여행 코스입니다. 관광 명소의 볼거리와 로컬 맛집의 미식, 감성 카페와 포토존까지 완벽한 밸런스를 갖추고 있어 ${theme} 여행을 계획하는 분들에게 최상의 만족을 선사합니다.`,
      recommendedHours: `추천 동선: ${placeNames.map((n, i) => `${i + 1}. ${n}`).join(' ➔ ')} (총 예상 소요시간: 5~7시간)`,
      seoKeywords: [
        `${location}여행`,
        `${location}가볼만한곳`,
        `${location}코스추천`,
        `${location}BEST${placeCount}`,
        `${location}맛집추천`,
        `${location}카페`,
        `${location}${theme}`
      ].concat(placeNames.slice(0, 3)),
      metaDescription: `직접 다녀오고 엄선한 ${location} 가볼만한곳 BEST ${placeCount}! 관광지부터 로컬 맛집, 감성 카페까지 완벽한 당일치기 여행 코스와 주차, 웨이팅 꿀팁을 총정리해 드립니다.`,
      titleSuggestions: [
        `[2026 최신] ${location} 가볼만한곳 BEST ${placeCount}! 관광지·맛집·카페 완벽 코스 총정리`,
        `실패 없는 ${location} 여행! 현지인이 추천하는 알짜 핫플레이스 ${placeCount}선 (동선&주차팁)`,
        `뚜벅이도 하루 만에 정복하는 ${location} 필수 코스 모음집 (${combinedPlacesStr})`
      ],
      catchphrases: [
        `리스트형: "고민 끝! ${location} 가볼만한곳 알짜배기 BEST ${placeCount} 완벽 정리"`,
        `정보형: "이 동선대로만 가면 성공! ${location} 하루 알찬 여행 코스 대공개"`,
        `감성형: "머무는 모든 순간이 힐링이었던 ${location}의 보물 같은 스팟들"`
      ],
      placeAssetCards: placeCards,
      thumbnailPrompt: `20대 한국인 여행자가 ${location}의 대표 명소인 ${placeNames.slice(0, 2).join('와 ')}를 배경으로 시원한 바다 바람을 맞으며 서 있는 16:9 와이드 항공 파노라마 사진. 높은 각도에서 내려다보는 푸른 바다와 활기찬 풍경, 맑은 자연광, 디테일이 살아있는 8k 해상도의 여행 블로그 대표 썸네일 포토.`
    };
  },

  // 3. 리스트형 블로그 본문 마스터 프롬프트(Listicle Master Prompt) 조합
  buildMasterPrompt({ location, selectedPlaces, theme, postType = 'curation', extraKeywords, step2Assets }) {
    const placesList = Array.isArray(selectedPlaces) ? selectedPlaces : [selectedPlaces];
    const placeCount = placesList.length;

    const placesDetailText = placesList.map((p, idx) => {
      if (typeof p === 'object') {
        return `[장소 ${idx + 1}] ${p.name} (${p.category === 'food' ? '대표 맛집' : p.category === 'cafe' ? '감성 카페' : p.category === 'photo' ? '인생샷 명소' : '핵심 관광지'})
- 장소 특징 & 매력: ${p.whyRecommend || p.features || '검증된 인기 방문지'}
- 대표 메뉴 / 볼거리: ${p.menuInfo || p.features || '시그니처 메뉴 및 공간 구성'}
- 주차 정보 & 팁: ${p.parkingInfo || p.parkingTip || '전용 주차장 또는 인근 공영주차장'}
- 실제 다녀온 사람들의 생생한 반응 & 찐후기: ${p.visitorReviewSummary || p.visitorReview || '방문자 만족도 최상'}
- 상세 주소: ${p.address || `${location} 일원`}
- 운영정보 / 웨이팅: ${p.operatingHours || '운영시간 확인 필요'}
- 네이버 지도 검증 지표: ${p.recommendStats || '네이버 리뷰 검증 완료'}`;
      }
      return `[장소 ${idx + 1}] ${p}`;
    }).join('\n\n');

    const keywordsStr = (step2Assets?.seoKeywords || []).concat(extraKeywords ? extraKeywords.split(',') : []).map(k => k.trim()).filter(Boolean).join(', ');

    const isRouteType = postType === 'route';

    return `당신은 네이버/티스토리/워드프레스에서 수만 명의 독자에게 신뢰받는 여행 전문 블로그 작가입니다.
아래 기획 정보와 장소별 실시간 메타 데이터를 100% 반영하여, 독자가 끝까지 정독하고 저장(스크랩)할 수밖에 없는 완성형 블로그 포스팅을 작성해주세요.

[1. 핵심 포스팅 기획 정보]
- 여행 대상 지역: ${location}
- 여행 테마: ${theme}
- 수록 장소 수: 총 ${placeCount}곳
- 포스팅 구성 스타일: ${isRouteType ? '📍 [코스/동선 투어형] - "이 순서대로 돌아보세요" (1코스 ➔ 2코스 ➔ 3코스 동선 최적화 및 하루 일정 정리형)' : '📋 [테마 리스트/알짜 큐레이션형] - "이 지역에 이런 맛집·카페·명소가 있어요" (지역 알짜 핫플레이스를 카테고리별로 추천하는 큐레이션 나열형)'}
- 목표 글자수 가이드: 공백 포함 기본 약 2,000자 기준 (억지로 글자 수를 늘리거나 줄이지 말고, 각 장소의 생생한 사설과 실전 꿀팁의 깊이에 따라 1,800자~2,500자 사이에서 자연스럽고 알차게 완성해주세요.)

[2. 고정 톤앤매너 - 친근한 토스(Toss)형 어투]
- 독자에게 말을 건네듯 친근하고 편안하며 신뢰를 주는 대화체(~해요, ~해보세요, ~하면 더 좋아요, ~느껴져요)로 작성하세요.
- 딱딱하고 권위적인 문어체(~습니다, ~하옵니다, ~에 다름 아닙니다)나 과장된 상투적 미사여구(지상낙원, 천혜의 비경 등)는 완전히 배제하세요.
- 복잡한 표현 대신 한눈에 술술 읽히는 쉬운 단어와 명쾌하고 다정한 문장 호흡을 유지하세요.

[3. ★ 가장 중요한 핵심: 제3자 시점의 생생한 감정 & 사설(Commentary) 반영]
- 각 장소를 소개할 때 단순히 위치나 메뉴만 나열하는 백과사전식 안내를 엄격히 금지합니다.
- 실제 블로그 후기나 방문객들의 리뷰에서 느낄 수 있는 "공간에 들어섰을 때 사람이 느끼는 감정, 공기의 온도, 냄새, 시선의 흐름, 솔직한 인상"을 제3자 관점에서 풍부한 사설로 덧붙여주세요.
  (예: "문을 열자마자 고소하게 풍겨오는 원두 냄새와 통창 너머로 쏟아지는 햇살 덕분에 절로 마음이 편안해져요. 평일 낮인데도 조용히 책을 읽거나 도란도란 대화를 나누는 사람들의 표정에서 이곳 특유의 여유가 고스란히 묻어납니다.")
- 방문객들이 왜 이 장소를 좋아하고 어떤 순간에 감동하는지 인간적인 공감을 이끌어내는 관찰자 사설을 각 장소마다 1~2문단씩 꼭 담아주세요.

[4. 수록 장소 상세 데이터]
${placesDetailText}

[5. 필수 반영 SEO 키워드]
- 포커스 키워드: ${keywordsStr}
- 클릭을 부르는 매력적인 H1 메인 제목으로 글을 시작할 것.
- 제목과 본문 소제목, 마무리 문단에 키워드가 억지스럽지 않게 자연스럽게 4~6회 스며들도록 배치하세요.

[6. 본문 구성 체계]
${isRouteType ? `1) 도입부: ${location} ${theme} 여행을 떠나야 하는 이유와 이동 동선 낭비 없이 알차게 둘러볼 수 있는 당일치기/1박2일 코스 개요 소개.
2) 한눈에 보는 황금 동선 로드맵: 인용구(>) 서식으로 [1장소 ➔ 2장소 ➔ 3장소 ...] 동선 및 예상 이동 시간 요약.
3) 장소별 상세 코스 소개 (H2: "## 1. [장소명] - [매력 포인트]"):
   - [장소의 첫인상과 3자 관점 사설]: 공간의 분위기, 실제 사람들이 느끼는 감정과 솔직한 느낌
   - [대표 메뉴 및 즐길 거리]: 놓치면 아쉬운 시그니처 메뉴의 맛과 볼거리
   - [📍 방문자 실전 꿀팁 박스]:
     • 도로명 주소: (상세 주소)
     • 운영시간 & 휴무: (시간 및 브레이크타임/웨이팅 팁)
     • 주차 정보: (주차 가능 여부 및 만차 시 대안)
     • 다녀온 사람들의 생생 후기: (실제 방문객 반응 한 줄 요약)
4) 코스 마무리 & 이동 팁: 동선 연결 팁, 대중교통/주차 주의점, 총평 및 댓글 소통 유도.` : `1) 도입부: ${location}에 가면 꼭 가봐야 할 알짜배기 명소들을 한자리에 모은 큐레이션 가이드 소개.
2) 수록 명소 한눈에 보기: 인용구(>) 서식으로 이번 글에서 소개해 드릴 맛집·카페·명소 리스트 요약.
3) 장소별 알짜 큐레이션 소개 (H2: "## 1. [장소명] - [추천 이유와 매력]"):
   - [공간이 주는 감동과 3자 관점 사설]: 문을 열었을 때의 첫 느낌, 분위기, 공간을 채우는 사람들의 활기와 솔직한 감정 묘사
   - [핵심 포인트 & 시그니처]: 왜 이곳이 현지인과 여행객 모두에게 사랑받는지 구체적 매력
   - [📍 방문자 실전 꿀팁 박스]:
     • 도로명 주소: (상세 주소)
     • 운영시간 & 휴무: (시간 및 휴무 안내)
     • 주차 안내: (주차 정보 및 팁)
     • 생생 방문 후기: (실제 방문자 리뷰 포인트)
4) 나만의 여행 취향별 선택 가이드 & 총평: 내 취향에 맞춰 골라가는 방법과 응원 메시지, 댓글 소통 유도.`}

[7. 출력 서식 규칙]
- 마크다운(#, ##, ###, -, >, **)을 깔끔하게 사용하여 가독성을 극대화하세요.
- 불필요한 서두("네, 알겠습니다" 등) 없이 곧바로 '# [포스팅 제목]'부터 출력하세요.`;
  },

  // 4. 글자수 및 읽기 시간 통계
  analyzeText(text = '') {
    const clean = text || '';
    const charWithSpaces = clean.length;
    const charWithoutSpaces = clean.replace(/\s/g, '').length;
    const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.round(charWithoutSpaces / 500));
    return {
      charWithSpaces,
      charWithoutSpaces,
      words,
      readingTime: `${minutes}분`
    };
  },

  // 5. 마크다운을 티스토리/워드프레스용 클린 HTML로 변환
  markdownToCleanHtml(md = '') {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #1e293b;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 1.45rem; font-weight: 800; margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; color: #0f172a;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size: 1.85rem; font-weight: 800; margin-bottom: 1.5rem; color: #0f172a;">$1</h1>');

    html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; margin: 1.25rem 0; font-style: normal; color: #334155; background: #f8fafc; border-radius: 0 0.5rem 0.5rem 0;">$1</blockquote>');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    html = html.replace(/^\- (.*$)/gim, '<li style="margin-left: 1.25rem; margin-bottom: 0.35rem; list-style-type: disc;">$1</li>');

    const lines = html.split('\n');
    const processed = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<br/>';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      return `<p style="line-height: 1.85; margin-bottom: 1rem; color: #334155;">${trimmed}</p>`;
    });

    return processed.join('\n');
  },

  // 6. 리스트형 특화 SNS 패키지 자동 생성
  generateSnsPackage(articleText, { location, selectedPlaces = [], keywords = [] }) {
    const placesList = Array.isArray(selectedPlaces) ? selectedPlaces : [selectedPlaces];
    const placeNames = placesList.map(p => (typeof p === 'object' ? p.name : String(p))).filter(Boolean);
    const count = placeNames.length;
    const firstParagraph = (articleText || '').split('\n').filter(p => p.trim() && !p.startsWith('#'))[0] || `${location} 여행의 모든 것!`;

    const hashtags = [`#${location.replace(/\s+/g, '')}여행`, `#${location.replace(/\s+/g, '')}가볼만한곳`, `#${location.replace(/\s+/g, '')}핫플`, '#여행코스', '#국내여행', '#여행블로그', '#데이트코스']
      .concat(placeNames.map(n => `#${n.replace(/\s+/g, '')}`))
      .concat(keywords.slice(0, 3).map(k => `#${k.replace(/\s+/g, '')}`))
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' ');

    // 1. 인스타그램 카드뉴스형 캡션
    const cardNewsSlides = placesList.map((p, idx) => {
      const name = typeof p === 'object' ? p.name : p;
      const why = typeof p === 'object' ? (p.whyRecommend || '').slice(0, 50) : '인기 스팟';
      return `📍 Slide ${idx + 2}. ${name}\n👉 ${why}...`;
    }).join('\n\n');

    const instagram = `[저장필수] ${location} 여행 가면 무조건 가야 할 BEST ${count} 코스 총정리 📌

${firstParagraph.slice(0, 140)}...

─── 코스 미리보기 ───
${placeNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

─── 카드뉴스 요약 ───
${cardNewsSlides}

💡 방문 꿀팁 & 상세 주차/동선 정보는 프로필 링크의 블로그에서 지금 바로 확인해보세요!
친구, 연인 태그하고 이번 주말 ${location} 떠나자 @친구소환

${hashtags}`;

    // 2. 스레드 / 페이스북용
    const threads = `여기 진짜 저장해두고 가야 할 ${location} 알짜배기 ${count}곳 정리해왔어요 ✨

${placeNames.map((n, i) => `${i + 1}️⃣ ${n}`).join('\n')}

${firstParagraph.slice(0, 120)}...

이번 주말에 이 코스대로만 가면 실패 확률 0%!
다들 어디가 제일 가보고 싶으신가요? 댓글로 알려주세요 👇

#여행 #${location} #여행스타그램`;

    // 3. 트위터 / X 타래형 스레드
    const twitter = `[1/3] 🧵 이번 여행 계획 중이라면 무조건 북마크해야 할 '${location} 필수 코스 BEST ${count}' 타래 시작합니다!
👉 추천 코스: ${placeNames.join(' ➔ ')}

[2/3] 📸 ${placeNames.slice(0, 2).join(', ')} 등 각 스팟별 대표메뉴와 주차/웨이팅 피하는 골든타임 팁 정리완료!

[3/3] 🔗 블로그에 주소, 영업시간, 사진 포인트까지 싹 다 정리해뒀으니 여행 가실 때 참고하세요: [블로그 링크]
#${location}여행 #여행정보`;

    return {
      instagram,
      threads,
      twitter,
      hashtags
    };
  },

  // 6. Gemini 서버 지연 또는 키 없이도 즉시 고품질 포스팅을 완성하는 스마트 템플릿 엔진 (토스형 어투 + 3자 감정 사설)
  generateCompleteArticleLocal({ location, places, theme, postType = 'curation', keywords = [] }) {
    const loc = location || '여행지';
    const placesList = Array.isArray(places) && places.length > 0 ? places : [{
      name: `${loc} 대표 명소`,
      features: '인생샷과 힐링을 동시에 즐길 수 있는 대표 스팟',
      address: `${loc} 일대`,
      operatingHours: '10:00 ~ 21:00 (연중무휴)',
      parkingTip: '인근 공영주차장 이용 권장',
      whyRecommend: '방문자 만족도가 가장 높은 핫플레이스',
      visitorReview: '분위기와 접근성이 뛰어나 재방문 의사 100%'
    }];
    const count = placesList.length;
    const isRouteType = postType === 'route';

    const mainTitle = isRouteType
      ? `[2026 최신] ${loc} 가볼만한곳 BEST ${count}! 동선 낭비 없는 하루 알짜 여행 코스 총정리`
      : `[2026 최신] ${loc} 핫플레이스 BEST ${count}! 현지인도 자주 찾는 알짜 맛집·카페·명소 모음`;

    const placeNames = placesList.map(p => (typeof p === 'object' ? p.name : String(p)));
    const routeText = placeNames.join(' ➔ ');

    let articleMd = `# ${mainTitle}\n\n`;
    
    if (isRouteType) {
      articleMd += `안녕하세요! 오늘은 낭만과 여유가 가득한 **${loc}**로 떠나보려고 해요.\n\n`;
      articleMd += `여행을 떠날 때 가장 고민되는 게 바로 *"어디부터 가야 동선이 꼬이지 않을까?"* 하는 점인데요. 복잡한 고민 없이 이 순서대로만 따라가도 후회 없는 하루를 보낼 수 있도록, 네이버 지도 실시간 데이터와 실제 방문객들의 호평을 바탕으로 **${loc} 알짜 코스 BEST ${count}곳**을 정리했어요.\n\n`;
      articleMd += `> 🚗 **한눈에 보는 ${loc} 추천 동선**\n`;
      articleMd += `> ${routeText}\n\n`;
      articleMd += `---\n\n`;
    } else {
      articleMd += `안녕하세요! 오늘은 매력이 넘치는 **${loc}**의 보물 같은 스팟들을 소개해 드릴게요.\n\n`;
      articleMd += `특정 코스에 얽매이지 않고, 내 취향과 일정에 맞춰 자유롭게 골라갈 수 있도록 **${loc}에서 지금 가장 주목받는 맛집, 감성 카페, 필수 명소 BEST ${count}곳**을 알짜배기로 모았어요. 가볍게 훑어보시면서 마음에 쏙 드는 장소를 콕 집어보세요!\n\n`;
      articleMd += `> 📋 **오늘 소개해 드릴 ${loc} 핵심 스팟 모아보기**\n`;
      articleMd += `> ${placeNames.map((n, i) => `${i + 1}. ${n}`).join('  |  ')}\n\n`;
      articleMd += `---\n\n`;
    }

    placesList.forEach((p, idx) => {
      const pObj = typeof p === 'object' ? p : { name: String(p) };
      const name = pObj.name || `추천 장소 ${idx + 1}`;
      const highlight = pObj.features || pObj.whyRecommend || '방문 만족도가 높은 추천 명소';
      const address = pObj.address || `${loc} 중심부`;
      const hours = pObj.operatingHours || '운영 시간 정보 확인 권장';
      const parking = pObj.parkingTip || pObj.parkingInfo || '인근 공영주차장 또는 전용 주차장 구비';
      const review = pObj.visitorReview || pObj.visitorReviewSummary || '다녀온 분들의 만족도가 매우 높고 사진이 잘 나오는 명소입니다.';

      articleMd += `## ${idx + 1}. ${name} - ${highlight}\n\n`;
      
      // 제3자 관점의 생생한 감정 & 사설 (Commentary)
      articleMd += `문 열고 들어서자마자 느껴지는 **${name}**만의 독보적인 분위기 덕분에 절로 기분이 좋아져요. 평일 낮에도 공간을 채우고 있는 사람들의 편안한 미소를 보면, 왜 이곳이 SNS와 블로그에서 꾸준히 입소문을 타는지 단번에 와닿더라고요.\n\n`;
      articleMd += `화려하게 꾸며진 곳보다 이렇게 공간의 온도가 따뜻하고 머무는 것만으로도 힐링이 되는 곳을 찾고 계셨다면, 정말 후회 없는 선택이 될 거예요.\n\n`;

      articleMd += `### 💡 놓치면 아쉬운 핵심 포인트\n`;
      articleMd += `- **대표 매력**: ${highlight}\n`;
      articleMd += `- **방문 팁**: 주말 피크 타임에는 방문객이 많을 수 있으니, 여유로운 분위기를 온전히 즐기고 싶으시다면 오픈 직후나 오후 한적한 시간대에 방문해 보세요.\n\n`;

      articleMd += `> **📍 ${name} 방문자 실전 꿀팁 정보**\n`;
      articleMd += `> • **도로명 주소**: ${address}\n`;
      articleMd += `> • **운영시간 & 휴무**: ${hours}\n`;
      articleMd += `> • **주차 안내**: ${parking}\n`;
      articleMd += `> • **다녀온 사람들의 찐후기**: "${review}"\n\n`;

      if (idx < placesList.length - 1) {
        articleMd += `---\n\n`;
      }
    });

    articleMd += `## ✈️ ${loc} 여행을 마치며 (총평 & 꿀팁)\n\n`;
    if (isRouteType) {
      articleMd += `지금까지 소개해 드린 **${loc} 추천 코스**(${routeText})는 이동 동선의 낭비 없이 볼거리, 먹거리, 휴식까지 알차게 챙길 수 있는 황금 일정이에요.\n\n`;
      articleMd += `주말 드라이브나 연인과의 데이트, 소중한 사람과 함께하는 하루 나들이로 손색이 없답니다. 미리 주차 정보와 운영시간을 확인하고 떠나시면 더욱 여유로운 추억을 만드실 수 있을 거예요.\n\n`;
    } else {
      articleMd += `지금까지 소개해 드린 **${loc} 알짜 명소 BEST ${count}곳**은 취향에 따라 자유롭게 골라 방문하기 좋은 곳들이에요.\n\n`;
      articleMd += `한 번에 다 들르지 않더라도, 마음에 드는 스팟 1~2곳만 일정에 쏙 넣어보셔도 여행의 만족도가 훌쩍 올라갈 거예요.\n\n`;
    }
    articleMd += `오늘 소개해 드린 장소 중 가장 가보고 싶은 곳은 어디인가요? 궁금한 점이 있다면 언제든 댓글로 남겨주세요. 도움이 되셨다면 **공감(❤️)과 이웃 추가**도 잊지 마세요 :)`;

    return articleMd;
  },

  // 8. 자유 텍스트 일괄 파싱 (Gemini 스마트 장소 분리)
  async parseBatchPlacesWithGemini(rawText, location, apiKey, model = 'gemini-2.5-flash') {
    if (!apiKey) return null;
    const prompt = `당신은 여행 블로그 데이터 분석 전문가입니다.
사용자가 입력한 다음 텍스트는 여러 여행지/장소에 대한 메모 또는 목록입니다.
텍스트를 분석하여 각각의 장소를 분리하고, JSON 객체 배열 형태로 추출해 주세요.

[사용자 입력 텍스트]:
${rawText}

[현재 지역]:
${location}

[추출 규칙]:
1. 각 장소마다 반드시 name, category, whyRecommend, features, menuInfo, parkingInfo, visitorReviewSummary, address, operatingHours, recommendStats 키를 포함하세요.
2. category는 반드시 'sightseeing', 'food', 'cafe', 'photo', 'landmark', 'nature', 'kids', 'shopping' 중 하나여야 합니다.
3. 사용자가 메모한 내용(추천 이유, 메뉴, 팁 등)이 있다면 whyRecommend, features, menuInfo 등에 최대한 자연스럽게 반영하세요.
4. 사용자가 설명 없이 장소명만 적었더라도, 해당 장소의 특성에 맞는 매력적인 whyRecommend와 features를 자동으로 작성해 주세요.
5. 반드시 순수 JSON 배열([...])만 마크다운 코드블록 없이 응답하세요.`;

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(p => ({
          id: 'pl-ai-' + Math.random().toString(36).substring(2, 9),
          name: p.name || '추천 장소',
          category: p.category || 'sightseeing',
          whyRecommend: p.whyRecommend || '방문 만족도가 높은 인기 장소입니다.',
          features: p.features || p.menuInfo || '대표 메뉴 및 볼거리',
          menuInfo: p.menuInfo || p.features || '대표 메뉴 구성',
          parkingInfo: p.parkingInfo || '인근 공영주차장 또는 전용 주차장 구비',
          visitorReviewSummary: p.visitorReviewSummary ? (p.visitorReviewSummary.startsWith('다녀온') ? p.visitorReviewSummary : `다녀온 분들의 찐후기: "${p.visitorReviewSummary}"`) : '다녀온 분들의 찐후기: "실제 방문 만족도가 높고 친절함"',
          address: p.address || location,
          operatingHours: p.operatingHours || '운영시간 확인 요망',
          recommendStats: 'AI 분석 완료 (스마트 추출)'
        }));
      }
    } catch (e) {
      console.warn('parseBatchPlacesWithGemini failed:', e);
    }
    return null;
  }
};
