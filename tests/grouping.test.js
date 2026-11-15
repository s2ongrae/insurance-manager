// 그루핑 (2026-11-15 점검): 저장해 둔 그룹 설정과 줄별 그룹 지정이 깨지지 않게
const { makeDevice } = require('./lib/ins_smoke_harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ❌', m); } };
const P = 'pid_t', PK = '다라생명\n내계약';
const seed = (cov, extra) => makeDevice({ session: { ins_unlocked: '1' }, ls: Object.assign({
  ins_contracts: JSON.stringify([{ id: 1, pid: P, c: '가', p: '가', co: '다라생명', n: '내계약', s: '계약완료', d: '25.01.01', pr: 50000, g: '지인' }]),
  ins_coverages: JSON.stringify({ [P]: cov }), ins_monthly: '[]', ins_groups: '{}' }, extra || {}) });
const mv = D => D.get(`COVERAGES['${P}'].matrixView`);
const grpOf = (D, n) => D.get(`(COVERAGES['${P}'].matrixView[${JSON.stringify(n)}]||{}).__group || getCovGroup(${JSON.stringify(n)}).label`);

console.log('A) 그룹 이름을 바꾸면 줄마다 옮겨 둔 그룹 지정도 따라감');
{ const D = seed({ covNameVer: 3, policies: [{ id: 1, items: [{ name: '골절 진단비', amount: 30 }] }], matrixView: { '골절 진단비': { __group: '💀 사망·장해·후유' } } });
  ok(D.errors.length === 0, '로드 오류 없음 ' + D.errors.join('|'));
  ok(grpOf(D, '골절 진단비') === '💀 사망·장해·후유', '처음: 직접 옮겨 둔 사망 그룹');
  D.run('openCovGroupEditor()');
  D.run(`_cgDraft.find(g=>g.label==='💀 사망·장해·후유').label='💀 사망·장해'`);
  D.run('saveCovGroupsUI()');
  ok(D.get(`COV_GROUPS.some(g=>g.label==='💀 사망·장해')`), '그룹 이름이 바뀜');
  ok(grpOf(D, '골절 진단비') === '💀 사망·장해', '골절 줄도 새 이름 그룹에 그대로 (예전엔 교통·상해로 돌아감)');
  ok(D.get(`SETTINGS.covGroups.list.some(g=>g.label==='💀 사망·장해')`), '설정(동기화 대상)에도 저장');
}

console.log('B) 그룹 설정 창에서 취소하면 아무것도 바뀌지 않음');
{ const D = seed({ policies: [] });
  D.run('saveCovGroups()');                                     // 한 번 저장된 뒤 (예전엔 이때부터 같은 배열을 나눠 씀)
  const before = JSON.stringify(D.get('COV_GROUPS'));
  D.run('openCovGroupEditor()'); D.run(`_cgDraft[2].label='임시'; _cgDraft[0].keys=['x']`);
  D.run(`closeModal('covgroups')`);
  ok(JSON.stringify(D.get('COV_GROUPS')) === before, '취소 후 그룹 목록 그대로');
  D.run('persistLocal()');                                      // 다른 저장이 일어나도
  ok(!JSON.parse(D.store.get('ins_settings')).covGroups.list.some(g => g.label === '임시'), '다른 저장 때도 취소한 내용이 새어 나가지 않음');
  D.run('openCovGroupEditor()');
  ok(D.get('_cgDraft[2].label') !== '임시', '다시 열면 저장된 상태로 시작');
}

console.log('C) 그룹을 지우면 그 그룹으로 옮겨 둔 줄은 키워드 그룹으로 (다른 줄은 그대로)');
{ const D = seed({ covNameVer: 3, policies: [{ id: 1, items: [{ name: '골절 진단비', amount: 30 }, { name: '뇌졸중 진단비', amount: 10 }] }],
    matrixView: { '골절 진단비': { __group: '👵 간병·치매' }, '뇌졸중 진단비': { __group: '🎗️ 암 관련 보장' } } });
  D.confirmQ.push(true);
  D.run('openCovGroupEditor()'); D.run(`delCovGroup(_cgDraft.findIndex(g=>g.label==='👵 간병·치매'))`); D.run('saveCovGroupsUI()');
  ok(!D.get(`COV_GROUPS.some(g=>g.label==='👵 간병·치매')`), '그룹이 지워짐');
  ok(!mv(D)['골절 진단비'] || !mv(D)['골절 진단비'].__group, '지운 그룹을 가리키던 지정은 정리');
  ok(grpOf(D, '골절 진단비') === '🚗 교통·상해', '골절은 키워드(골절) 그룹으로');
  ok(mv(D)['뇌졸중 진단비'].__group === '🎗️ 암 관련 보장', '다른 그룹 지정은 그대로');
}

console.log('D) 담보 이름 통합으로 한 줄이 여러 줄로 나뉘면 모두 같은 그룹을 이어받음');
{ const D = seed({ policies: [{ id: 1, items: [{ name: '유사암진단비', amount: 100 }, { name: '갑상선암진단비', amount: 200 }, { name: '경계성종양진단비', amount: 300 }] }],
    matrixView: { '유사암·소액암 진단비': { __group: '💀 사망·장해·후유' } } });
  D.run(`renderCovDetail('${P}')`); const m = mv(D);
  ok(['유사암 진단비', '갑상선암 진단비', '경계성종양 진단비'].every(n => m[n] && m[n].__group === '💀 사망·장해·후유'), '세 줄 모두 직접 지정한 그룹 (예전엔 첫 줄만)');
  const D2 = seed({ policies: [{ id: 1, items: [{ name: '질병입원일당', amount: 3 }, { name: '상해입원일당', amount: 2 }] }], matrixView: { '질병·상해 입원일당': { __group: '🚗 교통·상해' } } });
  D2.run(`renderCovDetail('${P}')`); const m2 = mv(D2);
  ok(m2['질병 입원일당'] && m2['질병 입원일당'].__group === '🚗 교통·상해' && m2['상해 입원일당'] && m2['상해 입원일당'].__group === '🚗 교통·상해', '예전에 묶였던 입원일당 두 줄도 그룹 유지');
  ok(!m2['질병·상해 입원일당'], '담보 없는 빈 껍데기 줄은 남지 않음');
}

console.log('E) "＋ 담보"가 이미 있는 줄을 다른 그룹으로 옮기지 않음');
{ const D = seed({ covNameVer: 3, policies: [{ id: 1, items: [{ name: '일반암 진단비', amount: 2000 }] }] });
  D.run(`renderCovDetail('${P}')`);
  D.el('tmp-name').value = '암진단비'; D.el('tmp-amt').value = '3000'; D.el('tmp-pol').value = '1';
  D.run(`_addRowState={customer:'${P}',contracts:[{id:1,co:'다라생명',n:'내계약'}],grpLabel:'📋 기타 보장'}; confirmAddMatrixRow()`);
  const m = mv(D);
  ok(!m['일반암 진단비'].__group && grpOf(D, '일반암 진단비') === '🎗️ 암 관련 보장', '일반암 진단비는 암 그룹 그대로 (예전엔 기타로 옮겨감)');
  ok(m['일반암 진단비'][PK] === 5000, '그 보험 칸은 원래 2000 + 3000 = 5000');
  ok(!m['암진단비'], '표준 이름이 아닌 줄을 따로 만들지 않음');
  D.el('tmp-name').value = '특수고객전용담보'; D.el('tmp-amt').value = '10'; D.el('tmp-pol').value = '1';
  D.run(`_addRowState={customer:'${P}',contracts:[{id:1,co:'다라생명',n:'내계약'}],grpLabel:'📋 기타 보장'}; confirmAddMatrixRow()`);
  const k = D.get(`normCovName('특수고객전용담보')||'특수고객전용담보'`);
  ok(mv(D)[k] && mv(D)[k].__group === '📋 기타 보장' && mv(D)[k][PK] === 10, '새 담보는 누른 그룹에 새 줄로');
}

console.log('F) 기존 보험(ext_ 번호)에도 "＋ 담보"로 넣을 수 있음');
{ const D = seed({ covNameVer: 3, policies: [], otherPolicies: [{ id: 'ext_17', co: '옛보험사', name: '옛상품', price: 1, items: [] }] });
  D.run(`renderCovDetail('${P}')`);
  D.el('tmp-name').value = '골절 진단비'; D.el('tmp-amt').value = '20'; D.el('tmp-pol').value = 'ext_17';
  D.run(`_addRowState={customer:'${P}',contracts:[{id:'ext_17',co:'옛보험사',n:'옛상품',_ext:true}],grpLabel:''}; confirmAddMatrixRow()`);
  ok(mv(D)['골절 진단비'] && mv(D)['골절 진단비']['옛보험사\n옛상품'] === 20, '기존 보험 칸에 들어감');
}

console.log('G) 경계성종양: 표기가 달라도 한 줄, 저장된 그룹 설정의 유사암 그룹으로');
{ const D = seed({ policies: [] });
  ok(D.get(`normCovName('경계성종양진단비')`) === '경계성종양 진단비' && D.get(`normCovName('경계성종양 진단비(최초1회한)')`) === '경계성종양 진단비', '두 표기 → "경계성종양 진단비" 한 줄');
  ok(D.get(`normCovName('경계성종양 진단비')`) === '경계성종양 진단비', '표준 이름은 그대로 (고정점)');
  ok(D.get(`getCovGroup('경계성종양 진단비').label`) === '🎗️ 암 관련 보장', '기본 설정에서는 암 그룹');
  const custom = [{ label: '🅰 소액암', color: '#111111', bg: '#eeeeee', border: '#cccccc', keys: ['유사암', '갑상선'] }, { label: '🅱 기타', color: '#222222', bg: '#eeeeee', border: '#cccccc', keys: [] }];
  const D2 = seed({ policies: [] }, { ins_settings: JSON.stringify({ covGroups: { list: custom } }) });
  ok(D2.get(`getCovGroup('경계성종양 진단비').label`) === '🅰 소액암', '저장해 둔 그룹 설정에서는 "유사암" 키워드가 있는 그룹으로');
}

console.log(`\n그루핑 테스트: ${pass}건 통과, ${fail}건 실패`); process.exit(fail ? 1 : 0);
