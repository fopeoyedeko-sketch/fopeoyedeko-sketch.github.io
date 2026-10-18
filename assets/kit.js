// Shared helpers for the home panel pages. Needs d3 v7 loaded first.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const PAGES = [['', 'Home'], ['energy/', 'Energy'], ['water/', 'Water'], ['vouchers/', 'Vouchers']];
  function nav(current, root) {
    const bar = document.createElement('header'); bar.className = 'bar';
    const n = document.createElement('nav'); n.setAttribute('aria-label', 'Pages');
    const mark = document.createElement('a'); mark.className = 'mark'; mark.href = root || './';
    mark.innerHTML = '<i aria-hidden="true"></i><span>Home panel</span>'; n.append(mark);
    PAGES.forEach(([href, label]) => {
      const a = document.createElement('a'); a.className = 'tab'; a.href = (root || './') + href; a.textContent = label;
      if (label === current) a.setAttribute('aria-current', 'page');
      n.append(a);
    });
    bar.append(n); document.body.prepend(bar);
  }

  function seg(el, options, value, onChange) {
    el.classList.add('seg'); el.setAttribute('role', 'group');
    const btns = options.map(([v, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.setAttribute('aria-pressed', String(v === value));
      b.onclick = () => { btns.forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onChange(v); };
      el.append(b); return b;
    });
  }

  function countUp(el, to, fmt, ms = 900) {
    if (reduce) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // Bar chart (single or stacked) with a hover column, tooltip and optional reference line.
  function bars(el, o) {
    const first = !el.dataset.drawn; el.dataset.drawn = '1';
    el.innerHTML = '';
    const rows = o.rows, keys = o.series.map(s => s.key);
    const W = Math.max(280, el.clientWidth), H = o.height || 260, mb = 26, mt = 10;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.label || 'Chart');
    const tip = d3.select(el).append('div').attr('class', 'tip');
    const tot = r => d3.sum(keys, k => +r[k] || 0);
    const yMax = Math.max(d3.max(rows, tot) || 1, o.ref ? o.ref.value : 0) * 1.12;
    const y = d3.scaleLinear([0, yMax], [H - mb, mt]).nice();
    const ticks = y.ticks(4);
    const probe = svg.append('text').text(o.yFormat(d3.max(ticks)));
    const ml = probe.node().getComputedTextLength() + 12; probe.remove();
    const x = d3.scaleBand(rows.map((_, i) => i), [ml, W - 2]).padding(rows.length > 40 ? .18 : .28);
    const g = svg.append('g');
    g.selectAll('line.g').data(ticks).join('line').attr('x1', ml).attr('x2', W).attr('y1', y).attr('y2', y).attr('stroke', css('--grid'));
    g.selectAll('text.y').data(ticks).join('text').attr('x', ml - 8).attr('y', d => y(d) + 4).attr('text-anchor', 'end').text(o.yFormat);
    const lw = 56, every = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor((W - ml) / lw))));
    rows.forEach((r, i) => { if (i % every === 0) g.append('text').attr('x', x(i) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(o.xFormat(r)); });

    const hl = svg.append('rect').attr('y', mt).attr('height', H - mb - mt).attr('rx', 6).attr('fill', css('--grid')).attr('opacity', 0);
    const bw = Math.min(30, x.bandwidth());
    const barG = svg.append('g');
    rows.forEach((r, i) => {
      let acc = 0; const x0 = x(i) + (x.bandwidth() - bw) / 2;
      o.series.forEach((s, j) => {
        const v = +r[s.key] || 0; if (!v && !(o.minBar && j === 0 && tot(r) === 0)) { return; }
        const top = y(acc + v), bot = y(acc), h = Math.max(o.minBar && tot(r) === 0 ? 2 : 0, bot - top);
        const last = j === o.series.length - 1 || o.series.slice(j + 1).every(t => !(+r[t.key]));
        const rect = barG.append('rect').attr('x', x0).attr('width', bw).attr('rx', last ? Math.min(5, bw / 2) : 0)
          .attr('fill', (o.colorOf && o.colorOf(r, s)) || s.color);
        if (first && !reduce) rect.attr('y', y(0)).attr('height', 0).transition().delay(i * Math.min(12, 600 / rows.length)).duration(500).ease(d3.easeCubicOut).attr('y', bot - h).attr('height', h);
        else rect.attr('y', bot - h).attr('height', h);
        acc += v;
      });
    });
    if (o.ref) {
      svg.append('line').attr('x1', ml).attr('x2', W).attr('y1', y(o.ref.value)).attr('y2', y(o.ref.value)).attr('stroke', css('--bad')).attr('stroke-width', 1.5).attr('stroke-dasharray', '5 4');
    }
    const show = (i, ev) => {
      const r = rows[i]; hl.attr('x', x(i) - x.step() * x.paddingInner() / 2).attr('width', x.step()).attr('opacity', .7);
      const t = o.tip(r); tip.html('');
      tip.append('div').attr('class', 't').text(t.title);
      t.lines.forEach(([c, k, v]) => { const d = tip.append('div').attr('class', 'r'); if (c) d.append('i').attr('class', 'sw').style('background', c); d.append('span').text(k); d.append('b').text(v); });
      const [mx, my] = ev ? d3.pointer(ev, el) : [x(i), 40];
      const tw = tip.node().offsetWidth || 160;
      tip.style('left', Math.min(Math.max(0, mx + 14), el.clientWidth - tw) + 'px').style('top', Math.max(0, my - 60) + 'px').classed('on', true);
    };
    const hide = () => { hl.attr('opacity', 0); tip.classed('on', false); };
    svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml).attr('height', H - mb).attr('fill', 'transparent')
      .on('pointermove', ev => { const [px] = d3.pointer(ev); const i = Math.max(0, Math.min(rows.length - 1, Math.floor((px - ml) / x.step()))); show(i, ev); })
      .on('pointerleave', hide);
  }

  const fmt = {
    gbp: v => '£' + d3.format(',.2f')(v),
    gbp0: v => '£' + d3.format(',.0f')(v),
    int: v => d3.format(',.0f')(v),
    pct: v => d3.format('.0%')(v),
  };
  async function load(urls) {
    const v = '?v=' + Date.now();
    return Promise.all(urls.map(u => u.endsWith('.json') ? d3.json(u + v) : d3.csv(u + v, d3.autoType)));
  }
  function onResize(fn) { let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 150); }); }

  window.kit = { nav, seg, bars, countUp, fmt, load, onResize, css, reduce };
})();
