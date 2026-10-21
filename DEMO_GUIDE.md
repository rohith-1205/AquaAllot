# 💧 AquaAllot – Demo Guide (Wokwi + Dashboard)

This guide takes you from zero to a full live demo:
**tap an RFID card in Wokwi → pay from the prepaid wallet → water flows → dashboard updates → over-usage alert → admin stop + refund.**

```
 ┌──────────────────┐   MQTT    ┌────────────────────┐   MQTT    ┌──────────────────────┐   HTTP   ┌─────────────────┐
 │  Wokwi ESP32     │ ────────► │ test.mosquitto.org │ ◄──────── │ Backend (laptop)     │ ◄─────── │ Dashboard       │
 │  wokwi.com       │ ◄──────── │ (free public)      │ ────────► │ cd backend           │ ───────► │ localhost:5173  │
 │  RFID·OLED·valve │           └────────────────────┘           │ npm run dev  :5000   │          │ "Live Station"  │
 └──────────────────┘                                            └──────────────────────┘          └─────────────────┘
```

Wokwi runs on the internet, so it cannot reach `localhost`. Both the ESP32 and your backend connect **out** to the same
public MQTT broker and talk through it. No tunnel, no changing URLs.

---

## 💰 How money works (prepaid wallet)

| Step | What happens |
|---|---|
| **Top up** | Money enters a wallet **only** through Razorpay (Users page, User Details, or “Top up & pay” on Live Station). The backend verifies the Razorpay signature before adding money. |
| **Pay** | Every litre is paid **from the wallet** – PAY button in Wokwi or “Pay from wallet” on the dashboard. The order amount is reserved. |
| **Dispense** | When the valve closes the student is charged **only for the litres actually dispensed**; the rest goes back to the wallet. |
| **Stuck order** | Paid but no water for 60 s (station offline / reset) → the full amount is refunded automatically and an alert is raised. |
| **Unpaid order** | Expires after 15 minutes. |

## 🚨 Over-usage alerts (admin dashboard)

- Each student's **normal daily use** (average μ and spread σ) is learned from their last 30 days of transactions.
- When an order would push today's total above **μ + 3σ**, or above the **daily quota** (Settings, default 10 L), the order is
  still dispensed, the OLED shows a warning, and the admin gets **one alert per student per day**
  (Dashboard → *Over-usage today*, Alerts page).
- "Today" resets automatically at midnight.

---

## 1. One-time setup (≈ 10 minutes)

### 1.1 Backend
```bash
cd backend
copy .env.example .env      # Windows (macOS/Linux: cp .env.example .env) – then put your Razorpay TEST keys in it
npm run dev
```
The first run installs the Python packages. You should see:
```
║  Database : In-Memory (or MongoDB)                       ║
║  MQTT     : test.mosquitto.org:8081 (websockets)         ║
║  Razorpay : test keys loaded                              ║
✓ MQTT connected via test.mosquitto.org:8081 (websockets). Listening on aquaallot-demo-rohith1205/+/up
```

Other backend commands (inside `backend/`):

| Command | What it does |
|---|---|
| `npm run dev` | Start the API + MQTT bridge |
| `npm test` | Run the 21 automated tests of the business rules |
| `npm run check` | Find which MQTT broker/port your network allows |
| `npm run fake-esp32 -- --demo` | Pretend to be the Wokwi board (no Wokwi needed) |

### 1.2 Dashboard
In a **second terminal**, in the project root (where the main `package.json` is):
```bash
npm install      # first time (and after pulling, because node_modules is no longer in git)
npm run dev
```
Open **http://localhost:5173** → login `admin@aquaallot.com` / `admin123` (if asked).

### 1.3 Wokwi project (do this once, then just press ▶)
1. Go to **https://wokwi.com/projects/new/esp32** (sign in so you can save the project).
2. **sketch.ino** tab → paste `esp32-wokwi/sketch.ino`.
3. **diagram.json** tab → paste `esp32-wokwi/diagram.json`.
4. **▾ → New file… → `libraries.txt`** → paste `esp32-wokwi/libraries.txt`.
5. **Save**, then **▶ Start**. Wait ~10 s for **Cloud: ONLINE** on the OLED.

> 🔑 `TOPIC_ROOT` in `sketch.ino` must equal `MQTT_TOPIC_ROOT` in the backend (default `aquaallot-demo-rohith1205`),
> and `MQTT_BROKER` must be the same broker on both sides.

---

## 2. What is where

| Sidebar page | What you use it for |
|---|---|
| **Dashboard** | Live Wokwi card, KPIs (vs yesterday / last week), **Over-usage today**, hostel blocks today, real charts, recent transactions, open alerts |
| **Live Station** ⭐ | Connection status, step tracker, water tank, payment (wallet / top up & pay), control panel, live MQTT log |
| **Dispenser Kiosk** | Phone-style screen: choose student + litres → order goes to the real Wokwi station |
| **Users** | Students, wallets, cards. **Top up** (Razorpay). **Register a new card** – it works in Wokwi immediately |
| **New Order** | Admin version of the kiosk (also sends real orders to the station) |
| **Payments** | Transactions (charged / refunded), wallet top-ups, CSV export |
| **Analytics** | Real charts, busiest hour, each student today vs their normal limit and quota |
| **Alerts** | Over-usage (3-sigma), quota, refunds, leaks, emergency stops – resolve them here |
| **Stations** | `STN-001 · LIVE · WOKWI` is the real simulation; the other two are labelled *Sample* |
| **Settings** | Water price, daily quota, MQTT info, **Reset demo data** |

### The Wokwi board

| Part | What it does | Keyboard (click the board first) |
|---|---|---|
| **RFID reader** | Click it → choose a card → **Tap** | – |
| **1 L / 2 L / 5 L** | Choose quantity | `1`, `2`, `5` |
| **PAY** | Pay from the **wallet** · acknowledge an alarm · close the "done" screen | `p` |
| **ANOMALY** | Simulate abnormal flow while dispensing (valve closes, unused litres refunded) | `a` |
| **Slide switch** | Right = **pipe leak** (water flows with the valve closed) | – |
| Serial Monitor | Type a card UID (e.g. `01:02:03:04`) + Enter to tap it | – |

### Demo cards

| Wokwi card | UID | Student | Shows |
|---|---|---|---|
| 🔵 Blue | 01:02:03:04 | **Rohith** – ₹150 | Normal purchase from the wallet |
| 🟢 Green | 11:22:33:44 | **Deepankishor** – ₹8 | Wallet too low → **Top up with Razorpay & pay** |
| 🟡 Yellow | 55:66:77:88 | **Sanjay** – ₹200, normal ≈ 1.4 L/day | 5 L > 3-sigma limit → **over-usage alert** |
| 🟠 Key fob | C0:FF:EE:99 | Karthik N – suspended | Access denied (account) |
| 🔴 Red | AA:BB:CC:DD | – | Access denied (unknown card) |
| ⚪ NFC tag | 04:11:22:33:44:55:66 | – | Register live on the Users page (new students start with ₹0 → top up) |

---

## 3. Demo script (≈ 7 minutes)

Keep **Wokwi** and **Live Station** side by side.

**① Wallet payment (Rohith)**
1. Tap the **Blue card** → OLED *Hi Rohith, Wallet Rs 150*.
2. Press **1 L** → OLED *PAY Rs 5 … [PAY] = pay by wallet*.
3. Press **PAY** → valve opens → tank fills → OLED shows the charge and **Wallet Rs 145**.

**② Top up with Razorpay (Deepankishor)**
1. Tap the **Green card**, press **2 L**. OLED: *Wallet too low: top up on dashboard*.
2. Dashboard → **Top up ₹10 with Razorpay & pay** → test UPI `success@razorpay` or card `4111 1111 1111 1111`
   (any future expiry / CVV).
3. Backend verifies the signature → wallet +₹10 → paid from the wallet → valve opens in Wokwi 🎉.

**③ Over-usage alert (Sanjay)**
1. Tap the **Yellow card**, press **5 L**. OLED shows *! Above normal use*.
2. Dashboard → *Over-usage today* shows Sanjay in red; **Alerts** has *Unusual Consumption Spike* with μ, σ and the limit.
3. Press **PAY** – the water is still dispensed (the admin decides what to do).

**④ Refund of unused litres**
1. Rohith again: **5 L**, **PAY**.
2. While water flows → Live Station **Emergency stop** (or press **ANOMALY** in Wokwi).
3. Valve closes → only the dispensed litres are charged → the rest goes back to the wallet (see Payments: *Partly refunded*).

**⑤ Security**
- **Red card** → *Unknown card*. **Key fob** → *Account suspended*.
- Users → **Add Student** with RFID `04:11:22:33:44:55:66` → tap the **NFC tag** → works instantly (top up first).

**⑥ Offline mode + sync**
- Stop the backend → tap a card → the station runs in OFFLINE MODE (PAY = cash).
- Start the backend again → the board uploads the offline sale → it appears in Payments as *Cash (offline)*.

**⑦ Leak**
- Slide the **switch right** while idle → *LEAK: valve closed but water flowing* → alert. Slide back, press **PAY**.

Reset everything for the next run: **Settings → Reset demo data**.

---

## 4. Backup plan: no Wokwi? Use the fake ESP32

```bash
cd backend
npm run fake-esp32 -- --demo     # plays scenes ①–④ automatically
npm run fake-esp32               # interactive: tap 01:02:03:04 / 1 / pay / anomaly / leak
```

If the backend is down, the station still works in **OFFLINE MODE** and the dashboard shows sample data with a
yellow "Backend not reachable" bar.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard pill **MQTT broker: Connecting…** | Run `npm run check` in `backend/` – it prints the broker/port that works on your network. Put those in `backend/.env` and the same broker in `sketch.ino`. |
| ESP32 online in Wokwi but **Offline** on dashboard | `TOPIC_ROOT` / `MQTT_BROKER` in `sketch.ino` ≠ backend settings. |
| OLED *NO SERVER REPLY* | Backend not running or not connected to MQTT → check terminal 1. |
| Razorpay popup does not open | Check internet + test keys in `backend/.env`. Without keys the backend simulates top-ups. |
| *Python 3 was not found* | Install Python from python.org with **"Add to PATH"** ticked, reopen the terminal. |
| `vite` / packages missing after `git pull` | Run `npm install` in the project root (node_modules is not in git any more). |
| Old data with MongoDB | **Settings → Reset demo data** (the demo data version changed, so MongoDB is re-seeded automatically once). |

### Changing things
| What | Where |
|---|---|
| Students, cards, wallets, 30-day history | `backend/demo_data.py` (bump `SEED_VERSION`, then `python tools/export_sample_data.py`) |
| Water price, daily quota | Settings page |
| Over-usage rule | `usage_profile()` / `check_usage()` in `backend/services.py` |
| Refund timing | `STUCK_ORDER_SECONDS`, `PENDING_ORDER_MINUTES` in `backend/services.py` |
| Flow speed | `frequency` of the clock generator in `diagram.json` (150 Hz = 20 L/min) |

> ⚠️ The public broker is shared by everyone. Fine for a demo, but anyone who knows your topic could send messages to
> your station. For a real deployment use a private broker with a password.

---

## 6. MQTT message reference

Topic root: `aquaallot-demo-rohith1205/STN-001/…`

| ESP32 → backend (`/up`) | Backend → ESP32 (`/down`) |
|---|---|
| `hello`, `heartbeat` (every 5 s + every state change) | `card_result` {ok, name, balance, price} |
| `card` {uid} | `order_ready` {order_id, liters, amount, wallet_ok, warning, remote} |
| `order` {user_id, liters} | `order_failed` {reason} |
| `pay_wallet` {order_id} | `payment_ok` {order_id, balance} → valve opens |
| `progress` {order_id, liters, flow} (every 1 s) | `payment_failed` {reason} |
| `complete` {order_id, liters, result: done/stopped/anomaly} | `finish_ok` {txn_id, charged, refund, balance} |
| `offline_sale` {sale_id, uid, liters, amount, seconds_ago} | `stop`, `reset`, `tap_card` {uid} |
| `anomaly` {reason} (leak), `ack`, `cancel` | |

`/status` carries `online` / `offline` (retained, MQTT last-will).
