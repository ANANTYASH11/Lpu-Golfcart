import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OSM_PATH = DATA_DIR / "lpu_osm.json"

with open(OSM_PATH, 'r', encoding='utf-8') as f:
    osm_data = json.load(f)

elements = osm_data.get('elements', [])
node_coords = {el['id']: (el['lat'], el['lon']) for el in elements if el.get('type') == 'node' and 'lat' in el}

named_items = []
for el in elements:
    tags = el.get('tags', {})
    name = tags.get('name') or tags.get('name:en')
    if not name:
        continue
    
    lat, lon = None, None
    if el['type'] == 'node':
        lat, lon = el.get('lat'), el.get('lon')
    elif el['type'] == 'way':
        nodes = el.get('nodes', [])
        coords = [node_coords[nid] for nid in nodes if nid in node_coords]
        if coords:
            lat = sum(c[0] for c in coords) / len(coords)
            lon = sum(c[1] for c in coords) / len(coords)
            
    if lat and lon:
        named_items.append({
            "id": el['id'],
            "type": el['type'],
            "name": name,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "amenity": tags.get('amenity'),
            "building": tags.get('building'),
            "shop": tags.get('shop'),
            "highway": tags.get('highway'),
            "barrier": tags.get('barrier')
        })

print(f"Total named items: {len(named_items)}")
for item in sorted(named_items, key=lambda x: x['name']):
    print(f"{item['name']} | Lat: {item['lat']}, Lon: {item['lon']} | Type: {item['type']} | Tag: {item['amenity'] or item['building'] or item['highway'] or item['barrier']}")
