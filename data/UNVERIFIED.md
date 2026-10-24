# OpenStreetMap Data Verification Audit — Lovely Professional University (LPU)
**Dataset Source:** OpenStreetMap Overpass API (`/data/lpu_osm.json`, 112,315 elements, 9.51 MB)
**Campus Bounds:** `31.2450°N to 31.2620°N, 75.6980°E to 75.7150°E`

---

## 1. Directly Verified OSM Features (Tagged with Explicit Names / IDs)

| Landmark / Place Name | OSM Element | OSM ID | Latitude (°N) | Longitude (°E) | Official OSM Tags |
|---|---|---|---|---|---|
| **Main Gate (NH-44 Entry Complex)** | Way | `422550528` / `422550005` | `31.260520` | `75.706874` | `building=yes`, `building:levels=6`, campus entrance road |
| **Lovely Institute of Technology (Blocks 32-34 Engineering)** | Way | `354755644` | `31.257892` | `75.706885` | `name="Lovely Institute of Technology"`, `building:levels=7` |
| **Lovely Institute of Management (Block 38 Mittal School of Business)** | Way | `354743583` | `31.258602` | `75.708860` | `name="Lovely Institute Of Management"`, `building:levels=5` |
| **Lovely Institute of Pharmacy (Blocks 25-28)** | Way | `354830243` | `31.257620` | `75.707268` | `name="Lovely Institute of Pharmacy"`, `building:levels=5` |
| **School of Design (Block 35)** | Way | `425717552` | `31.256652` | `75.707028` | `name="School of Design"`, `building:levels=10` |
| **LPU Sports Ground / Stadium** | Way | `422553585` | `31.256117` | `75.710229` | `name="LPU Ground"`, `amenity=university` |
| **Indoor Sports Complex & Gym** | Way | `422555764` | `31.256038` | `75.710097` | `building=yes`, `leisure=sports_centre` |
| **Law Gate (West Campus Gate / E-Rickshaw Hub)** | Way | `752027029` / `646987790` | `31.254379` | `75.696314` | `name="Law gate"`, `highway=residential` |
| **LPU Master MultiPolygon Boundary** | Relation | `21599790` | Center `31.2550` | `75.7050` | `name="Lovely Professional University"` |

---

## 2. Verified Structural Footprints (Footprints Present in OSM, Exact Block Name Flags)

The following locations have precise, verified 3D building/complex polygons in the OSM dataset, but the specific sub-block labels (e.g. which tower is BH-1 vs BH-4, or Uni-Mall vs Central Library) rely on architectural level counts and spatial clusters. **Please verify or refine these names:**

| Proposed Stop / Landmark | Closest OSM Way ID | Latitude (°N) | Longitude (°E) | OSM Physical Attributes | Status / Verification Note |
|---|---|---|---|---|---|
| **Uni-Mall (Commercial Centre)** | Way `422437890` | `31.255268` | `75.703312` | 6-Level large commercial footprint | Centroid verified; tagged as 6-story building opposite academic lawn. |
| **Central Library & Unipolis** | Way `422437885` / `422437898` | `31.255716` | `75.704998` | 10-Level central landmark structure | Central academic block hub; verified 10-story tower footprint. |
| **Girls Hostel Complex (GH-1 to GH-6)** | Cluster `422548301 - 422548307` | `31.253669` | `75.700630` | 7 connected 10-story residential towers | High-density 10-level residential complex in west campus. |
| **Boys Hostel Complex (BH-1 to BH-8)** | Cluster `422547443 - 422547456` | `31.247999` | `75.703854` | 14 connected 9-10 story brick residential towers | Massive high-rise residential sector in southern campus. |
| **Shanti Devi Mittal Auditorium** | Way `422550004` / `426528613` | `31.256642` | `75.706069` | Large central civic building footprint | Located north-east of Central Library along inner loop. |
| **University Hospital & Health Centre** | Way `422437889` / `422738890` | `31.255450` | `75.703550` | Medical facility footprint near Main Gate corridor | Located near gate access road. |

---

## 3. Discrepancies / Flags for Student / Campus Confirmation

1. **Gate Nomenclature**: OSM marks the northern entry from NH-44 near Block 38 as the primary vehicular flyover entry (`31.2605, 75.7068`), while the western pedestrian & market gate is marked `Law Gate` (`31.2543, 75.6963`). Please confirm if you want "Gate 1 (NH-44)" and "Law Gate" as two distinct designated shuttle stops.
2. **Academic Block Numbering**: In OSM, the Faculty of Technology is Way `354755644` (Block 32-34 Engineering), and the School of Business is Way `354743583` (Block 38). We have preserved these exact building centroids.
3. **Hostels**: The Boys Hostel towers (`31.2480, 75.7038`) and Girls Hostel towers (`31.2537, 75.7006`) are extensive complexes; the proposed stop coordinates are set at the main transit loop access points for each complex.
