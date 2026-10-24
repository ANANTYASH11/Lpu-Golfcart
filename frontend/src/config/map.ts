import * as maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';

// Initialize MapLibre worker and PMTiles protocol
if (typeof window !== 'undefined') {
  try {
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
  } catch (e) {
    console.warn('Could not set MapLibre workerUrl:', e);
  }

  try {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  } catch {
    // Protocol already added or running in test environment
  }
}

export type MapProvider = 'openfreemap' | 'osm' | 'pmtiles';

export interface CampusBoundsConfig {
  center: [number, number];
  bounds: [[number, number], [number, number]];
  minZoom: number;
  maxZoom: number;
  defaultZoom: number;
  defaultPitch: number;
  defaultBearing: number;
}

export const CAMPUS_CONFIG: CampusBoundsConfig = {
  // Central LPU Campus coordinates (between Main Gate and Academic blocks)
  center: [75.7052, 31.2536],
  // Bounding box strictly restricting pan/zoom to Lovely Professional University grounds
  bounds: [
    [75.688, 31.238], // Southwest
    [75.726, 31.268], // Northeast
  ],
  minZoom: 13.5,
  maxZoom: 19.5,
  defaultZoom: 16.5,
  defaultPitch: 40,
  defaultBearing: -10,
};

export const MAP_CONFIG = {
  // Primary keyless vector tile provider (no key, no signup, high reliability)
  defaultProvider: 'openfreemap' as MapProvider,
  providers: {
    openfreemap: {
      light: 'https://tiles.openfreemap.org/styles/positron',
      dark: 'https://tiles.openfreemap.org/styles/dark',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
    },
    osm: {
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
    pmtiles: {
      url: 'pmtiles:///tiles/lpu.pmtiles',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (Offline LPU Extract)',
    },
  },
  buildingsGeoJsonUrl: '/data/lpu_buildings.geojson',
};

/**
 * Returns raster OSM StyleSpecification with Uber tokens applied.
 * Used as automatic fallback if OpenFreeMap network or vector loading encounters issues.
 */
export function getOsmRasterStyle(mode: 'light' | 'dark'): maplibregl.StyleSpecification {
  const isDark = mode === 'dark';
  return {
    version: 8,
    name: isDark ? 'LPU Dark OSM' : 'LPU Light OSM',
    sources: {
      'osm-raster': {
        type: 'raster',
        tiles: MAP_CONFIG.providers.osm.tiles,
        tileSize: 256,
        maxzoom: MAP_CONFIG.providers.osm.maxzoom,
        attribution: MAP_CONFIG.providers.osm.attribution,
      },
    },
    layers: [
      {
        id: 'osm-background',
        type: 'background',
        paint: {
          'background-color': isDark ? '#000000' : '#F3F3F3',
        },
      },
      {
        id: 'osm-tiles-layer',
        type: 'raster',
        source: 'osm-raster',
        minzoom: 0,
        maxzoom: 22,
        paint: {
          'raster-opacity': isDark ? 0.65 : 0.95,
          'raster-saturation': isDark ? -0.9 : -0.25,
          'raster-contrast': isDark ? 0.1 : 0.05,
          'raster-brightness-min': isDark ? 0.05 : 0.95,
          'raster-brightness-max': isDark ? 0.35 : 1.0,
        },
      },
    ],
  };
}

/**
 * Returns offline PMTiles StyleSpecification for LPU Campus.
 */
export function getPmtilesStyle(mode: 'light' | 'dark'): maplibregl.StyleSpecification {
  const isDark = mode === 'dark';
  return {
    version: 8,
    name: isDark ? 'LPU PMTiles Dark' : 'LPU PMTiles Light',
    sources: {
      'lpu-offline': {
        type: 'vector',
        url: MAP_CONFIG.providers.pmtiles.url,
        attribution: MAP_CONFIG.providers.pmtiles.attribution,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': isDark ? '#000000' : '#FFFFFF',
        },
      },
      {
        id: 'pmtiles-land',
        type: 'fill',
        source: 'lpu-offline',
        'source-layer': 'landuse',
        paint: {
          'fill-color': isDark ? '#111111' : '#F7F7F7',
        },
      },
      {
        id: 'pmtiles-roads',
        type: 'line',
        source: 'lpu-offline',
        'source-layer': 'transportation',
        paint: {
          'line-color': isDark ? '#222222' : '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 5],
        },
      },
    ],
  };
}

/**
 * Resolves map style either as a URL (for vector OpenFreeMap) or StyleSpecification.
 */
export function getMapStyle(
  provider: MapProvider = MAP_CONFIG.defaultProvider,
  mode: 'light' | 'dark' = 'light'
): string | maplibregl.StyleSpecification {
  if (provider === 'osm') {
    return getOsmRasterStyle(mode);
  }
  if (provider === 'pmtiles') {
    return getPmtilesStyle(mode);
  }
  return mode === 'dark'
    ? MAP_CONFIG.providers.openfreemap.dark
    : MAP_CONFIG.providers.openfreemap.light;
}

export function getBuildingColorExpression(
  mode: 'light' | 'dark' = 'light',
  highlightName?: string
): any {
  const isDark = mode === 'dark';
  return [
    'case',
    ['==', ['get', 'name'], highlightName || '__NONE__'],
    '#276EF1', // Highlight destination building with Uber accent blue
    [
      'match',
      ['get', 'category'],
      'hostel',
      isDark ? '#242220' : '#ECEAE4', // Muted stone grey tint
      'food',
      isDark ? '#262420' : '#EFECE6', // Muted warm amber tint
      'medical',
      isDark ? '#1A2520' : '#E4EDE7', // Muted soft mint tint
      'library',
      isDark ? '#1E242E' : '#E7EBF2', // Muted cool slate tint
      'sports',
      isDark ? '#1C2224' : '#E8ECED', // Muted neutral tint
      /* default academic blocks */
      isDark ? '#1C1F26' : '#ECEEF2',
    ],
  ];
}

/**
 * Updates the 3D building layer to highlight a specific destination building.
 */
export function setHighlightedDestinationBuilding(
  map: maplibregl.Map,
  destinationName?: string,
  mode: 'light' | 'dark' = 'light'
): void {
  if (!map || !map.getLayer('lpu-3d-buildings')) return;
  try {
    map.setPaintProperty(
      'lpu-3d-buildings',
      'fill-extrusion-color',
      getBuildingColorExpression(mode, destinationName)
    );
  } catch (err) {
    console.warn('Could not update destination building highlight:', err);
  }
}

/**
 * Adds 3D extruded building models from the verified LPU OSM building dataset.
 * Supports height interpolation (default 3m per level per specification).
 */
export async function setupCampus3DBuildings(
  map: maplibregl.Map,
  mode: 'light' | 'dark' = 'light',
  highlightDestinationName?: string
): Promise<void> {
  const isDark = mode === 'dark';

  // 1. If vector style has internal openmaptiles building layer, hide flat fill
  try {
    if (map.getLayer('building')) {
      map.setLayoutProperty('building', 'visibility', 'none');
    }
  } catch {
    // Layer might not exist in raster fallback
  }

  // 2. Add high-detail verified LPU GeoJSON buildings source
  const sourceId = 'lpu-campus-buildings';
  const layerId = 'lpu-3d-buildings';

  if (!map.getSource(sourceId)) {
    try {
      map.addSource(sourceId, {
        type: 'geojson',
        data: MAP_CONFIG.buildingsGeoJsonUrl,
      });
    } catch (e) {
      console.warn('Could not add lpu buildings source:', e);
      return;
    }
  }

  if (!map.getLayer(layerId)) {
    const buildingEdge = isDark ? '#2E3540' : '#D0D4DC';

    map.addLayer({
      id: layerId,
      type: 'fill-extrusion',
      source: sourceId,
      minzoom: 14,
      paint: {
        // Dynamic extrusion height: uses 'height' property (levels * 3m, default min 12m)
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          ['max', ['get', 'height'], 6],
          17,
          ['max', ['get', 'height'], 12],
        ],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-color': getBuildingColorExpression(mode, highlightDestinationName),
        'fill-extrusion-opacity': isDark ? 0.90 : 0.88,
      },
    });

    // Clean subtle building roof outlines at high zoom
    if (!map.getLayer('lpu-3d-buildings-edge')) {
      map.addLayer({
        id: 'lpu-3d-buildings-edge',
        type: 'line',
        source: sourceId,
        minzoom: 15.5,
        paint: {
          'line-color': buildingEdge,
          'line-width': 1,
          'line-opacity': 0.7,
        },
      });
    }
  } else {
    // If layer already exists, update color for current mode / highlight
    setHighlightedDestinationBuilding(map, highlightDestinationName, mode);
  }
}

/**
 * Filters out clutter POIs from third-party maps to keep focus solely on real campus landmarks.
 */
export function filterCampusPOIs(map: maplibregl.Map): void {
  const clutterKeywords = [
    'poi',
    'shop',
    'commercial',
    'amenity',
    'place_other',
    'hotel',
    'motel',
  ];

  const style = map.getStyle();
  if (!style || !style.layers) return;

  style.layers.forEach((layer) => {
    const id = layer.id.toLowerCase();
    // Hide commercial shops, restaurants outside campus, clutter labels
    if (
      clutterKeywords.some((k) => id.includes(k)) &&
      !id.includes('road') &&
      !id.includes('building') &&
      !id.includes('water')
    ) {
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      } catch {
        // Layer layout property not available
      }
    }
  });
}
