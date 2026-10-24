/**
 * Campus Road-Snapped Routing Service for LPU UniCart
 * Provides OSRM query with local OSM campus road graph fallback.
 */

export interface RouteResult {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
  isApproximate: boolean;
  pointsCount: number;
  ratio: number;
}

interface RoadGraph {
  coords: Record<string, [number, number]>;
  adj: Record<string, [string, number][]>;
}

let cachedGraph: RoadGraph | null = null;
let graphLoadPromise: Promise<RoadGraph | null> | null = null;

export function haversineDistance(c1: [number, number], c2: [number, number]): number {
  const R = 6371000; // meters
  const rad = Math.PI / 180;
  const phi1 = c1[1] * rad;
  const phi2 = c2[1] * rad;
  const dphi = (c2[1] - c1[1]) * rad;
  const dlam = (c2[0] - c1[0]) * rad;

  const a =
    Math.sin(dphi / 2) * Math.sin(dphi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) * Math.sin(dlam / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

/**
 * Loads and caches local campus road graph for instant offline / fallback routing.
 */
export async function loadCampusRoadGraph(): Promise<RoadGraph | null> {
  if (cachedGraph) return cachedGraph;
  if (graphLoadPromise) return graphLoadPromise;

  graphLoadPromise = (async () => {
    try {
      const res = await fetch('/data/lpu_road_graph.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RoadGraph = await res.json();
      cachedGraph = data;
      return data;
    } catch (err) {
      console.warn('Could not load local campus road graph:', err);
      return null;
    }
  })();

  return graphLoadPromise;
}

/**
 * Snaps a given geographic coordinate to the nearest vertex in the campus road network.
 */
export async function snapToNearestRoad(
  coord: [number, number],
  maxSnapDist = 120
): Promise<[number, number]> {
  const graph = await loadCampusRoadGraph();
  if (!graph || !graph.coords) return coord;

  let bestNode: [number, number] | null = null;
  let minDist = Infinity;

  for (const nid in graph.coords) {
    const c = graph.coords[nid];
    const d = haversineDistance(coord, c);
    if (d < minDist) {
      minDist = d;
      bestNode = c;
    }
  }

  if (bestNode && minDist <= maxSnapDist) {
    return bestNode;
  }
  return coord;
}

/**
 * Computes road-snapped shortest path using local campus graph Dijkstra algorithm.
 */
async function computeCampusGraphRoute(
  start: [number, number],
  end: [number, number]
): Promise<RouteResult | null> {
  const graph = await loadCampusRoadGraph();
  if (!graph || !graph.coords || !graph.adj) return null;

  // Find nearest vertices
  let startId: string | null = null;
  let endId: string | null = null;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (const nid in graph.coords) {
    const c = graph.coords[nid];
    const dStart = haversineDistance(start, c);
    if (dStart < minStartDist) {
      minStartDist = dStart;
      startId = nid;
    }
    const dEnd = haversineDistance(end, c);
    if (dEnd < minEndDist) {
      minEndDist = dEnd;
      endId = nid;
    }
  }

  if (!startId || !endId) return null;

  // Simple Priority Queue / Dijkstra
  const distances: Record<string, number> = { [startId]: 0 };
  const prev: Record<string, string> = {};
  const unvisited = new Set<string>(Object.keys(graph.adj));

  // Limit iterations to campus bounds for performance
  let current: string | null = startId;

  while (current) {
    if (current === endId) break;
    unvisited.delete(current);
    const currDist = distances[current] ?? Infinity;

    const neighbors = graph.adj[current] || [];
    for (const [neighbor, weight] of neighbors) {
      if (!unvisited.has(neighbor)) continue;
      const alt = currDist + weight;
      if (alt < (distances[neighbor] ?? Infinity)) {
        distances[neighbor] = alt;
        prev[neighbor] = current;
      }
    }

    // Pick lowest unvisited
    let lowestId: string | null = null;
    let lowestDist = Infinity;
    for (const node of unvisited) {
      const d = distances[node];
      if (d !== undefined && d < lowestDist) {
        lowestDist = d;
        lowestId = node;
      }
    }
    current = lowestDist === Infinity ? null : lowestId;
  }

  if (!prev[endId] && startId !== endId) {
    return null; // No path found
  }

  // Reconstruct path
  const path: [number, number][] = [];
  let curr: string | undefined = endId;
  while (curr) {
    path.push(graph.coords[curr]);
    curr = prev[curr];
  }
  path.reverse();

  // Prepend snapped start and append snapped end
  if (path.length > 0) {
    if (haversineDistance(start, path[0]) > 5) path.unshift(start);
    if (haversineDistance(end, path[path.length - 1]) > 5) path.push(end);
  }

  let totalDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDist += haversineDistance(path[i], path[i + 1]);
  }

  // Golf cart speed on campus ~18 km/h = 5 m/s
  const durationSec = Math.round(totalDist / 4.8);
  const straight = haversineDistance(start, end);
  const ratio = straight > 0 ? totalDist / straight : 1;

  return {
    coordinates: path,
    distanceMeters: Math.round(totalDist),
    durationSeconds: durationSec,
    formattedDistance: formatDistance(totalDist),
    formattedDuration: formatDuration(durationSec),
    isApproximate: false,
    pointsCount: path.length,
    ratio: Number(ratio.toFixed(2)),
  };
}

/**
 * Main routing function:
 * 1. Queries OSRM road snapping (profile: foot or driving).
 * 2. Validates that route geometry has > 2 points and ratio <= 2.5 (no highway loops).
 * 3. Falls back to internal campus road network graph Dijkstra.
 * 4. Falls back to straight line with isApproximate=true if both fail.
 */
export async function calculateRoute(
  start: [number, number],
  end: [number, number]
): Promise<RouteResult> {
  const straightDist = haversineDistance(start, end);

  // 1. Try OSRM foot / driving profile
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords: [number, number][] = route.geometry.coordinates;
        const dist = route.distance;
        const ratio = straightDist > 0 ? dist / straightDist : 1;

        // Ensure points > 2 and does not exceed 2.6x straight-line distance
        if (coords.length > 2 && ratio <= 2.6) {
          // Internal campus cart duration: ~18 km/h = 5 m/s
          const durationSec = Math.round(dist / 4.8);
          return {
            coordinates: coords,
            distanceMeters: Math.round(dist),
            durationSeconds: durationSec,
            formattedDistance: formatDistance(dist),
            formattedDuration: formatDuration(durationSec),
            isApproximate: false,
            pointsCount: coords.length,
            ratio: Number(ratio.toFixed(2)),
          };
        }
      }
    }
  } catch (err) {
    // OSRM failed or timed out, will fall back to local graph
  }

  // 2. Try Local Campus Road Network Graph
  try {
    const localResult = await computeCampusGraphRoute(start, end);
    if (localResult && localResult.coordinates.length > 2 && localResult.ratio <= 3.0) {
      return localResult;
    }
  } catch (err) {
    console.warn('Campus graph routing failed:', err);
  }

  // 3. Fallback: Straight-line approximate route
  const approxDuration = Math.round(straightDist / 4.5);
  return {
    coordinates: [start, end],
    distanceMeters: Math.round(straightDist),
    durationSeconds: approxDuration,
    formattedDistance: formatDistance(straightDist),
    formattedDuration: formatDuration(approxDuration),
    isApproximate: true,
    pointsCount: 2,
    ratio: 1.0,
  };
}
