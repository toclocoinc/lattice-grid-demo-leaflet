// The map's layers and legends, built with the page's own Leaflet (`L`): the
// binding hands over the rows in view, or past its cap the engine's density
// cells, and this turns them into Leaflet layers. Density cells draw as
// rectangles coloured by count (quantiles); plants as circle markers sized by
// MW and coloured by fuel, with a ring on the selected row.
const FUEL = { Coal: [90, 90, 90], Gas: [230, 140, 30], Oil: [140, 70, 30], Hydro: [30, 120, 220],
    Nuclear: [170, 60, 200], Solar: [240, 200, 20], Wind: [40, 190, 170], Biomass: [90, 160, 60] };
const OTHER = [150, 150, 170];
// ColorBrewer PuBu, six classes.
const DEN = [[241, 238, 246], [208, 209, 230], [166, 189, 219], [116, 169, 207], [43, 140, 190], [4, 90, 141]];
const radius = (mw) => 1.5 + Math.sqrt(Math.max(0, mw)) / 6; // pixels, area-true
const fmt = (n) => Math.round(n).toLocaleString();
const rgb = (c) => 'rgb(' + c + ')';

/**
 * Quantile class breaks: the upper bound of each of `k` equal-count classes.
 * @param {number[]} values positive values to classify
 * @param {number} k how many classes
 * @returns {number[]} ascending breaks, `k` long (or fewer when values repeat)
 */
function quantileBreaks(values, k) {
    const v = values.filter((x) => x > 0).sort((a, b) => a - b);
    if (!v.length) return [];
    const out = [];
    for (let i = 1; i <= k; i++) out.push(v[Math.min(v.length - 1, Math.ceil((i * v.length) / k) - 1)]);
    return [...new Set(out)];
}

/**
 * Build the Leaflet layers for one render of the binding.
 * @param {object[]} rows the binding's rows, or its density cells when `ctx.binned`
 * @param {object} ctx the binding's layer context
 * @param {(breaks: number[]) => void} onBreaks receives the density classes for the legend
 * @returns {object[]} the layers to put on the map
 */
function buildLayers(rows, ctx, onBreaks) {
    if (ctx.binned) {
        const breaks = quantileBreaks(rows.map((c) => c.count), DEN.length);
        onBreaks(breaks);
        const cls = (n) => { const i = breaks.findIndex((b) => n <= b); return i < 0 ? breaks.length - 1 : i; };
        return rows.map((c) => L.rectangle([[c.south, c.west], [c.north, c.east]],
            { stroke: false, fillColor: rgb(DEN[cls(c.count)]), fillOpacity: 0.6, interactive: false }));
    }
    onBreaks([]);
    const selected = new Set(ctx.selected);
    const plants = L.geoJSON(ctx.features, {
        pointToLayer: (f, at) => L.circleMarker(at, { radius: radius(f.properties.capacity_mw), weight: 0.5, color: '#fff',
            fillColor: rgb(FUEL[f.properties.primary_fuel] || OTHER), fillOpacity: 0.85 }),
        onEachFeature: (f, layer) => layer.bindTooltip(f.properties.name + ' · ' + f.properties.primary_fuel
            + ' · ' + fmt(f.properties.capacity_mw) + ' MW'),
    });
    // Table → map: the selected row drawn as a ring on top.
    const ring = L.geoJSON(ctx.features.filter((f) => selected.has(f.id)), {
        pointToLayer: (f, at) => L.circleMarker(at, { radius: radius(f.properties.capacity_mw) + 6, weight: 3,
            color: '#ff005a', fill: false, interactive: false }),
    });
    return [plants, ring];
}

/**
 * The static legends: fuel colours and dot sizes.
 * @param {(sel: string) => Element} $ the page's query helper
 */
function drawLegends($) {
    $('#fuel-legend').innerHTML = Object.entries(FUEL).concat([['Other', OTHER]]).map(([f, c]) =>
        '<span><i class="sw" style="background:' + rgb(c) + '"></i>' + f + '</span>').join('');
    $('#size-legend').innerHTML = [10, 1000, 5000].map((mw) => '<i class="sw" style="width:' + 2 * radius(mw)
        + 'px;height:' + 2 * radius(mw) + 'px;background:#888"></i>' + fmt(mw) + ' ').join('');
}

/**
 * The density legend: one swatch per quantile class, labelled with its count range.
 * @param {Element} el where it goes
 * @param {number[]} breaks the class upper bounds; empty when plants draw instead
 */
function drawDensityLegend(el, breaks) {
    el.innerHTML = breaks.length ? breaks.map((b, i) => '<span><i class="sw sq" style="background:' + rgb(DEN[i])
        + ';opacity:.6"></i>' + (i ? fmt(breaks[i - 1]) + '–' : '≤ ') + fmt(b) + '</span>').join('') : 'fewer plants in view than the cap: plants draw';
}
