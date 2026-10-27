// ═══════════════════════════════════════════════════════════════
// 보험 고객 관리툴 — Google Apps Script 서버 (보안 강화판)
//
//  · 모든 관리 요청은 비밀 키(SECRET_KEY)가 있어야 함 (POST 본문으로 전달)
//  · doGet 은 데이터를 주지 않음 (안내 문구만)
//  · 고객 링크는 "고객별 토큰"으로 그 고객 데이터만 조회 (getCustomerView)
//  · 저장은 개정번호(rev) 확인 + 잠금 + 줄어듦 방지 + 하루 1회 자동 백업
//
//  처음 설정:  createSecretKey() 를 한 번 실행 → 실행 로그의 키를 복사
//  키가 새면:  rotateSecretKey() 로 교체 (모든 기기에서 새 키 재입력)
// ═══════════════════════════════════════════════════════════════

const ROOT_FOLDER  = '보험관리툴';
const DATA_FILE    = '보험관리툴_데이터.json';
const PDF_SUB      = '제안서';
const BACKUP_SUB   = '백업';
const KEEP_DAYS    = 14;                    // 백업 보관 일수
const MAX_JSON_LEN = 10 * 1024 * 1024;      // 데이터 파일 상한
const MAX_B64_LEN  = 22 * 1024 * 1024;      // PDF(base64) 상한 ≈ 16MB
const TZ           = 'Asia/Seoul';

// ── 진입점 ─────────────────────────────────────────
function doGet(e) {
  return out({ ok: false, error: 'POST로만 사용할 수 있어요.' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); }
  catch (_) { return out({ ok: false, error: '잘못된 요청이에요.' }); }
  if (!isObj(body) || typeof body.action !== 'string') {
    return out({ ok: false, error: '잘못된 요청이에요.' });
  }

  try {
    // 고객 링크: 관리 키 대신 고객별 토큰으로 인증
    if (body.action === 'getCustomerView') return out(getCustomerView(body));

    // 그 외 모든 동작은 비밀 키 필요
    if (!checkKey(body.key)) {
      Utilities.sleep(300);
      return out({ ok: false, error: 'unauthorized' });
    }
    switch (body.action) {
      case 'ping':       return out({ ok: true });
      case 'meta':       return out(metaInfo());
      case 'load':       return out(loadData());
      case 'save':       return out(saveData(body));
      case 'uploadFile': return out(handleUpload(body));
      default:           return out({ ok: false, error: '알 수 없는 요청이에요.' });
    }
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

// ── 비밀 키 ────────────────────────────────────────
function secretKey() {
  return PropertiesService.getScriptProperties().getProperty('SECRET_KEY') || '';
}

// 길이 확인 후 끝까지 비교 (조기 종료 없음)
function safeEqual(a, b) {
  a = String(a == null ? '' : a);
  b = String(b == null ? '' : b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function checkKey(k) {
  const s = secretKey();
  if (!s || s.length < 32) return false;      // 미설정이면 전부 거절
  return safeEqual(k, s);
}

function newKey() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');  // 64자
}

function createSecretKey() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SECRET_KEY')) {
    Logger.log('이미 비밀 키가 있어요. 바꾸려면 rotateSecretKey() 를 실행하세요.');
    return;
  }
  const key = newKey();
  props.setProperty('SECRET_KEY', key);
  Logger.log('비밀 키 (앱의 ⚙️ 서버 설정에 입력, 다른 곳에 공유 금지):\n' + key);
}

function rotateSecretKey() {
  const key = newKey();
  PropertiesService.getScriptProperties().setProperty('SECRET_KEY', key);
  Logger.log('새 비밀 키 (모든 기기에서 다시 입력해야 해요):\n' + key);
}

// ── 데이터 읽기/검증 ────────────────────────────────
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function readData(file) {
  const txt = file.getBlob().getDataAsString();
  let d;
  try { d = JSON.parse(txt); }
  catch (_) {
    // 비어 있는 새 파일이 아니라면 손상으로 보고 중단 (빈 데이터로 덮어쓰지 않도록)
    if (txt && txt.trim().length > 2) {
      throw new Error('데이터 파일을 읽을 수 없어요. 드라이브의 백업 폴더를 확인해주세요.');
    }
    d = {};
  }
  if (!isObj(d)) d = {};
  d.contracts = Array.isArray(d.contracts) ? d.contracts : [];
  d.monthly   = Array.isArray(d.monthly)   ? d.monthly   : [];
  d.groups    = isObj(d.groups)    ? d.groups    : {};
  d.coverages = isObj(d.coverages) ? d.coverages : {};
  d.memos     = isObj(d.memos)     ? d.memos     : {};
  d.shares    = isObj(d.shares)    ? d.shares    : {};
  d.tombstones = isObj(d.tombstones) ? d.tombstones : {};
  d.settings  = isObj(d.settings)  ? d.settings  : {};
  d.rev       = Number(d.rev) || 0;
  return d;
}

function metaInfo() {
  const d = readData(getDataFile());
  return {
    ok: true, rev: d.rev, savedAt: d.savedAt || '',
    counts: {
      contracts: d.contracts.length,
      customers: Object.keys(d.coverages).length,
      memos: Object.keys(d.memos).length
    }
  };
}

function loadData() {
  const d = readData(getDataFile());
  return { ok: true, rev: d.rev, data: d };
}

// ── 저장 (개정번호 확인 + 잠금 + 줄어듦 방지 + 백업) ───
function saveData(body) {
  const inc = body.data;
  if (!isObj(inc)) return { ok: false, error: '잘못된 데이터예요.' };
  if (!Array.isArray(inc.contracts) || !Array.isArray(inc.monthly) ||
      !isObj(inc.groups) || !isObj(inc.coverages) || !isObj(inc.memos)) {
    return { ok: false, error: '데이터 모양이 올바르지 않아요.' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, error: '다른 저장이 진행 중이에요. 잠시 후 다시 시도해주세요.' };
  }
  try {
    const file = getDataFile();
    const cur  = readData(file);
    const force = body.force === true;

    // 앱이 마지막으로 본 개정번호와 다르면 덮어쓰지 않고 서버 데이터를 돌려줌
    if (!force && Number(body.baseRev) !== cur.rev) {
      return { ok: false, conflict: true, rev: cur.rev, data: cur };
    }

    // 줄어듦 방지: 계약 수 / 고객(보장분석) 수가 절반 아래로 줄면 중단
    if (!force) {
      const shrunk = (before, after) => before >= 4 && after < before / 2;
      if (shrunk(cur.contracts.length, inc.contracts.length) ||
          shrunk(Object.keys(cur.coverages).length, Object.keys(inc.coverages).length)) {
        return { ok: false, error: 'shrink', rev: cur.rev };
      }
    }

    const next = {
      contracts: inc.contracts,
      monthly:   inc.monthly,
      groups:    inc.groups,
      coverages: inc.coverages,
      memos:     inc.memos,
      shares:    isObj(inc.shares) ? inc.shares : {},
      tombstones: isObj(inc.tombstones) ? inc.tombstones : {},
      settings:  isObj(inc.settings)  ? inc.settings  : {},
      version:   2,
      rev:       cur.rev + 1,
      savedAt:   new Date().toISOString()
    };
    const text = JSON.stringify(next);
    if (text.length > MAX_JSON_LEN) return { ok: false, error: '데이터가 너무 커요.' };

    backupBefore(file, force);
    file.setContent(text);
    return { ok: true, rev: next.rev, savedAt: next.savedAt };
  } finally {
    lock.releaseLock();
  }
}

// ── 백업 (하루 1회, 14일 보관 / 복원 저장 직전엔 항상) ─
function backupBefore(file, force) {
  const folder = getFolder(BACKUP_SUB, getRoot());
  const now = new Date();
  const day = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  let name;
  if (force) {
    name = '보험관리툴_데이터_' + day + '_' + Utilities.formatDate(now, TZ, 'HHmmss') + '_복원전.json';
  } else {
    name = '보험관리툴_데이터_' + day + '.json';
    if (folder.getFilesByName(name).hasNext()) { pruneBackups(folder); return; }
  }
  file.makeCopy(name, folder);
  pruneBackups(folder);
}

function pruneBackups(folder) {
  const limit = Date.now() - KEEP_DAYS * 86400000;
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getDateCreated().getTime() < limit) f.setTrashed(true);
  }
}

// ── 고객 링크: 토큰이 그 고객을 정하고, 그 고객 데이터만 반환 ────
// 링크에 들어 있는 이름은 화면 표시용일 뿐 믿지 않아요 → 이름을 바꿔도 링크는 그대로 열려요.
// shares 의 열쇠는 가입자 고유 번호(pid_…) 이고, 번호가 생기기 전의 예전 링크(열쇠가 이름)도 그대로 열려요.
function isPidKey(k) { return /^pid_[a-z0-9_]+$/.test(String(k)); }

function personNameOfContracts(cs) {              // 가장 많이 쓰인 이름 (동률이면 최근 계약의 이름)
  const cnt = {};
  cs.forEach(function (c) { cnt[c.p] = (cnt[c.p] || 0) + 1; });
  let best = null;
  cs.slice().sort(function (a, b) { return (Number(b.id) || 0) - (Number(a.id) || 0); }).forEach(function (c) {
    if (best === null || cnt[c.p] > cnt[best]) best = c.p;
  });
  return best === null ? '' : String(best);
}

function getCustomerView(body) {
  const token = String(body.token == null ? '' : body.token);
  const d = readData(getDataFile());
  const has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  // 모든 항목을 끝까지 비교해요 (일찍 멈추지 않음)
  let key = '';
  Object.keys(d.shares).forEach(function (k) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    const t = String(d.shares[k]);
    if (safeEqual(token, t) && t.length >= 32) key = k;
  });
  if (!key) { Utilities.sleep(300); return { ok: false, error: 'invalid' }; }

  const belongs = function (c) { return c && (isPidKey(key) ? c.pid === key : c.p === key); };
  const all  = d.contracts.filter(belongs);
  const mine = all.filter(function (c) { return c.s === '계약완료'; });
  // 고객 화면에 필요한 최소 필드만 (계약자·그룹·메모·제안서 링크 등은 제외)
  const contracts = mine.map(function (c) {
    return { id: c.id, s: c.s, d: c.d, p: c.p, pid: c.pid || '', co: c.co, n: c.n, pr: c.pr };
  });
  const coverages = {};
  coverages[key] = has(d.coverages, key) ? d.coverages[key] : { policies: [] };
  // 관리 화면과 같은 담보 그룹으로 보이도록 그룹 설정만 전달 (다른 설정은 보내지 않음)
  const settings = {};
  if (isObj(d.settings.covGroups)) settings.covGroups = d.settings.covGroups;
  return {
    ok: true, key: key,
    name: isPidKey(key) ? personNameOfContracts(all) : key,
    contracts: contracts, coverages: coverages, settings: settings
  };
}

// ── PDF 업로드: 보험관리툴/제안서/고객이름/파일.pdf ─────
function handleUpload(body) {
  const b64 = String(body.base64 == null ? '' : body.base64);
  if (!b64 || b64.length > MAX_B64_LEN) {
    return { ok: false, error: '파일이 비어 있거나 너무 커요.' };
  }
  const bytes = Utilities.base64Decode(b64);
  // PDF 파일 머리글(%PDF-) 확인
  if (!(bytes.length > 5 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 &&
        bytes[3] === 70 && bytes[4] === 45)) {
    return { ok: false, error: 'PDF 파일만 올릴 수 있어요.' };
  }
  let filename = sanitize(body.filename || '제안서.pdf');
  if (!/\.pdf$/i.test(filename)) filename += '.pdf';
  const customer = sanitize(body.customerFolder || '미분류');

  const dir = getFolder(customer, getFolder(PDF_SUB, getRoot()));
  const old = dir.getFilesByName(filename);
  while (old.hasNext()) old.next().setTrashed(true);

  const blob  = Utilities.newBlob(bytes, MimeType.PDF, filename);
  const saved = dir.createFile(blob);
  saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    ok: true,
    viewUrl: saved.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + saved.getId(),
    fileId: saved.getId(),
    path: ROOT_FOLDER + '/' + PDF_SUB + '/' + customer + '/' + filename
  };
}

// ── 드라이브 유틸 ───────────────────────────────────
function getRoot() { return getFolder(ROOT_FOLDER, null); }

function getFolder(name, parent) {
  const it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

function getDataFile() {
  const root  = getRoot();
  const files = root.getFilesByName(DATA_FILE);
  if (files.hasNext()) return files.next();
  return root.createFile(
    DATA_FILE,
    JSON.stringify({ contracts: [], monthly: [], groups: {}, coverages: {}, memos: {}, shares: {}, rev: 0 }),
    MimeType.PLAIN_TEXT
  );
}

function sanitize(name) {
  return String(name == null ? '' : name)
    .replace(/[\u0000-\u001f\/\\:*?"<>|]/g, '_')
    .trim()
    .slice(0, 80) || '미분류';
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
