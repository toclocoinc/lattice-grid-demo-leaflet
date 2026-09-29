# A Leaflet map with an attribute table: Leaflet and Lattice Grid

Every power plant in the World Resources Institute's Global Power Plant
Database, 34,936 of them, queried in the browser by DuckDB-WASM and drawn by
Leaflet over an OpenFreeMap basemap, with Lattice Grid as the attribute table.
The map's view is the table's filter: pan or zoom, or move the map in code,
and the table and the KPI tiles narrow to what is on screen.

Live: https://toclocoinc.github.io/lattice-grid-demo-leaflet/

## What it shows

- **Map** — Leaflet 1.9, bound to the grid with `bindLeaflet` from
  `modules/leaflet` (new in Lattice Grid 1.76.0). The binding never imports
  Leaflet: the page hands it its own `L.Map` and a `layers(rows, ctx)`
  function written with the page's own `L`. What that function draws follows
  what the binding hands over:
  - **Density** (the world, or a continent, holds more plants than the
    binding's `viewportCap`, set to 5,000 here): the engine hands over density
    cells instead of rows (`ctx.binned`), drawn as `L.rectangle`s coloured by
    plants per cell in six quantile classes. The legend follows the view.
  - **Plants** (a city or a region, fewer plants in view than the cap): an
    `L.geoJSON(ctx.features)` of circle markers, sized by MW (area-true) and
    coloured by fuel, with a tooltip. Click a plant to select its row in the
    table; a ring marks the selected row on the map.
  - Country outlines under the cells, for orientation.
- **Attribute table** — the whole dataset, paged from DuckDB, with the filter
  row on. Sorting and filtering run as SQL. With `viewportFilter: true` every
  `moveend` writes the map's bounds onto the grid as one `withinBbox`
  condition, so the table shows the plants in view.
- **Layers** — the legends, the binding's readout (rows drawn, rows matched,
  engine or browser, cells), and **Go to** buttons: each is a plain
  `map.setView(...)` in code, and the binding hears its `moveend` exactly as it
  hears a drag, so the table and tiles narrow to London, Tokyo or New York.
- **In view** — plants, total MW and the largest plant in view, computed by
  the engine over the matching set through `source.aggregate()`.
- **Credits** — data and map credits, and the grid version.

Add `?theme=dark` to the address to see the page under `data-theme="dark"`.

## Data

- `data/power-plants.parquet` (1.89 MB) — the
  [Global Power Plant Database v1.3](https://github.com/wri/global-power-plant-database)
  by World Resources Institute. Licence:
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- `data/countries.parquet` (157 KB) — country outlines from
  [Natural Earth](https://www.naturalearthdata.com/) (1:110m), public domain.

**Basemap tiles come from a third-party service**: the keyless
[OpenFreeMap](https://openfreemap.org) Positron vector style,
`https://tiles.openfreemap.org/styles/positron`, drawn inside Leaflet by the
[maplibre-gl-leaflet](https://github.com/maplibre/maplibre-gl-leaflet) plugin
(0.1.4) over MapLibre GL JS 4.7.1. Map data © OpenStreetMap contributors,
tiles © OpenMapTiles. The page also loads Leaflet 1.9.4 and DuckDB-WASM 1.32.0
from jsDelivr.

## Run it locally

The page loads Lattice Grid 1.78.0 from the jsDelivr CDN. To try a local build
instead, copy the grid's package (`dist/`) to `vendor/` (not part of this
repository) and open the page with `?local`. Serve the folder with any static
server, for example:

```
python3 -m http.server 8611
```

and open http://localhost:8611/. No licence key is needed on localhost.

## Grid features used

`duckdbAdapter` (with `spatial: true`) + `createPushdownSource` (sort, filter
and paging pushed down as SQL; `source.aggregate()` for the KPI tiles),
`createGrid` with a `geometry` column, `filterRow`, single row `selection`,
`bindLeaflet` with `viewportFilter` (a `withinBbox` condition on the grid),
its engine density cells past `viewportCap`, its `ctx.features` and
`ctx.selected`, and the layout and KPI modules. Modules loaded: `layout`,
`kpi`, `geometry`, `leaflet`.

Why the pushdown source rather than the 35k rows in memory: over a paged
pushdown grid the binding asks the engine for just the rows inside the view,
and for density cells when the view holds too many. A memory grid would hand
Leaflet every row at every zoom and has no density path.

## Licence

The code in this repository is available under the MIT licence. See
[LICENSE](LICENSE). The data licences are named above. Lattice Grid itself is
a separate commercial product, free to use on localhost; keys for your own
sites come from [latticegrid.dev](https://www.latticegrid.dev).
