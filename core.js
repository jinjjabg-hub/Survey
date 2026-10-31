// 설문 공통 엔진: 화면 그리기, 건너뛰기, 최대 선택, 단독 선택, 전송(오프라인 대기열)
(function () {
  const SL = (window.SL = {});
  const SKIP = '건너뜀';
  SL.SKIP = SKIP;

  SL.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  SL.pad = (n) => String(n).padStart(2, '0');
  SL.now = () => {
    const d = new Date();
    return { date: `${d.getFullYear()}-${SL.pad(d.getMonth() + 1)}-${SL.pad(d.getDate())}`, time: `${SL.pad(d.getHours())}:${SL.pad(d.getMinutes())}` };
  };
  SL.rid = (p) => {
    const d = new Date();
    return `${p}-${SL.pad(d.getMonth() + 1)}${SL.pad(d.getDate())}-${SL.pad(d.getHours())}${SL.pad(d.getMinutes())}-${Math.floor(Math.random() * 900 + 100)}`;
  };
  SL.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  SL.fmt = (s, n) => String(s).replace('{n}', n);

  let toastT;
  SL.toast = (msg) => {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
  };

  // ---------- 설문 화면 ----------
  // questions: [{id,num,type,col,max,sec,show(A),opts:[{v,other,excl}],rows,cols,source}]
  // T(q) -> {t,n,o[],rows[],cols[],none,r1,r2,sec}
  SL.Survey = function (root, questions, T, ui) {
    const self = this;
    const byId = {};
    questions.forEach((q) => (byId[q.id] = q));

    function optsHtml(q, tx) {
      const isRadio = q.type === 'single';
      return '<div class="opts">' + q.opts.map((o, i) =>
        `<label class="opt"><input type="${isRadio ? 'radio' : 'checkbox'}" name="${q.id}" value="${i}"><span>${SL.esc(tx.o[i])}</span></label>` +
        (o.other ? `<input class="other" data-q="${q.id}" data-i="${i}" placeholder="${SL.esc(ui.otherPh)}" hidden>` : '')
      ).join('') + '</div>';
    }

    function qHtml(q) {
      const tx = T(q);
      let h = '';
      if (tx.sec) h += `<h2 class="sec" data-sec="${q.id}">${SL.esc(tx.sec)}</h2>`;
      let tag = '';
      if (q.type === 'multi') tag = q.max ? SL.fmt(ui.upto, q.max) : ui.all;
      h += `<section class="q" id="sec-${q.id}" data-q="${q.id}"><h3><b class="num">${q.num}</b>${SL.esc(tx.t)}${tag ? ` <em class="tag">${SL.esc(tag)}</em>` : ''}</h3>`;
      if (tx.n) h += `<p class="hint">${SL.esc(tx.n)}</p>`;
      if (q.type === 'single' || q.type === 'multi') h += optsHtml(q, tx);
      if (q.type === 'matrix') {
        h += '<div class="matrix">' + q.rows.map((r, ri) =>
          `<div class="mrow"><div class="mlabel">${SL.esc(tx.rows[ri])}</div>` +
          (r.other ? `<input class="other" data-q="${q.id}" data-row="${ri}" placeholder="${SL.esc(ui.otherPh)}" style="margin-bottom:8px">` : '') +
          '<div class="mcols">' + q.cols.map((c, ci) =>
            `<label class="mc"><input type="radio" name="${q.id}_${ri}" value="${ci}"><span>${SL.esc(tx.cols[ci])}</span></label>`).join('') +
          '</div></div>').join('') + '</div>';
      }
      if (q.type === 'rank') {
        const src = byId[q.source];
        const srcTx = T(src);
        const options = '<option value="">' + SL.esc(ui.choose) + '</option>' +
          src.rows.map((r, i) => `<option value="${i}">${SL.esc(srcTx.rows[i])}</option>`).join('');
        h += `<div class="rank">
          <label class="r">${SL.esc(tx.r1)}<select data-rank="1">${options}</select></label>
          <label class="r">${SL.esc(tx.r2)}<select data-rank="2">${options}</select></label>
          <label class="opt"><input type="checkbox" class="rank-none"><span>${SL.esc(tx.none)}</span></label></div>`;
      }
      if (q.type === 'text') h += `<textarea data-q="${q.id}" placeholder="${SL.esc(ui.textPh || '')}"></textarea>`;
      if (tx.end) h += `<div class="endnote" data-end="${q.id}" hidden>${SL.esc(tx.end)}</div>`;
      h += '</section>';
      return h;
    }

    // 현재 답(한국어 기준값) 조회 도우미
    const A = {
      vals(id) {
        const q = byId[id];
        return [...root.querySelectorAll(`input[name="${id}"]:checked`)].map((el) => q.opts[+el.value].v);
      },
      is(id, v) { return A.vals(id).includes(v); },
      any(id) { return A.vals(id).length > 0; }
    };
    self.A = A;

    function update() {
      questions.forEach((q) => {
        const vis = !q.show || q.show(A);
        const sec = root.querySelector(`#sec-${q.id}`);
        sec.hidden = !vis;
        const h2 = root.querySelector(`h2[data-sec="${q.id}"]`);
        if (h2) h2.hidden = !vis;
        if (q.endIf) {
          const en = sec.querySelector('.endnote');
          if (en) en.hidden = !q.endIf(A);
        }
      });
      root.querySelectorAll('input.other[data-i]').forEach((inp) => {
        const cb = root.querySelector(`input[name="${inp.dataset.q}"][value="${inp.dataset.i}"]`);
        inp.hidden = !cb.checked;
      });
    }

    function onOptChange(el) {
      const q = byId[el.name];
      if (!q) return;
      if (q.type === 'multi' && el.checked) {
        const o = q.opts[+el.value];
        const group = [...root.querySelectorAll(`input[name="${q.id}"]`)];
        if (o.excl) group.forEach((g) => { if (g !== el) g.checked = false; });
        else group.forEach((g) => { if (q.opts[+g.value].excl) g.checked = false; });
        const n = group.filter((g) => g.checked).length;
        if (q.max && n > q.max) { el.checked = false; SL.toast(SL.fmt(ui.maxMsg, q.max)); }
      }
      if (el.checked && q.opts[+el.value].other) {
        const inp = root.querySelector(`input.other[data-q="${q.id}"][data-i="${el.value}"]`);
        if (inp) setTimeout(() => inp.focus(), 50);
      }
    }

    self.update = () => update();
    self.render = function () {
      root.innerHTML = questions.map(qHtml).join('');
      // 라디오는 한 번 더 누르면 선택 해제(건너뛰기 가능)
      root.querySelectorAll('input[type=radio]').forEach((r) => {
        r.addEventListener('click', () => {
          if (r.dataset.was === '1') { r.checked = false; r.dataset.was = '0'; }
          else { root.querySelectorAll(`input[name="${r.name}"]`).forEach((x) => (x.dataset.was = '0')); r.dataset.was = '1'; }
          update();
        });
      });
      root.querySelectorAll('input[type=checkbox]:not(.rank-none)').forEach((c) =>
        c.addEventListener('change', () => { onOptChange(c); update(); }));
      const none = root.querySelector('.rank-none');
      if (none) {
        const sels = root.querySelectorAll('select[data-rank]');
        none.addEventListener('change', () => { if (none.checked) sels.forEach((s) => (s.value = '')); });
        sels.forEach((s) => s.addEventListener('change', () => {
          if (s.value) none.checked = false;
          const [a, b] = sels;
          if (a.value && a.value === b.value) { s.value = ''; SL.toast(ui.dupRank || '같은 항목은 한 번만 고를 수 있어요'); }
        }));
      }
      update();
    };

    // 구글시트로 보낼 값(한국어 기준) 모으기
    self.collect = function () {
      const out = {};
      let answered = 0;
      questions.forEach((q) => {
        const vis = !q.show || q.show(A);
        if (q.type === 'matrix') {
          q.rows.forEach((r, ri) => {
            const c = root.querySelector(`input[name="${q.id}_${ri}"]:checked`);
            const v = vis ? (c ? q.cols[+c.value] : '') : SKIP;
            if (c && vis) answered++;
            out[`${q.col}_${r.v}`] = v;
            if (r.other) {
              const t = root.querySelector(`input.other[data-q="${q.id}"][data-row="${ri}"]`).value.trim();
              out[`${q.col}_기타내용`] = vis ? t : SKIP;
            }
          });
          return;
        }
        if (q.type === 'rank') {
          const src = byId[q.source];
          const name = (i) => {
            if (i === '') return '';
            const r = src.rows[+i];
            if (r.other) {
              const t = root.querySelector(`input.other[data-q="${src.id}"][data-row="${i}"]`).value.trim();
              return t ? `기타: ${t}` : '기타';
            }
            return r.v;
          };
          const s1 = root.querySelector('select[data-rank="1"]').value;
          const s2 = root.querySelector('select[data-rank="2"]').value;
          const none = root.querySelector('.rank-none').checked;
          out[`${q.col}_1순위`] = vis ? (none ? '없음' : name(s1)) : SKIP;
          out[`${q.col}_2순위`] = vis ? (none ? '없음' : name(s2)) : SKIP;
          if (s1 || s2 || none) answered++;
          return;
        }
        if (q.type === 'text') {
          const t = root.querySelector(`textarea[data-q="${q.id}"]`).value.trim();
          out[q.col] = vis ? t : SKIP;
          if (t) answered++;
          return;
        }
        const picked = [...root.querySelectorAll(`input[name="${q.id}"]:checked`)].map((el) => +el.value);
        const vals = picked.map((i) => {
          const o = q.opts[i];
          if (!o.other) return o.v;
          const t = root.querySelector(`input.other[data-q="${q.id}"][data-i="${i}"]`).value.trim();
          return t ? `기타: ${t}` : '기타';
        });
        if (vis && vals.length) answered++;
        out[q.col] = vis ? vals.join(', ') : SKIP;
      });
      return { data: out, answered };
    };
  };

  // ---------- 전송 (인터넷이 끊겨도 폰에 저장했다가 다시 보냄) ----------
  let mem = [];
  const QK = 'sl_queue_v1';
  const qGet = () => { try { const v = localStorage.getItem(QK); return v ? JSON.parse(v) : mem; } catch (e) { return mem; } };
  const qSet = (v) => { mem = v; try { localStorage.setItem(QK, JSON.stringify(v)); } catch (e) {} };
  SL.pending = () => qGet().length;

  let flushing = null;
  SL.flush = function () {
    if (flushing) return flushing;
    flushing = (async () => {
      const url = (window.SL_CONFIG || {}).SCRIPT_URL;
      let q = qGet();
      if (!url) return { sent: 0, left: q.length, nourl: true };
      let sent = 0;
      while (q.length) {
        try {
          await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(q[0]) });
          q = qGet(); q.shift(); qSet(q); sent++;
        } catch (e) { break; }
      }
      return { sent, left: q.length };
    })().finally(() => { flushing = null; });
    return flushing;
  };
  SL.send = function (sheet, data) {
    const q = qGet(); q.push({ sheet, data }); qSet(q);
    return SL.flush();
  };
  window.addEventListener('online', () => SL.flush());
  window.addEventListener('load', () => { if (SL.pending()) SL.flush(); });
})();
