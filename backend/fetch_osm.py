import urllib.request
import json
import os
import sys
from pathlib import Path

# Configure utf-8 stdout on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
OSM_OUTPUT_PATH = DATA_DIR / "lpu_osm.json"
UNVERIFIED_PATH = DATA_DIR / "UNVERIFIED.md"

def fetch_and_save_lpu_osm():
    print("[1/4] Querying OpenStreetMap Overpass API for Lovely Professional University (LPU)...")
    query = """
    [out:json][timeout:60];
    (
      node(31.245,75.695,31.265,75.720);
      way(31.245,75.695,31.265,75.720);
      relation(31.245,75.695,31.265,75.720);
    );
    out body;
    >;
    out skel qt;
    """

    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter"
    ]

    data = None
    for endpoint in endpoints:
        print(f"  Attempting query via: {endpoint}")
        try:
            req = urllib.request.Request(
                endpoint,
                data=query.encode('utf-8'),
                headers={'User-Agent': 'CampusRide-LPU-Overpass/1.0'}
            )
            with urllib.request.urlopen(req, timeout=45) as response:
                content = response.read().decode('utf-8')
                data = json.loads(content)
                print(f"  Successfully retrieved {len(data.get('elements', []))} elements!")
                break
        except Exception as e:
            print(f"  Failed with {endpoint}: {e}")

    if not data or 'elements' not in data:
        raise RuntimeError("Could not fetch OSM data from any Overpass endpoint.")

    print(f"[2/4] Saving raw OSM result to {OSM_OUTPUT_PATH}...")
    with open(OSM_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    print(f"  Raw OSM dataset saved. File size: {os.path.getsize(OSM_OUTPUT_PATH) / 1024 / 1024:.2f} MB")

    return data

def parse_campus_landmarks(osm_data):
    print("[3/4] Parsing and extracting real named places from OSM elements...")
    elements = osm_data.get('elements', [])
    
    # Map nodes by id for coordinate lookups in ways
    node_coords = {}
    for el in elements:
        if el.get('type') == 'node' and 'lat' in el and 'lon' in el:
            node_coords[el['id']] = (el['lat'], el['lon'])

    named_places = []
    
    for el in elements:
        tags = el.get('tags', {})
        if not tags:
            continue
            
        name = tags.get('name') or tags.get('name:en') or tags.get('ref')
        if not name:
            continue
            
        # Calculate coordinate
        lat, lon = None, None
        if el['type'] == 'node':
            lat = el.get('lat')
            lon = el.get('lon')
        elif el['type'] == 'way':
            nodes = el.get('nodes', [])
            coords = [node_coords[nid] for nid in nodes if nid in node_coords]
            if coords:
                lat = sum(c[0] for c in coords) / len(coords)
                lon = sum(c[1] for c in coords) / len(coords)
        elif el['type'] == 'relation':
            # For relations, try bounds or center if provided
            bounds = el.get('bounds')
            if bounds:
                lat = (bounds['minlat'] + bounds['maxlat']) / 2
                lon = (bounds['minlon'] + bounds['maxlon']) / 2

        if lat is not None and lon is not None:
            named_places.append({
                "osm_id": el['id'],
                "type": el['type'],
                "name": name,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "tags": tags
            })

    print(f"  Found {len(named_places)} named elements in LPU campus bounds.")
    return named_places

if __name__ == "__main__":
    data = fetch_and_save_lpu_osm()
    places = parse_campus_landmarks(data)
