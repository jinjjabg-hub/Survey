/**
 * 서비스러닝 설문 → 구글시트 저장 코드
 * 구글시트 > 확장 프로그램 > Apps Script 에 이 내용을 통째로 붙여넣으세요.
 * '사장님', '관광객' 탭이 자동으로 만들어지고, 첫 줄 제목도 자동으로 채워집니다.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    const name = body.sheet === '사장님' ? '사장님' : '관광객';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const data = Object.assign({ '수신시각': new Date() }, body.data);

    // 제목 줄: 없는 항목은 오른쪽에 추가
    const lastCol = sh.getLastColumn();
    const headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    Object.keys(data).forEach(function (k) { if (headers.indexOf(k) < 0) headers.push(k); });
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);

    // 같은 응답번호가 이미 있으면 저장하지 않음 (재전송 중복 방지)
    const idCol = headers.indexOf('응답번호') + 1;
    if (idCol > 0 && sh.getLastRow() > 1) {
      const ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); });
      if (ids.indexOf(String(data['응답번호'])) >= 0) return out({ ok: true, dup: true });
    }

    const row = headers.map(function (h) { return data[h] !== undefined ? data[h] : ''; });
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('OK - 서비스러닝 설문 수신 서버 작동 중');
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
