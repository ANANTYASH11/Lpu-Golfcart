import json
import sys
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OSM_PATH = DATA_DIR / "lpu_osm.json"

with open(OSM_PATH, 'r', encoding='utf-8') as f:
    d = json.load(f)

elements = d.get('elements', [])
node_coords = {el['id']: (el['lat'], el['lon']) for el in elements if el.get('type') == 'node' and 'lat' in el}

# Find boundary ways
for el in elements:
    if el['id'] in [422435593, 1566901467]:
        nodes = el.get('nodes', [])
        coords = [node_coords[nid] for nid in nodes if nid in node_coords]
        if coords:
            lats = [c[0] for c in coords]
            lons = [c[1] for c in coords]
            print(f"Boundary Way {el['id']}: {len(coords)} nodes, Lat: {min(lats):.5f} to {max(lats):.5f}, Lon: {min(lons):.5f} to {max(lons):.5f}")

# Now let's find all high-rise academic blocks, hostels, gates, and roads
campus_buildings = []
for el in elements:
    if el.get('type') != 'way':
        continue
    tags = el.get('tags', {})
    if 'building' not in tags and 'amenity' not in tags and 'leisure' not in tags:
        continue
    nodes = el.get('nodes', [])
    coords = [node_coords[nid] for nid in nodes if nid in node_coords]
    if not coords:
        continue
    c_lat = sum(c[0] for c in coords) / len(coords)
    c_lon = sum(c[1] for c in coords) / len(coords)
    
    # Must be inside the LPU campus grounds: lat 31.246 to 31.261, lon 75.700 to 75.714
    if 31.246 <= c_lat <= 31.261 and 75.700 <= c_lon <= 75.714:
        campus_buildings.append({
            "id": el['id'],
            "name": tags.get('name'),
            "levels": tags.get('building:levels'),
            "building": tags.get('building'),
            "amenity": tags.get('amenity'),
            "leisure": tags.get('leisure'),
            "lat": round(c_lat, 6),
            "lon": round(c_lon, 6),
            "tags": tags
        })

print(f"\nTotal campus structures inside LPU campus: {len(campus_buildings)}")
for b in sorted(campus_buildings, key=lambda x: (x['lat'], x['lon'])):
    print(f"Way {b['id']} @ ({b['lat']}, {b['lon']}) | levels={b['levels']} | name={b['name']} | tags={b['tags']}")
