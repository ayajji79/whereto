/**
 * Google Apps Script (GAS) 코드 템플릿
 * 구글 스프레드시트에 여행 블로그 대시보드 데이터를 실시간 영구 보관/조회하는 웹앱 코드
 */
window.GAS_CODE_TEMPLATE = `/**
 * 여행 블로그 올인원 대시보드 Google Apps Script 연동 코드
 * 
 * [배포 방법]
 * 1. 새 구글 스프레드시트 생성 (제목: 여행블로그_콘텐츠_DB)
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 3. 기존 코드를 모두 지우고 이 코드를 전체 붙여넣기
 * 4. 우측 상단 [배포] > [새 배포] 클릭
 * 5. 유형 선택: [웹 앱] (톱니바퀴 아이콘)
 * 6. 설정:
 *    - 설명: 여행 블로그 DB v1
 *    - 다음 사용자 권한으로 실행: '나(내 계정)'
 *    - 액세스 권한이 있는 사용자: '모든 사용자(Anyone)' (반드시 선택!)
 * 7. [배포] 버튼 클릭 후 생성된 [웹 앱 URL]을 복사하여 대시보드 설정창에 입력
 */

function doGet(e) {
  var action = e.parameter.action || 'ping';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'ping') {
    return jsonResponse({ status: 'ok', message: '스프레드시트가 성공적으로 연결되었습니다.', timestamp: new Date().toISOString() });
  }
  
  if (action === 'getHistory') {
    var sheet = getOrCreateSheet(ss, 'History', ['ID', '일시', '지역', '장소명', '테마', 'SEO키워드', '메타설명', '마스터프롬프트', '본문내용', 'SNS패키지']);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonResponse({ status: 'ok', data: [] });
    
    var headers = data[0];
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      rows.push(obj);
    }
    return jsonResponse({ status: 'ok', data: rows });
  }

  if (action === 'getQuickLinks') {
    var sheet = getOrCreateSheet(ss, 'QuickLinks', ['id', 'title', 'url', 'category', 'icon']);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonResponse({ status: 'ok', data: [] });
    var headers = data[0];
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      var item = {};
      for (var j = 0; j < headers.length; j++) {
        item[headers[j]] = data[i][j];
      }
      rows.push(item);
    }
    return jsonResponse({ status: 'ok', data: rows });
  }

  return jsonResponse({ status: 'error', message: '알 수 없는 요청입니다.' });
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;

    if (action === 'ping') {
      return jsonResponse({ status: 'ok', message: 'POST Ping 성공' });
    }

    if (action === 'saveHistory') {
      var sheet = getOrCreateSheet(ss, 'History', ['ID', '일시', '지역', '장소명', '테마', 'SEO키워드', '메타설명', '마스터프롬프트', '본문내용', 'SNS패키지']);
      var item = postData.data;
      var row = [
        item.id || ('H_' + new Date().getTime()),
        item.createdAt || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"),
        item.location || '',
        item.placeName || '',
        item.theme || '',
        item.seoKeywords || '',
        item.metaDescription || '',
        item.masterPrompt || '',
        item.articleContent || '',
        JSON.stringify(item.snsPackage || {})
      ];
      sheet.appendRow(row);
      return jsonResponse({ status: 'ok', message: '히스토리가 구글 시트에 안전하게 저장되었습니다.', id: row[0] });
    }

    if (action === 'saveQuickLinks') {
      var sheet = getOrCreateSheet(ss, 'QuickLinks', ['id', 'title', 'url', 'category', 'icon']);
      // 기존 데이터 초기화 후 재작성
      sheet.clearContents();
      sheet.appendRow(['id', 'title', 'url', 'category', 'icon']);
      var links = postData.data || [];
      for (var i = 0; i < links.length; i++) {
        sheet.appendRow([links[i].id, links[i].title, links[i].url, links[i].category, links[i].icon]);
      }
      return jsonResponse({ status: 'ok', message: '퀵 링크가 스프레드시트에 동기화되었습니다.' });
    }

    return jsonResponse({ status: 'error', message: '지원하지 않는 Action입니다.' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#2563EB').setFontColor('#FFFFFF').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
