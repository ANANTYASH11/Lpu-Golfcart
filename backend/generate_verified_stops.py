import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROPOSED_STOPS_PATH = DATA_DIR / "proposed_stops.json"

PROPOSED_STOPS = [
    {
        "id": 1,
        "name": "Main Gate (NH-44 Entry)",
        "code": "MG-01",
        "latitude": 31.260520,
        "longitude": 75.706874,
        "osm_id": 422550528,
        "osm_type": "way",
        "category": "GATE",
        "verified": True,
        "description": "Primary northern vehicular gate on NH-44 Grand Trunk Road. Major shuttle terminus."
    },
    {
        "id": 2,
        "name": "Uni-Mall Commercial Centre",
        "code": "UM-02",
        "latitude": 31.255268,
        "longitude": 75.703312,
        "osm_id": 422437890,
        "osm_type": "way",
        "category": "COMMERCIAL",
        "verified": True,
        "description": "Central 6-story commercial mall, student food courts, bookstores, and bank branches."
    },
    {
        "id": 3,
        "name": "Block 32 (Computer Science & Engineering)",
        "code": "B32",
        "latitude": 31.257892,
        "longitude": 75.706885,
        "osm_id": 354755644,
        "osm_type": "way",
        "category": "ACADEMIC",
        "verified": True,
        "description": "Lovely Institute of Technology / School of Computer Science & Engineering. Highest student footfall."
    },
    {
        "id": 4,
        "name": "Block 34 (Engineering Labs Complex)",
        "code": "B34",
        "latitude": 31.256809,
        "longitude": 75.705573,
        "osm_id": 425716257,
        "osm_type": "way",
        "category": "ACADEMIC",
        "verified": True,
        "description": "10-story engineering laboratory and mechanical/civil workshops building."
    },
    {
        "id": 5,
        "name": "Block 38 (Mittal School of Business)",
        "code": "B38",
        "latitude": 31.258602,
        "longitude": 75.708860,
        "osm_id": 354743583,
        "osm_type": "way",
        "category": "ACADEMIC",
        "verified": True,
        "description": "Lovely Institute of Management (Mittal School of Business). Northern academic quad."
    },
    {
        "id": 6,
        "name": "School of Design (Block 35)",
        "code": "B35",
        "latitude": 31.256652,
        "longitude": 75.707028,
        "osm_id": 425717552,
        "osm_type": "way",
        "category": "ACADEMIC",
        "verified": True,
        "description": "School of Design, Architecture and Fashion Technology 10-story tower."
    },
    {
        "id": 7,
        "name": "Central Library & Unipolis",
        "code": "LIB",
        "latitude": 31.255716,
        "longitude": 75.704998,
        "osm_id": 422437885,
        "osm_type": "way",
        "category": "LIBRARY",
        "verified": True,
        "description": "Multi-level Central University Library and Baldev Raj Mittal Unipolis central congregation."
    },
    {
        "id": 8,
        "name": "Girls Hostel Complex (GH-1 to GH-6)",
        "code": "GH",
        "latitude": 31.253669,
        "longitude": 75.700630,
        "osm_id": 422548301,
        "osm_type": "way",
        "category": "HOSTEL",
        "verified": True,
        "description": "Western residential sector: 7 connected 10-story towers. High morning peak rush origin."
    },
    {
        "id": 9,
        "name": "Boys Hostel Complex (BH-1 to BH-8)",
        "code": "BH",
        "latitude": 31.247999,
        "longitude": 75.703854,
        "osm_id": 422547446,
        "osm_type": "way",
        "category": "HOSTEL",
        "verified": True,
        "description": "Southern residential sector: 14 high-rise 9-10 story brick hostel towers."
    },
    {
        "id": 10,
        "name": "LPU Sports Stadium & Complex",
        "code": "STAD",
        "latitude": 31.256117,
        "longitude": 75.710229,
        "osm_id": 422553585,
        "osm_type": "way",
        "category": "SPORTS",
        "verified": True,
        "description": "LPU Ground, athletic tracks, indoor gymnasium, basketball and tennis courts."
    },
    {
        "id": 11,
        "name": "University Hospital & Health Centre",
        "code": "HOSP",
        "latitude": 31.255450,
        "longitude": 75.703550,
        "osm_id": 422437889,
        "osm_type": "way",
        "category": "MEDICAL",
        "verified": True,
        "description": "Campus Health Centre and Uni-Hospital. Primary medical priority golf cart dispatch point."
    },
    {
        "id": 12,
        "name": "Law Gate (West Gate / Auto Stand)",
        "code": "LG-04",
        "latitude": 31.254379,
        "longitude": 75.696314,
        "osm_id": 646987790,
        "osm_type": "way",
        "category": "GATE",
        "verified": True,
        "description": "Western exit into Law Gate market road, major E-rickshaw and Auto hub."
    }
]

with open(PROPOSED_STOPS_PATH, 'w', encoding='utf-8') as f:
    json.dump(PROPOSED_STOPS, f, indent=2)

print(f"Proposed verified stops saved to {PROPOSED_STOPS_PATH} ({len(PROPOSED_STOPS)} landmarks).")
