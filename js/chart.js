// Chart wrapper around TradingView Lightweight Charts (Apache-2.0, vendored). Candles + volume + plan levels.
const LC = () => window.LightweightCharts;
const timeFmt = t => { const d = new Date(t * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const dayFmt = t => new Date(t * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function makeChart(el, { height, small = false } = {}) {
  const lc = LC(); if (!lc) { el.innerHTML = '<p class="mute small">Chart library failed to load.</p>'; return null; }
  const chart = lc.createChart(el, {
    autoSize: true, height,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#737780', fontFamily: 'Inter, system-ui, sans-serif', fontSize: small ? 10 : 11 },
    grid: { vertLines: { color: '#F0F1F4' }, horzLines: { color: '#F0F1F4' } },
    rightPriceScale: { borderColor: '#E9EAED', scaleMargins: { top: 0.08, bottom: small ? 0.08 : 0.24 } },
    timeScale: { borderColor: '#E9EAED', timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: small ? 5 : 8, tickMarkFormatter: (t, type) => type < 3 ? dayFmt(t) : timeFmt(t) },
    crosshair: { mode: 1 }, localization: { priceFormatter: p => p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), timeFormatter: t => timeFmt(t) },
    handleScroll: !small, handleScale: !small,
  });
  const candles = chart.addCandlestickSeries({ upColor: '#1F7A55', downColor: '#B8433B', borderVisible: false, wickUpColor: '#1F7A55', wickDownColor: '#B8433B' });
  const volume = small ? null : chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
  if (volume) chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  const smaLine = small ? null : chart.addLineSeries({ color: 'rgba(46,75,168,.8)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  const lines = [];
  return {
    chart,
    set(bars) { candles.setData(bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))); if (volume) volume.setData(bars.map(b => ({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(31,122,85,.28)' : 'rgba(184,67,59,.28)' }))); },
    update(b) { if (!b) return; candles.update({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }); if (volume) volume.update({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(31,122,85,.28)' : 'rgba(184,67,59,.28)' }); },
    // Plan lines stay visible: the price scale is widened to include entry, stop-loss and target (as in Figma 01).
    levels(plan) { lines.splice(0).forEach(l => candles.removePriceLine(l));
      candles.applyOptions({ autoscaleInfoProvider: plan ? orig => { const r = orig(); if (!r || !r.priceRange) return r; return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, plan.stop, plan.entry) - 2, maxValue: Math.max(r.priceRange.maxValue, plan.target, plan.entry) + 2 } }; } : undefined });
      if (!plan) return;
      [[plan.target, 'Target', '#1F7A55'], [plan.entry, 'Entry', '#737780'], [plan.stop, 'Stop-loss', '#B8433B']].forEach(([p, t, c]) => lines.push(candles.createPriceLine({ price: p, color: c, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `${t} ${Math.round(p).toLocaleString('en-IN')}` }))); },
    sma(points) { if (smaLine) smaLine.setData(points || []); },
    smaVisible(b) { if (smaLine) smaLine.applyOptions({ visible: b }); },
    fit() { chart.timeScale().fitContent(); },
    showRecent(n) { const ts = chart.timeScale(); const r = ts.getVisibleLogicalRange(); ts.setVisibleLogicalRange({ from: Math.max(0, (r ? r.to : n) - n), to: (r ? r.to : n) + 2 }); },
    destroy() { try { chart.remove(); } catch (e) { } },
  };
}
