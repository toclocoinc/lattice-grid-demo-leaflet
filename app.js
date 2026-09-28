// Leaflet as the map, Lattice Grid as the attribute table: one DuckDB relation,
// five windows, the map's view as the grid's filter. The layers and their
// legends live in layers.js; the data side in data.js.
const $ = (sel) => document.querySelector(sel);
const panel = (id, heading, html) => {
    const el = $('#' + id + '-body');
    el.className = 'panel';
    el.innerHTML = '<div class="panel__head">' + heading + '</div><div class="panel__body">' + (html || '') + '</div>';
    return el.lastChild;
};

LatticeGridLayout.createLayout($('#container'), {
    columns: 24, rows: 20, gap: 6, padding: 6, overflowX: 'static', overflowY: 'static',
    windows: [
        { id: 'map', title: 'Map', xPos: 1, yPos: 1, xSize: 15, ySize: 13, chrome: false },
        { id: 'table', title: 'Attribute table', xPos: 1, yPos: 14, xSize: 15, ySize: 6, chrome: false },
        { id: 'layers', title: 'Layers', xPos: 16, yPos: 1, xSize: 9, ySize: 9, chrome: false },
        { id: 'kpis', title: 'In view', xPos: 16, yPos: 10, xSize: 9, ySize: 10, chrome: false },
        { id: 'footer', title: 'Credits', xPos: 1, yPos: 20, xSize: 24, ySize: 1, chrome: false },
    ],
});
panel('map', 'Map · drag or scroll to move; the view filters the table', '<div id="map"></div>');
panel('layers', 'Layers', $('#layers-panel').innerHTML);
$('#footer-body').innerHTML = $('#footer-panel').innerHTML;
drawLegends($);

const loader = createLoader({ timeoutMs: 90_000 });
(async () => {
    loader.armTimeout();
    const { plants, countries } = await startDuckDB(loader.step);
    loader.step('drawing the layers', 'Drawing layers…');

    // The attribute table: every plant, paged from DuckDB; sort and the filter row run in SQL.
    const grid = LatticeGrid.createGrid(panel('table', 'Attribute table · all plants, filter row on'), {
        rowKey: 'id', source: plants, filterRow: true, selection: 'single',
        columns: [
            { field: 'id', title: 'ID', layout: { hidden: true } },
            { field: 'name', title: 'Plant', layout: { flex: 4, min: 200 } },
            { field: 'country', title: 'Country', layout: { flex: 1, min: 80 } },
            { field: 'primary_fuel', title: 'Fuel', layout: { flex: 1.5, min: 100 } },
            { field: 'capacity_mw', title: 'MW', type: 'number', format: { decimals: 1 }, layout: { flex: 1, min: 90 } },
            { field: 'commissioning_year', title: 'Year', type: 'number', layout: { flex: 1, min: 70 } },
            { field: 'geometry', title: 'Location', type: 'geometry', layout: { hidden: true } },
        ],
    });
    $('#version').textContent = grid.getVersion();
    loader.waitForRows(() => grid.rows.count() > 0 && grid.rows.get(0).data && grid.rows.get(0).data.name !== undefined);

    // Engine answers over the matching set (the viewport box included) feed the KPI tiles.
    let kpi = { n: null, mw: null, max: null };
    const refresh = async () => {
        const answer = await plants.aggregate({ filters: grid.filters.get(), sort: [], range: null, groupBy: [] },
            [{ id: 'n', col: 'id', fn: 'count' }, { id: 'mw', col: 'capacity_mw', fn: 'sum' }, { id: 'max', col: 'capacity_mw', fn: 'max' }]);
        kpi = answer.values;
        tiles.refresh();
    };
    const tiles = LatticeGridKPI.createKPI(panel('kpis', 'In view · computed by the engine'), {
        grid, rowKey: 'id', columns: 1,
        tiles: [
            { id: 'plants', label: 'Plants in view', aggregation: 'custom', compute: () => kpi.n, format: { decimals: 0 } },
            { id: 'mw', label: 'Total MW in view', aggregation: 'custom', compute: () => kpi.mw, format: { decimals: 0 } },
            { id: 'max', label: 'Largest plant in view (MW)', aggregation: 'custom', compute: () => kpi.max, format: { decimals: 0 } },
        ],
    });

    // The map: Leaflet, drawing on canvas, over a neutral keyless vector basemap
    // (OpenFreeMap Positron through the maplibre-gl-leaflet plugin).
    const map = L.map('map', { preferCanvas: true, minZoom: 2, worldCopyJump: false }).setView([25, 10], 2);
    L.maplibreGL({ style: 'https://tiles.openfreemap.org/styles/positron', interactive: false,
        attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> '
            + 'Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map);
    L.geoJSON(countries, { style: { color: '#9aa4ad', weight: 0.6, fill: false }, interactive: false }).addTo(map);

    // viewportCap 5,000 (default 20,000): the world, or a continent at zoom 4-5, holds more, so it draws as density.
    const binding = LatticeGridLeaflet.bindLeaflet(grid, {
        map, viewportFilter: true, position: { geometry: 'geometry' }, viewportCap: 5000,
        layers: (rows, ctx) => {
            const p = ctx.provenance;
            $('#readout').textContent = 'rows drawn ' + p.rows.toLocaleString() + ' of ' + p.matched.toLocaleString()
                + ' matched · ' + (p.computed === 'engine' ? 'engine' : 'browser')
                + (p.binned ? ' · binned into ' + p.cells.toLocaleString() + ' cells' : '') + (ctx.pending ? ' · loading' : '');
            return buildLayers(rows, ctx, (breaks) => drawDensityLegend($('#density-legend'), breaks));
        },
    });

    // Go-to buttons: a programmatic setView ends in moveend, so the table and tiles narrow too.
    for (const btn of document.querySelectorAll('[data-view]')) {
        btn.addEventListener('click', () => { const [lat, lon, z] = btn.dataset.view.split(',').map(Number); map.setView([lat, lon], z); });
    }
    grid.on('filter:changed', refresh);
    refresh();
    window.__demo = { grid, map, binding, plants, kpi: () => kpi };
})().catch(loader.fail);
