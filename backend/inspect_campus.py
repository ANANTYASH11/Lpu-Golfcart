import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OSM_PATH = DATA_DIR / "lpu_osm.json"

with open(OSM_PATH, 'r', encoding='utf-8') as f:
    d = json.load(f)

elements = d.get('elements', [])
node_coords = {el['id']: (el['lat'], el['lon']) for el in elements if el.get('type') == 'node' and 'lat' in el}

campus_elements = []
for el in elements:
    tags = el.get('tags', {})
    if not tags:
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
    elif el['type'] == 'relation':
        bounds = el.get('bounds')
        if bounds:
            lat = (bounds['minlat'] + bounds['maxlat']) / 2
            lon = (bounds['minlon'] + bounds['maxlon']) / 2
            
    if lat and lon and 31.246 <= lat <= 31.265 and 75.698 <= lon <= 75.715:
        name = tags.get('name') or tags.get('name:en') or tags.get('ref')
        campus_elements.append({
            'id': el['id'],
            'type': el['type'],
            'name': name,
            'tags': tags,
            'lat': round(lat, 6),
            'lon': round(lon, 6)
        })

print(f"Total elements within campus box: {len(campus_elements)}")
named = [ce for ce in campus_elements if ce['name']]
print(f"Named elements within campus box: {len(named)}")

for ce in sorted(named, key=lambda x: str(x['name'])):
    print(f"- {ce['name']} [OSM {ce['type']} {ce['id']}] -> Lat: {ce['lat']}, Lon: {ce['lon']} (Tags: {ce['tags']})")
