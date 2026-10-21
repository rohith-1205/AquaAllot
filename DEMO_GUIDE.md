# 💧 AquaAllot – Demo Guide (Wokwi + Dashboard)

This guide takes you from zero to a full live demo:
**tap an RFID card in Wokwi → pay (wallet or Razorpay) → water flows → dashboard updates → AI anomaly → admin stop.**

```
 ┌──────────────────┐   MQTT    ┌────────────────────┐   MQTT    ┌──────────────────────┐   HTTP   ┌─────────────────┐
 │  Wokwi ESP32     │ ────────► │ broker.hivemq.com  │ ◄──────── │ Backend (laptop)     │ ◄─────── │ Dashboard       │
 │  wokwi.com       │ ◄──────── │ (free public)      │ ────────► │ cd backend           │ ───────► │ localhost:5173  │
 │  RFID·OLED·valve │           └────────────────────┘           │ npm run dev  :5000   │          │ "Live Station"  │
 └──────────────────┘                                            └──────────────────────┘          └─────────────────┘
```

Wokwi runs on the internet, so it cannot reach `localhost`. Both the ESP32 and your backend connect **out** to the same
public MQTT broker and talk through it. No tunnel, no changing URLs.

---

## 1. One-time setup (≈ 10 minutes)

### 1.1 Backend
```bash
cd backend
npm run dev
```
The first run installs the Python packages (Flask, paho-mqtt, ...). You should see:
```
║  AquaAllot backend  →  http://localhost:5000/api/health   ║
║  MQTT     : broker.hivemq.com:1883                        ║
║  Razorpay : test keys loaded                              ║
✓ MQTT connected. Listening on aquaallot-demo-rohith1205/+/up
```
Your Razorpay **test** keys stay in `backend/.env` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).

### 1.2 Dashboard
In a **second terminal**, in the project root (where the main `package.json` is):
```bash
npm install      # first time only
npm run dev
```
Open **http://localhost:5173** → login `admin@aquaallot.com` / `admin123` (if asked).

### 1.3 Wokwi project (do this once, then just press ▶)
1. Go to **https://wokwi.com/projects/new/esp32** (sign in so you can save the project).
2. **sketch.ino** tab → delete everything → paste `esp32-wokwi/sketch.ino`.
3. **diagram.json** tab → delete everything → paste `esp32-wokwi/diagram.json`.
4. Click the **▾** next to the tabs → **New file…** → name it `libraries.txt` → paste `esp32-wokwi/libraries.txt`.
5. Press **Save**, then the green **▶ Start** button.
6. Wait ~10 s: the OLED shows **Cloud: ONLINE** and the green LED stops blinking.
   On the dashboard → **Live Station** → the 3 status pills turn green.

> 🔑 **One rule:** `TOPIC_ROOT` at the top of `sketch.ino` must equal `MQTT_TOPIC_ROOT` in the backend
> (default for both: `aquaallot-demo-rohith1205`). Change both if you want your own private channel.

---

## 2. What is where (navigation)

| Sidebar page | What you use it for |
|---|---|
| **Dashboard** | KPIs, the **live Wokwi card** at the top (who is at the tap + progress), hostel summary, charts |
| **Live Station** ⭐ | The main demo page: connection status, step tracker, water tank, Razorpay payment, control panel, live MQTT log |
| **Users** | Students, wallets, RFID cards. **Register a new card here** and it works in Wokwi immediately. Top up wallets. |
| **Payments** | Every transaction (Wallet / Razorpay / Test), litres, status |
| **Alerts** | Anomalies + alerts from the station (AI usage spike, leak, emergency stop). Resolve them here. |
| **Stations** | Hardware status. `STN-001 · LIVE · WOKWI` is the real simulation; the other two are sample data. |
| **Settings** | Water price (₹/L, also used by the station), MQTT info, **Reset demo data** |
| Dispenser Kiosk / Dispensing | The older software-only purchase screens (they don't drive Wokwi) |

### The Wokwi board

| Part | What it does | Keyboard (click the board first) |
|---|---|---|
| **RFID reader** | Click it → choose a card → **Tap** | – |
| **1 L / 2 L / 5 L** buttons | Choose quantity | `1`, `2`, `5` |
| **PAY** button | Pay from **wallet** · acknowledge an alarm · close the "done" screen | `p` |
| **ANOMALY** button | Simulate abnormal flow while dispensing | `a` |
| **Slide switch** | Right = **pipe leak** (water flows with valve closed) | – |
| LEDs | Green = system (blinks when offline) · Blue = valve open · Red = alert | – |
| Serial Monitor | Type a card UID (e.g. `01:02:03:04`) + Enter to tap it | – |

### Demo cards

| Wokwi card | UID | Student | Shows |
|---|---|---|---|
| 🔵 Blue | 01:02:03:04 | **Rohith** – ₹150 | Happy path with wallet |
| 🟢 Green | 11:22:33:44 | **Deepankishor** – ₹8 | Wallet too low → pay with **Razorpay** |
| 🟡 Yellow | 55:66:77:88 | **Sanjay** – ₹200, avg 1.5 L/day | 5 L > 3-sigma limit (3.0 L) → **AI anomaly** |
| 🟠 Key fob | C0:FF:EE:99 | Karthik N – suspended | Access denied (account) |
| 🔴 Red | AA:BB:CC:DD | – | Access denied (unknown card) |
| ⚪ NFC tag | 04:11:22:33:44:55:66 | – | Register live on the Users page |

---

## 3. Demo script (≈ 6 minutes)

Keep **Wokwi** and **Live Station** side by side.

**① Wallet payment (Rohith)**
1. Wokwi → click RFID reader → **Blue card** → **Tap**. OLED: *Hi Rohith, Wallet Rs 150*.
   Dashboard: Rohith appears, step 2 "Choose litres" lights up, MQTT log shows `card` → `card_result`.
2. Press **1 L** → OLED: *PAY Rs 5*. Dashboard: order card with **PENDING**.
3. Press **PAY** → wallet charged → blue valve LED on → tank fills live (20 L/min) → **Completed**.
4. Open **Payments**: new row `Wallet · 1 L · Completed`. **Users**: Rohith's wallet is ₹145.

**② Razorpay payment (Deepankishor)**
1. Tap the **Green card**, press **2 L**, press **PAY** → OLED: *! Low wallet balance*.
2. Dashboard → **Pay ₹10 with Razorpay** → Razorpay test popup → pay with test UPI `success@razorpay`
   or test card `4111 1111 1111 1111`, any future expiry, any CVV, OTP if asked.
3. The backend verifies the signature → sends `payment_ok` → the valve opens **in Wokwi**. 🎉

**③ AI anomaly (Sanjay)**
1. Tap the **Yellow card**, press **5 L**, press **PAY**.
2. After the 5 L the backend's 3-sigma check flags it → OLED **!! ALERT !! AI: usage spike!**, red LED,
   Live Station shows the red banner, **Alerts** page has *Unusual Consumption Spike* + an anomaly row.
3. Press **PAY** in Wokwi to acknowledge (or **Acknowledge & reset** on the dashboard).

**④ Security**
- Tap the **Red card** → *ACCESS DENIED – Unknown card*.
- Tap the **Key fob** → *ACCESS DENIED – Account suspended*.
- Users → **Add Student** → RFID `04:11:22:33:44:55:66` → tap the **NFC tag** in Wokwi → it works instantly.

**⑤ Admin control from the dashboard**
- Control panel → pick a student + litres → **Send order to Wokwi station** (the OLED shows the payment screen).
- While water is flowing → **Emergency stop** → valve closes in Wokwi, partial litres are saved, alert raised.
- **Tap a card (virtual)** buttons tap Wokwi cards without touching the RFID reader.

**⑥ Leak / sensor faults**
- Slide the **switch to the right** while idle → *LEAK: valve closed but water flowing* → alert.
  Slide it back, then press **PAY** to acknowledge.
- During dispensing press **ANOMALY** → valve closes, alert *Abnormal flow (test)*.

Reset everything for the next run: **Settings → Reset demo data**.

---

## 4. Backup plan: no Wokwi? Use the fake ESP32

`tools/fake_esp32.py` speaks the exact same MQTT messages as the firmware.
```bash
python tools/fake_esp32.py --demo     # plays scenes ① – ④ automatically
python tools/fake_esp32.py            # interactive: tap 01:02:03:04 / 1 / pay / anomaly / leak
```
(Run it from the project root after `npm run dev` has installed the backend packages.)

If the backend is down, the station still works in **OFFLINE MODE** (local cards, PAY = cash) and the
dashboard shows sample data with a yellow "Backend not reachable" bar.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| OLED stays on *WiFi: connecting…* | Wokwi needs a moment; make sure the diagram is the ESP32 DevKit one from this repo. |
| OLED *Cloud: connecting..* forever | Broker busy: change `MQTT_BROKER` to `test.mosquitto.org` in **both** `sketch.ino` and `backend/.env`. |
| Dashboard pill **MQTT broker: Connecting…** | Your network blocks port 1883 (common on college WiFi). Add to `backend/.env`: `MQTT_TRANSPORT=websockets` and `MQTT_PORT=8000`, restart the backend. (Wokwi itself can keep using 1883.) |
| ESP32 online in Wokwi but **Offline** on dashboard | `TOPIC_ROOT` in `sketch.ino` ≠ `MQTT_TOPIC_ROOT` in the backend. |
| OLED *NO SERVER REPLY* | The backend is not running or not connected to MQTT → check terminal 1. |
| Razorpay popup does not open | Check internet + test keys in `backend/.env`. Use the **test payment** link as a fallback. |
| *Python 3 was not found* | Install Python from python.org with **"Add to PATH"** ticked, reopen the terminal. |
| Old users still showing (MongoDB) | **Settings → Reset demo data**. |

### Changing things
| What | Where |
|---|---|
| Students, cards, wallets | `backend/demo_data.py` (bump `SEED_VERSION`) or the Users page |
| Water price | Settings page (saved in the backend, used by the station) |
| Anomaly rule | `detect_usage_anomaly()` in `backend/services.py` (average + 3 × std-dev of the student's daily use) |
| Flow speed | `frequency` of the clock generator in `diagram.json` (150 Hz = 20 L/min) |
| Broker / topic | top of `sketch.ino` + `backend/.env` (`MQTT_BROKER`, `MQTT_PORT`, `MQTT_TOPIC_ROOT`) |

> ⚠️ The public broker is shared by everyone. Fine for a demo, but anyone who knows your topic could send
> messages to your station. For a real deployment use a private broker (e.g. HiveMQ Cloud with a password).

---

## 6. MQTT message reference

Topic root: `aquaallot-demo-rohith1205/STN-001/…`

| ESP32 → backend (`/up`) | Backend → ESP32 (`/down`) |
|---|---|
| `hello`, `heartbeat` (every 5 s + every state change) | `card_result` {ok, name, balance, price} |
| `card` {uid} | `order_ready` {order_id, liters, amount, wallet_ok, remote} |
| `order` {user_id, liters} | `order_failed` {reason} |
| `pay_wallet` {order_id} | `payment_ok` {order_id, method, balance} → valve opens |
| `progress` {order_id, liters, flow} (every 1 s) | `payment_failed` {reason} |
| `complete` {order_id, liters, result: done/stopped/anomaly} | `finish_ok` {txn_id, balance, anomaly} |
| `anomaly` {reason} (leak), `ack`, `cancel` | `stop`, `reset`, `tap_card` {uid} |

`/status` carries `online` / `offline` (retained, MQTT last-will).
