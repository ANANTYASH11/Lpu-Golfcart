import asyncio
import httpx
import argparse
import random
import sys
from datetime import datetime

# Configure utf-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://localhost:8000/api/v1"

# Route stop sequences
ROUTE_1_STOPS = [1, 2, 3, 4, 5, 8, 7, 1]  # Main Gate -> UniMall -> B32 -> B34 -> B38 -> BH -> GH -> MG
ROUTE_2_STOPS = [8, 5, 3, 6, 7, 1]        # BH -> B38 -> B32 -> Library -> GH -> MG

STOP_NAMES = {
    1: "Main Gate (Gate 1)",
    2: "Uni-Mall Commercial Centre",
    3: "Block 32 (Computer Science)",
    4: "Block 34 (Engineering Labs)",
    5: "Block 38 (Mittal Business School)",
    6: "Central University Library",
    7: "Girls Hostel Complex (GH-1)",
    8: "Boys Hostel Complex (BH-1)",
    9: "Shanti Devi Mittal Auditorium",
    10: "University Hospital & Health Centre"
}

class CampusRideSimulator:
    def __init__(self, base_url: str = BASE_URL, peak_rush: bool = False, speed_multiplier: float = 1.0):
        self.base_url = base_url
        self.peak_rush = peak_rush
        self.step_delay = max(1.5, 4.0 / speed_multiplier)
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=10.0)
        self.driver_tokens = {}
        self.student_tokens = {}

    async def authenticate(self):
        print("[AUTH] Authenticating simulation actors...")
        actors = [
            ("harpreet_driver", "driver123", "shuttle_driver"),
            ("gurpreet_cart", "driver123", "cart_driver"),
            ("rohit_student", "student123", "student_regular"),
            ("priya_medical", "student123", "student_priority"),
        ]
        for username, password, key in actors:
            try:
                res = await self.client.post("/auth/login", json={"username": username, "password": password})
                if res.status_code == 200:
                    token = res.json()["access_token"]
                    if "driver" in key:
                        self.driver_tokens[key] = token
                    else:
                        self.student_tokens[key] = token
            except Exception as e:
                print(f"[AUTH-WARN] Error for {username}: {e}")

        print("[AUTH] Simulation actors authenticated successfully.")

    async def run(self):
        await self.authenticate()
        print("\n" + "="*65)
        if self.peak_rush:
            print(">>> CAMPUSRIDE SIMULATOR: [8:55 AM PEAK RUSH DEMO MODE]")
            print("    Simulating morning lecture rush: Full shuttles (>80%),")
            print("    surging cart demand, and medical emergency queue preemption!")
        else:
            print(">>> CAMPUSRIDE SIMULATOR: [NORMAL AUTONOMOUS DEMO MODE]")
            print("    Continuous shuttle movement, dynamic crowding & cart service.")
        print("="*65 + "\n")

        r1_idx = 0
        r2_idx = 0
        cycle = 0

        while True:
            cycle += 1
            now_str = datetime.now().strftime("%H:%M:%S")
            print(f"[{now_str}] --- Simulation Tick #{cycle} ---")

            if self.peak_rush:
                await self.simulate_peak_rush_tick(cycle, r1_idx, r2_idx)
            else:
                await self.simulate_normal_tick(cycle, r1_idx, r2_idx)

            r1_idx = (r1_idx + 1) % len(ROUTE_1_STOPS)
            r2_idx = (r2_idx + 1) % len(ROUTE_2_STOPS)

            # Autonomous Golf Cart Driver servicing
            await self.service_active_cart_bookings()

            await asyncio.sleep(self.step_delay)

    async def simulate_normal_tick(self, cycle: int, r1_idx: int, r2_idx: int):
        # 1. Advance Shuttle 1 on Route 1
        stop1 = ROUTE_1_STOPS[r1_idx]
        passengers_1 = random.randint(10, 26)  # 28% - 74%
        delay_1 = random.choice([0, 0, 30, 60])
        try:
            res = await self.client.post("/operations/trips/1/progress", json={
                "next_stop_id": stop1,
                "passenger_count": passengers_1,
                "delay_sec": delay_1
            })
            if res.status_code == 200:
                t = res.json()
                print(f"  [SHUTTLE 1] PB-08-LP-101: Reached {STOP_NAMES.get(stop1)} | {passengers_1}/35 pax ({t['current_crowd_level']})")
        except Exception as e:
            print(f"  [SHUTTLE 1 ERROR] {e}")

        # 2. Advance Shuttle 2 on Route 2
        stop2 = ROUTE_2_STOPS[r2_idx]
        passengers_2 = random.randint(15, 27)
        try:
            res = await self.client.post("/operations/trips/2/progress", json={
                "next_stop_id": stop2,
                "passenger_count": passengers_2,
                "delay_sec": random.choice([0, 60, 120])
            })
            if res.status_code == 200:
                t = res.json()
                print(f"  [SHUTTLE 2] PB-08-LP-102: Reached {STOP_NAMES.get(stop2)} | {passengers_2}/35 pax ({t['current_crowd_level']})")
        except Exception as e:
            print(f"  [SHUTTLE 2 ERROR] {e}")

        # 3. Occasional student golf cart booking
        if cycle % 4 == 0 and "student_regular" in self.student_tokens:
            token = self.student_tokens["student_regular"]
            pickup = random.choice([1, 2, 7, 8])
            drop = random.choice([3, 4, 5, 6])
            try:
                res = await self.client.post(
                    "/lastmile/bookings",
                    json={"pickup_stop_id": pickup, "drop_stop_id": drop, "passenger_count": random.randint(1, 2)},
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    b = res.json()
                    print(f"  [CART BOOKING] Student booked Cart #{b.get('assigned_cart_id') or 'Queued'}: from {STOP_NAMES.get(pickup)} -> {STOP_NAMES.get(drop)} ({b['status']})")
            except Exception:
                pass

    async def simulate_peak_rush_tick(self, cycle: int, r1_idx: int, r2_idx: int):
        print("  [8:55 AM RUSH] Surge egress from Hostels toward Block 32 & 34!")

        # Shuttle 1: Overcrowded at 32/35 (91% -> FULL!)
        stop1 = ROUTE_1_STOPS[r1_idx]
        passengers_1 = random.randint(30, 34)
        delay_1 = 180  # 3 min delay
        try:
            res = await self.client.post("/operations/trips/1/progress", json={
                "next_stop_id": stop1,
                "passenger_count": passengers_1,
                "delay_sec": delay_1
            })
            if res.status_code == 200:
                t = res.json()
                print(f"  [SHUTTLE 1 FULL] PB-08-LP-101: At {STOP_NAMES.get(stop1)} | {passengers_1}/35 pax [FULL - {t['current_crowd_level']}] Delay: 3m")
        except Exception as e:
            print(f"  [ERROR] {e}")

        # Shuttle 2: Overcrowded at 31/35 (88% -> FULL!)
        stop2 = ROUTE_2_STOPS[r2_idx]
        passengers_2 = random.randint(29, 33)
        try:
            res = await self.client.post("/operations/trips/2/progress", json={
                "next_stop_id": stop2,
                "passenger_count": passengers_2,
                "delay_sec": 120
            })
            if res.status_code == 200:
                t = res.json()
                print(f"  [SHUTTLE 2 FULL] PB-08-LP-102: At {STOP_NAMES.get(stop2)} | {passengers_2}/35 pax [FULL - {t['current_crowd_level']}]")
        except Exception as e:
            print(f"  [ERROR] {e}")

        # High priority Medical Request injected on Tick #1 or #2
        if cycle in [1, 2] and "student_priority" in self.student_tokens:
            token = self.student_tokens["student_priority"]
            try:
                res = await self.client.post(
                    "/lastmile/bookings",
                    json={
                        "pickup_stop_id": 10, # University Hospital
                        "drop_stop_id": 3,    # Block 32
                        "passenger_count": 1,
                        "is_priority": True,
                        "priority_reason": "Medical Need - Campus Health Centre to Exam Hall"
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )
                if res.status_code == 200:
                    b = res.json()
                    print(f"  [PRIORITY PREEMPTION] Injured student booked cart from Health Centre! Cart #{b.get('assigned_cart_id')} assigned immediately ({b['status']})")
            except Exception:
                pass

        # Multimodal journey query demonstrating redirection
        try:
            j_res = await self.client.get("/transport/journey?from=1&to=3")
            if j_res.status_code == 200:
                j = j_res.json()
                print(f"  [JOURNEY DIRECTIVE] \"{j['recommendation_summary']}\"")
        except Exception:
            pass

    async def service_active_cart_bookings(self):
        cart_token = self.driver_tokens.get("cart_driver")
        if not cart_token:
            return

        headers = {"Authorization": f"Bearer {cart_token}"}
        try:
            res = await self.client.get("/lastmile/bookings/driver/assigned", headers=headers)
            if res.status_code == 200 and res.json():
                b = res.json()
                b_id = b["id"]
                current_status = b["status"]

                if current_status == "ACCEPTED":
                    await self.client.patch(f"/lastmile/bookings/{b_id}/status", json={"action": "ARRIVING"}, headers=headers)
                    print(f"  [CART DRIVER] Arrived at pickup for Booking #{b_id} (5-min no-show window active)")
                elif current_status == "ARRIVING":
                    await self.client.patch(f"/lastmile/bookings/{b_id}/status", json={"action": "PICKED_UP"}, headers=headers)
                    print(f"  [CART DRIVER] Student boarded for Booking #{b_id} (In Transit)")
                elif current_status == "PICKED_UP":
                    await self.client.patch(f"/lastmile/bookings/{b_id}/status", json={"action": "COMPLETE"}, headers=headers)
                    print(f"  [CART DRIVER] Booking #{b_id} COMPLETED at destination. Cart freed.")
        except Exception:
            pass

async def main():
    parser = argparse.ArgumentParser(description="CampusRide LPU Simulation Engine")
    parser.add_argument("--mode", choices=["normal", "peak-rush"], default="normal", help="Simulation mode")
    parser.add_argument("--speed", type=float, default=1.0, help="Simulation speed multiplier")
    parser.add_argument("--url", type=str, default=BASE_URL, help="API Base URL")
    args = parser.parse_args()

    sim = CampusRideSimulator(
        base_url=args.url,
        peak_rush=(args.mode == "peak-rush"),
        speed_multiplier=args.speed
    )
    await sim.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[SIMULATION STOPPED] Terminated by user.")
