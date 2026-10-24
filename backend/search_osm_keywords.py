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

keywords = ['gate', 'mall', 'library', 'hospital', 'health', 'unipolis', 'auditorium', 'hostel', 'block', 'mess', 'stadium', 'sports', 'lovely', 'university', 'institute', 'design']

matches = []
for el in elements:
    tags = el.get('tags', {})
    found = False
    for k, v in tags.items():
        if any(w in str(v).lower() for w in keywords):
            found = True
            break
    if found:
        lat, lon = None, None
        if el['type'] == 'node':
            lat, lon = el.get('lat'), el.get('lon')
        elif el['type'] == 'way':
            nodes = el.get('nodes', [])
            coords = [node_coords[nid] for nid in nodes if nid in node_coords]
            if coords:
                lat = sum(c[0] for c in coords) / len(coords)
                lon = sum(c[1] for c in coords) / len(coords)
        matches.append((el['id'], el['type'], lat, lon, tags))

print(f"Total keyword matches: {len(matches)}")
for eid, etype, lat, lon, tags in matches:
    name = tags.get('name') or tags.get('ref') or tags.get('amenity') or tags.get('building')
    print(f"[{etype.upper()} {eid}] {name} @ ({lat}, {lon}) -> {tags}")
