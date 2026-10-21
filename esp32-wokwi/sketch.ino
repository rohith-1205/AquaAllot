#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// =====================================================
//                    AQUAALLOT  v3
//  RFID + PAYMENT + SMART DISPENSING + FLOW MONITORING
//        connected to the dashboard through MQTT
// =====================================================
//
//  How it talks to your laptop:
//
//    this ESP32 (wokwi.com) ---> test.mosquitto.org <--- backend (npm run dev)
//
//  Every step (card, order, payment, litres, anomaly) is sent as a small
//  JSON message. The backend checks it and replies. If the backend can't
//  be reached, the station still works in OFFLINE MODE with local cards,
//  and the offline cash sales are uploaded once the cloud is back.
//
//  Money: water is always paid from the student's prepaid wallet (PAY
//  button or dashboard). Wallets are topped up with Razorpay on the dashboard.
//
//  Demo cards (built into the Wokwi RFID reader - click it to choose):
//    Blue   01:02:03:04  Rohith        Green  11:22:33:44  Deepankishor
//    Yellow 55:66:77:88  Sanjay        Red    AA:BB:CC:DD  unknown card
//
//  You can also type a card UID in the Serial Monitor, e.g.  01:02:03:04

// ---------------- SETTINGS (edit these) ----------------

const char* WIFI_SSID     = "Wokwi-GUEST";      // free internet inside Wokwi
const char* WIFI_PASSWORD = "";
const char* MQTT_BROKER   = "test.mosquitto.org";
const int   MQTT_PORT     = 1883;
const char* TOPIC_ROOT    = "aquaallot-demo-rohith1205";   // MUST match MQTT_TOPIC_ROOT in the backend
const char* STATION_ID    = "STN-001";
const char* FIRMWARE      = "3.1.0";

// ---------------- PIN DEFINITIONS ----------------

#define RFID_SS       5
#define RFID_RST      27
#define SPI_SCK       18
#define SPI_MISO      19
#define SPI_MOSI      23

#define OLED_SDA      21
#define OLED_SCL      22

#define RELAY_PIN     26     // solenoid valve (through the relay)
#define FLOW_PIN      25     // flow sensor pulses (clock generator in Wokwi)
#define BUZZER_PIN    14

#define STATUS_LED     2     // green  - system on / blinks when cloud is offline
#define VALVE_LED      4     // blue   - valve open
#define ANOMALY_LED   12     // red    - alert

#define BTN_1L        32
#define BTN_2L        33
#define BTN_5L        16
#define BTN_PAY       17
#define BTN_ANOMALY   13
#define LEAK_SWITCH   34     // slide switch: right = simulate a pipe leak

// ---------------- TIMINGS ----------------

const unsigned long REPLY_TIMEOUT_MS   = 7000;     // wait this long for the backend
const unsigned long MENU_TIMEOUT_MS    = 30000;    // nobody chose a quantity
const unsigned long PAYMENT_TIMEOUT_MS = 180000;   // nobody paid
const unsigned long NO_FLOW_TIMEOUT_MS = 5000;     // valve open but no water
const unsigned long DONE_SCREEN_MS     = 7000;     // "thank you" screen
const unsigned long NOTICE_SCREEN_MS   = 2500;     // short messages
const unsigned long HEARTBEAT_MS       = 5000;
const unsigned long PROGRESS_MS        = 1000;

// ---------------- FLOW SENSOR ----------------

const float PULSES_PER_LITER = 450.0;    // YF-S201 style sensor
const float OFFLINE_PRICE    = 5.0;      // Rs per litre when the backend is unreachable

volatile unsigned long flowPulses = 0;   // pulses while the valve is open
volatile unsigned long leakPulses = 0;   // pulses while the valve is CLOSED (= leak)
volatile bool valveIsOpen  = false;
volatile bool leakSwitchOn = false;

// ---------------- OLED + RFID + NETWORK ----------------

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
MFRC522 rfid(RFID_SS, RFID_RST);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// ---------------- SYSTEM STATES ----------------

enum SystemState {
  WAIT_CARD,            // home screen
  CHECKING_CARD,        // asked backend "who is this card?"
  CHOOSE_QUANTITY,      // 1 / 2 / 5 L menu
  CREATING_ORDER,       // asked backend to create the order
  WAIT_PAYMENT,         // PAY button or "Pay from wallet" on the dashboard
  CONFIRMING_PAYMENT,   // asked backend to take money from the wallet
  DISPENSING,           // valve open, counting litres
  COMPLETE,             // done screen
  ALERT,                // valve closed because of an anomaly
  NOTICE                // short message, then back home
};

SystemState state = WAIT_CARD;

// ---------------- CURRENT CUSTOMER / ORDER ----------------

String cardUid = "";
String userId = "";
String userName = "";
float walletBalance = 0;
float pricePerLiter = OFFLINE_PRICE;

String orderId = "";
float orderLiters = 0;
float orderAmount = 0;
bool walletEnough = false;
String payMethod = "";
String txnLabel = "";
String paymentNote = "";
String alertReason = "";
String orderWarning = "";      // e.g. "Above normal use" (admin is alerted)
float refundAmount = 0;        // unused litres returned to the wallet

float dispensedLiters = 0;
float flowLpm = 0;
unsigned long offlineTxnNo = 1001;

// ---------------- TIMERS ----------------

unsigned long stateSince = 0;
unsigned long lastDisplay = 0;
unsigned long lastProgress = 0;
unsigned long lastFlowSample = 0;
unsigned long lastPulseSnapshot = 0;
unsigned long lastPulseChange = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastWifiTry = 0;
unsigned long lastMqttTry = 0;

// ---------------- OFFLINE SALES (uploaded when back online) ----------------

struct OfflineSale {
  String id;
  String uid;
  float liters;
  float amount;
  unsigned long at;     // millis() when it happened
};

const int MAX_OFFLINE_SALES = 10;
OfflineSale offlineSales[MAX_OFFLINE_SALES];
int offlineSaleCount = 0;


// =====================================================
//                 SMALL HELPERS
// =====================================================

bool pressedButton(int pin);   // defined near the bottom

bool cloudOnline() {
  return mqtt.connected();
}

bool timedOut(unsigned long ms) {
  return millis() - stateSince > ms;
}

// The state name the dashboard understands
const char* stateName() {
  switch (state) {
    case WAIT_CARD:          return "IDLE";
    case NOTICE:             return "IDLE";
    case CHECKING_CARD:      return "CHECKING";
    case CHOOSE_QUANTITY:    return "CARD_OK";
    case CREATING_ORDER:     return "CARD_OK";
    case WAIT_PAYMENT:       return "AWAITING_PAYMENT";
    case CONFIRMING_PAYMENT: return "AWAITING_PAYMENT";
    case DISPENSING:         return "DISPENSING";
    case COMPLETE:           return "COMPLETE";
    case ALERT:              return "ALERT";
  }
  return "IDLE";
}

String topic(const char* channel) {
  return String(TOPIC_ROOT) + "/" + STATION_ID + "/" + channel;
}


// =====================================================
//                 FLOW SENSOR INTERRUPT
// =====================================================
// In Wokwi a clock generator sends pulses all the time (= water pressure
// in the pipe). Water only reaches the sensor when the valve is open -
// or when the LEAK switch is on.

void IRAM_ATTR countFlowPulse() {
  if (valveIsOpen)
    flowPulses = flowPulses + 1;
  else if (leakSwitchOn)
    leakPulses = leakPulses + 1;
}


// =====================================================
//                    BUZZER
// =====================================================

void beep(int durationMs) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(durationMs);
  digitalWrite(BUZZER_PIN, LOW);
}


// =====================================================
//                  VALVE CONTROL
// =====================================================

void valveOpen() {
  valveIsOpen = true;
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(VALVE_LED, HIGH);
  Serial.println("[ACTUATOR] Solenoid valve OPEN");
}

void valveClose() {
  valveIsOpen = false;
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(VALVE_LED, LOW);
  Serial.println("[ACTUATOR] Solenoid valve CLOSED");
}


// =====================================================
//                 CLOUD (MQTT) MESSAGES
// =====================================================

// Send one event to the backend. `doc` holds the extra fields.
bool sendEvent(const char* type, JsonDocument& doc) {
  if (!cloudOnline())
    return false;

  doc["type"]  = type;
  doc["state"] = stateName();
  doc["valve"] = valveIsOpen ? "Open" : "Closed";
  doc["rssi"]  = WiFi.RSSI();

  char buffer[384];
  serializeJson(doc, buffer, sizeof(buffer));
  bool sent = mqtt.publish(topic("up").c_str(), buffer);

  if (strcmp(type, "progress") != 0 && strcmp(type, "heartbeat") != 0) {
    Serial.print("[CLOUD] -> ");
    Serial.println(buffer);
  }
  return sent;
}

bool sendEvent(const char* type) {
  JsonDocument doc;
  return sendEvent(type, doc);
}


// =====================================================
//                     OLED SCREENS
// =====================================================

void oledClear() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
}

void showHome() {
  oledClear();
  display.setTextSize(2);
  display.println("AQUA");
  display.println("ALLOT");
  display.setTextSize(1);
  display.println("Tap your RFID card");
  display.println();

  if (cloudOnline())
    display.println("Cloud: ONLINE");
  else if (WiFi.status() == WL_CONNECTED)
    display.println("Cloud: connecting..");
  else
    display.println("WiFi: connecting...");

  display.display();
}

void showMessage(const char* title, String line1, String line2, String line3) {
  oledClear();
  display.println(title);
  display.println("---------------------");
  display.println(line1);
  display.println(line2);
  display.println(line3);
  display.display();
}

void showQuantityMenu() {
  oledClear();
  display.print("Hi ");
  display.println(userName);
  display.print("Wallet: Rs ");
  display.println(walletBalance, 0);
  display.println("---------------------");
  display.println("Choose water:");
  display.print("[1]  1 L   Rs ");  display.println(1 * pricePerLiter, 0);
  display.print("[2]  2 L   Rs ");  display.println(2 * pricePerLiter, 0);
  display.print("[5]  5 L   Rs ");  display.println(5 * pricePerLiter, 0);
  display.display();
}

void showPayment() {
  oledClear();
  display.print("PAY Rs ");
  display.print(orderAmount, 0);
  display.print(" for ");
  display.print(orderLiters, 0);
  display.println(" L");
  display.println("---------------------");
  display.print("Wallet: Rs ");
  display.println(walletBalance, 0);
  if (walletEnough) {
    display.println("[PAY] = pay by wallet");
  } else {
    display.println("Wallet too low:");
    display.println("top up on dashboard");
  }
  if (orderWarning.length()) {
    display.print("! ");
    display.println(orderWarning);
  }
  if (paymentNote.length()) {
    display.print("! ");
    display.println(paymentNote);
  }
  display.display();
}

void showDispensing() {
  float remaining = orderLiters - dispensedLiters;
  if (remaining < 0)
    remaining = 0;

  oledClear();
  display.println("DISPENSING...");
  display.print("User  : ");   display.println(userName);
  display.print("Target: ");   display.print(orderLiters, 2);     display.println(" L");
  display.print("Used  : ");   display.print(dispensedLiters, 2); display.println(" L");
  display.print("Remain: ");   display.print(remaining, 2);       display.println(" L");
  display.print("Flow  : ");   display.print(flowLpm, 1);         display.println(" L/min");

  // progress bar
  int barWidth = orderLiters > 0 ? (int)(124 * dispensedLiters / orderLiters) : 0;
  display.drawRect(0, 54, 128, 10, SSD1306_WHITE);
  display.fillRect(2, 56, barWidth, 6, SSD1306_WHITE);
  display.display();
}

void showComplete() {
  oledClear();
  display.println("DONE - THANK YOU!");
  display.println("---------------------");
  display.print("Delivered: ");  display.print(dispensedLiters, 2);  display.println(" L");
  display.print("Paid by  : ");  display.println(payMethod);
  display.print("Wallet   : Rs ");  display.println(walletBalance, 0);
  if (refundAmount > 0) {
    display.print("Refunded : Rs ");  display.println(refundAmount, 2);
  }
  display.println(txnLabel.length() ? txnLabel : String("Saving..."));
  display.display();
}

void showAlert() {
  oledClear();
  display.println("!!  ALERT  !!");
  display.println("---------------------");
  display.println(alertReason);
  if (refundAmount > 0) {
    display.print("Refund Rs ");
    display.print(refundAmount, 2);
    display.println(" to wallet");
  } else {
    display.println();
  }
  display.println("VALVE CLOSED");
  display.println("Admin notified");
  display.println("[PAY] = acknowledge");
  display.display();
}


// =====================================================
//                  STATE + SESSION
// =====================================================

void setState(SystemState newState) {
  state = newState;
  stateSince = millis();
  Serial.print("[STATE] ");
  Serial.println(stateName());
  sendEvent("heartbeat");          // dashboard sees the new state at once
}

void clearSession() {
  cardUid = userId = userName = "";
  orderId = payMethod = txnLabel = paymentNote = alertReason = orderWarning = "";
  refundAmount = 0;
  walletBalance = orderLiters = orderAmount = 0;
  walletEnough = false;
  dispensedLiters = flowLpm = 0;
  noInterrupts();
  flowPulses = 0;
  interrupts();
}

void resetToHome() {
  valveClose();
  clearSession();
  digitalWrite(ANOMALY_LED, LOW);
  setState(WAIT_CARD);
  showHome();
  Serial.println("System Ready - waiting for RFID...");
}

// Short message, then back to the home screen
void showNotice(const char* title, String line1, String line2) {
  showMessage(title, line1, line2, "");
  setState(NOTICE);
}

void enterAlert(String reason) {
  valveClose();
  alertReason = reason;
  digitalWrite(ANOMALY_LED, HIGH);
  setState(ALERT);
  showAlert();
  Serial.print("[ALERT] ");
  Serial.println(reason);
  beep(500);
}


// =====================================================
//                  TRANSACTION LOG (Serial)
// =====================================================

void logTransaction(const char* result) {
  Serial.println();
  Serial.println("========== TRANSACTION ==========");
  Serial.print("Order          : ");  Serial.println(orderId.length() ? orderId : String("offline"));
  Serial.print("User           : ");  Serial.println(userName);
  Serial.print("Paid by        : ");  Serial.println(payMethod);
  Serial.print("Amount         : Rs "); Serial.println(orderAmount, 0);
  Serial.print("Quantity       : ");  Serial.print(dispensedLiters, 2);  Serial.println(" L");
  Serial.print("Result         : ");  Serial.println(result);
  Serial.print("Saved to cloud : ");  Serial.println(cloudOnline() && orderId.length() ? "yes" : "no (offline)");
  Serial.println("=================================");
  Serial.println();
}


// =====================================================
//           STEP 1 - CARD  (RFID / dashboard / Serial)
// =====================================================

// Cards known when the backend is offline
String offlineUser(String uid) {
  if (uid == "01:02:03:04") return "Rohith";
  if (uid == "11:22:33:44") return "Deepankishor";
  if (uid == "55:66:77:88") return "Sanjay";
  return "";
}

void onCardResult(bool ok, String id, String name, float balance, String reason) {
  if (state != CHECKING_CARD && state != WAIT_CARD && state != NOTICE)
    return;   // late reply, ignore

  if (!ok) {
    Serial.print("[SECURITY] ACCESS DENIED: ");
    Serial.println(reason);
    beep(300);
    showNotice("ACCESS DENIED", reason, "Card: " + cardUid);
    return;
  }

  userId = id;
  userName = name;
  walletBalance = balance;
  Serial.print("[RFID] AUTHENTICATED: ");
  Serial.println(userName);
  beep(100);
  setState(CHOOSE_QUANTITY);
  showQuantityMenu();
}

void onCardScanned(String uid) {
  uid.trim();
  uid.toUpperCase();
  cardUid = uid;
  Serial.print("[RFID] UID: ");
  Serial.println(uid);

  if (cloudOnline()) {
    JsonDocument doc;
    doc["uid"] = uid;
    sendEvent("card", doc);
    setState(CHECKING_CARD);
    showMessage("CHECKING CARD...", uid, "", "Please wait");
    return;
  }

  // OFFLINE MODE
  String name = offlineUser(uid);
  if (name.length())
    onCardResult(true, "offline", name, 0, "");
  else
    onCardResult(false, "", "", 0, "Unknown card");
}

String uidToString() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i)
      uid += ":";
    if (rfid.uid.uidByte[i] < 0x10)
      uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void checkRFID() {
  if (!rfid.PICC_IsNewCardPresent())
    return;
  if (!rfid.PICC_ReadCardSerial())
    return;

  onCardScanned(uidToString());

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}


// =====================================================
//               STEP 2 - QUANTITY + ORDER
// =====================================================

void onOrderReady(String id, String uid, String name, float balance,
                  float liters, float amount, bool walletOk, bool fromDashboard, String warning) {
  if (fromDashboard) {
    // Admin started an order on the dashboard: only accept it when nobody is at the tap
    if (state != WAIT_CARD && state != NOTICE)
      return;
    userId = uid;
    userName = name;
  } else if (state != CREATING_ORDER) {
    return;
  }

  orderId = id;
  walletBalance = balance;
  orderLiters = liters;
  orderAmount = amount;
  walletEnough = walletOk;
  paymentNote = "";
  orderWarning = warning;
  if (warning.length()) {
    Serial.print("[USAGE] ");
    Serial.print(warning);
    Serial.println(" - admin alerted on the dashboard");
  }

  Serial.print("[ORDER] ");
  Serial.print(orderLiters, 1);
  Serial.print(" L  ->  Rs ");
  Serial.println(orderAmount, 0);

  beep(80);
  setState(WAIT_PAYMENT);
  showPayment();
}

void requestOrder(float liters) {
  orderLiters = liters;

  if (cloudOnline()) {
    JsonDocument doc;
    doc["user_id"] = userId;
    doc["liters"] = liters;
    sendEvent("order", doc);
    setState(CREATING_ORDER);
    showMessage("CREATING ORDER...", String(liters, 0) + " L for " + userName, "", "Please wait");
    return;
  }

  // OFFLINE MODE
  onOrderReady("", userId, userName, 0, liters, liters * OFFLINE_PRICE, true, false, "");
}

void handleQuantity() {
  if (pressedButton(BTN_1L))       requestOrder(1);
  else if (pressedButton(BTN_2L))  requestOrder(2);
  else if (pressedButton(BTN_5L))  requestOrder(5);
  else if (timedOut(MENU_TIMEOUT_MS)) resetToHome();
}


// =====================================================
//                  STEP 3 - PAYMENT
// =====================================================

void startDispensing();

void onPaymentOk(String method, float balance) {
  if (state != WAIT_PAYMENT && state != CONFIRMING_PAYMENT)
    return;
  payMethod = method;
  walletBalance = balance;
  Serial.print("[PAYMENT] SUCCESS via ");
  Serial.println(payMethod);
  beep(150);
  startDispensing();
}

void onPaymentFailed(String reason) {
  if (state != CONFIRMING_PAYMENT)
    return;
  Serial.print("[PAYMENT] FAILED: ");
  Serial.println(reason);
  paymentNote = reason;
  walletEnough = false;   // screen now says "top up on dashboard"
  beep(300);
  setState(WAIT_PAYMENT);
  showPayment();
}

void handlePayment() {
  if (pressedButton(BTN_PAY)) {
    if (cloudOnline() && orderId.length()) {
      JsonDocument doc;
      doc["order_id"] = orderId;
      sendEvent("pay_wallet", doc);
      setState(CONFIRMING_PAYMENT);
      showMessage("CHECKING WALLET...", userName, "Rs " + String(orderAmount, 0), "Please wait");
    } else {
      onPaymentOk("Cash (offline)", walletBalance);   // OFFLINE MODE
    }
    return;
  }

  if (timedOut(PAYMENT_TIMEOUT_MS)) {
    JsonDocument doc;
    doc["order_id"] = orderId;
    sendEvent("cancel", doc);
    showNotice("ORDER CANCELLED", "No payment received", "");
  }
}


// =====================================================
//              STEP 4 - FLOW + DISPENSING
// =====================================================

void startDispensing() {
  noInterrupts();
  flowPulses = 0;
  interrupts();

  dispensedLiters = 0;
  flowLpm = 0;
  lastPulseSnapshot = 0;
  lastFlowSample = lastProgress = lastPulseChange = millis();

  valveOpen();
  setState(DISPENSING);
  showDispensing();
}

void queueOfflineSale(String uid, float liters, float amount) {
  if (offlineSaleCount >= MAX_OFFLINE_SALES) {
    Serial.println("[OFFLINE] Sale queue full - oldest sale dropped");
    for (int i = 1; i < MAX_OFFLINE_SALES; i++)
      offlineSales[i - 1] = offlineSales[i];
    offlineSaleCount--;
  }
  OfflineSale& sale = offlineSales[offlineSaleCount++];
  sale.id = String(STATION_ID) + "-" + String((uint32_t)esp_random(), HEX);
  sale.uid = uid;
  sale.liters = liters;
  sale.amount = amount;
  sale.at = millis();
  Serial.print("[OFFLINE] Sale saved for upload later (");
  Serial.print(offlineSaleCount);
  Serial.println(" waiting)");
}

// Send waiting offline sales to the backend (oldest first)
void uploadOfflineSales() {
  while (offlineSaleCount > 0 && cloudOnline()) {
    OfflineSale& sale = offlineSales[0];
    JsonDocument doc;
    doc["sale_id"] = sale.id;
    doc["uid"] = sale.uid;
    doc["liters"] = sale.liters;
    doc["amount"] = sale.amount;
    doc["seconds_ago"] = (millis() - sale.at) / 1000;
    if (!sendEvent("offline_sale", doc))
      return;   // try again later
    for (int i = 1; i < offlineSaleCount; i++)
      offlineSales[i - 1] = offlineSales[i];
    offlineSaleCount--;
  }
}

// result: "done", "stopped" or "anomaly"
void finishDispensing(const char* result, String reason) {
  valveClose();
  flowLpm = 0;
  logTransaction(result);

  if (orderId.length()) {
    JsonDocument doc;
    doc["order_id"] = orderId;
    doc["liters"] = dispensedLiters;
    doc["result"] = result;
    doc["reason"] = reason;
    sendEvent("complete", doc);
  } else if (dispensedLiters > 0) {
    // OFFLINE MODE sale: remember it and upload it when the cloud is back
    float charged = orderLiters > 0 ? orderAmount * dispensedLiters / orderLiters : 0;
    queueOfflineSale(cardUid, dispensedLiters, charged);
  }

  if (strcmp(result, "done") == 0) {
    if (!orderId.length() || !cloudOnline())
      txnLabel = "TXN: AA" + String(offlineTxnNo++) + " (offline)";
    beep(200);
    setState(COMPLETE);
    showComplete();
  } else {
    enterAlert(reason);
  }
}

void handleDispensing() {
  unsigned long pulsesCopy;
  noInterrupts();
  pulsesCopy = flowPulses;
  interrupts();

  dispensedLiters = pulsesCopy / PULSES_PER_LITER;
  unsigned long now = millis();

  // Flow rate every second
  if (now - lastFlowSample >= 1000) {
    unsigned long pulseDelta = pulsesCopy - lastPulseSnapshot;
    flowLpm = (pulseDelta / PULSES_PER_LITER) * 60.0;
    if (pulseDelta > 0)
      lastPulseChange = now;
    lastPulseSnapshot = pulsesCopy;
    lastFlowSample = now;
  }

  // Live progress to the dashboard
  if (now - lastProgress >= PROGRESS_MS) {
    lastProgress = now;
    JsonDocument doc;
    doc["order_id"] = orderId;
    doc["liters"] = dispensedLiters;
    doc["flow"] = flowLpm;
    sendEvent("progress", doc);
  }

  // Anomaly test button
  if (pressedButton(BTN_ANOMALY)) {
    Serial.println("[ANOMALY] Abnormal flow reported (test button)");
    finishDispensing("anomaly", "Abnormal flow (test)");
    return;
  }

  // Valve open but no water arriving
  if (now - lastPulseChange > NO_FLOW_TIMEOUT_MS) {
    finishDispensing("anomaly", "No water flow");
    return;
  }

  if (now - lastDisplay >= 250) {
    lastDisplay = now;
    showDispensing();
  }

  // Target reached
  if (dispensedLiters >= orderLiters) {
    dispensedLiters = orderLiters;
    finishDispensing("done", "");
  }
}


// =====================================================
//          STEP 5 - REPLIES AFTER DISPENSING
// =====================================================

// The backend saved the order: shows the real charge, refund and new wallet balance
void onFinishSaved(float balance, float refund, String txnId) {
  walletBalance = balance;
  refundAmount = refund;
  txnLabel = "Saved: " + txnId;
  if (refund > 0) {
    Serial.print("[WALLET] Refunded Rs ");
    Serial.print(refund, 2);
    Serial.println(" for undispensed water");
  }
  if (state == COMPLETE)
    showComplete();
  else if (state == ALERT)
    showAlert();
}

void onRemoteStop(String reason) {
  if (state == DISPENSING)
    finishDispensing("stopped", reason);
  else
    enterAlert(reason);
}


// =====================================================
//              LEAK DETECTION (valve closed)
// =====================================================

void checkForLeak() {
  leakSwitchOn = digitalRead(LEAK_SWITCH) == HIGH;

  if (state == ALERT || valveIsOpen) {
    leakPulses = 0;
    return;
  }

  if (leakPulses > 30) {          // ~0.07 L passed with the valve closed
    leakPulses = 0;
    JsonDocument doc;
    doc["reason"] = "Leak: flow with valve closed";
    sendEvent("anomaly", doc);
    enterAlert("LEAK: valve closed but water flowing");
  }
}


// =====================================================
//           MESSAGES FROM THE BACKEND (MQTT)
// =====================================================

void onCloudMessage(char* topicName, byte* payload, unsigned int length) {
  JsonDocument msg;
  if (deserializeJson(msg, (const char*)payload, length))
    return;   // not JSON - ignore

  String type = msg["type"] | "";
  Serial.print("[CLOUD] <- ");
  Serial.println(type);

  if (type == "card_result") {
    pricePerLiter = msg["price"] | OFFLINE_PRICE;
    onCardResult(msg["ok"] | false, msg["user_id"] | "", msg["name"] | "",
                 msg["balance"] | 0.0, msg["reason"] | "Rejected");
  }
  else if (type == "order_ready") {
    onOrderReady(msg["order_id"] | "", msg["user_id"] | "", msg["name"] | "",
                 msg["balance"] | 0.0, msg["liters"] | 0.0, msg["amount"] | 0.0,
                 msg["wallet_ok"] | false, msg["remote"] | false, msg["warning"] | "");
  }
  else if (type == "order_failed") {
    if (state == CREATING_ORDER)
      showNotice("ORDER FAILED", msg["reason"] | "Try again", "");
  }
  else if (type == "payment_ok") {
    if (orderId == (msg["order_id"] | ""))
      onPaymentOk(msg["method"] | "Online", msg["balance"] | 0.0);
  }
  else if (type == "payment_failed") {
    onPaymentFailed(msg["reason"] | "Payment failed");
  }
  else if (type == "finish_ok") {
    if (orderId == (msg["order_id"] | ""))
      onFinishSaved(msg["balance"] | 0.0, msg["refund"] | 0.0, msg["txn_id"] | "");
  }
  else if (type == "stop") {
    onRemoteStop(msg["reason"] | "Stopped by admin");
  }
  else if (type == "reset") {
    resetToHome();
  }
  else if (type == "tap_card") {
    if (state == WAIT_CARD || state == NOTICE)
      onCardScanned(msg["uid"] | "");
  }
}


// =====================================================
//               WIFI + MQTT CONNECTION
// =====================================================

void connectMqtt() {
  String clientId = String("aquaallot-") + STATION_ID + "-" + String((uint32_t)esp_random(), HEX);
  String statusTopic = topic("status");

  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_BROKER);
  Serial.println("...");

  // Last will: the broker marks us "offline" if we disappear
  if (!mqtt.connect(clientId.c_str(), statusTopic.c_str(), 1, true, "offline")) {
    Serial.print("[MQTT] failed, rc=");
    Serial.println(mqtt.state());
    return;
  }

  mqtt.publish(statusTopic.c_str(), "online", true);
  mqtt.subscribe(topic("down").c_str());

  JsonDocument doc;
  doc["fw"] = FIRMWARE;
  doc["ip"] = WiFi.localIP().toString();
  sendEvent("hello", doc);

  Serial.print("[MQTT] Connected. Topic: ");
  Serial.println(topic("up"));
  uploadOfflineSales();
  if (state == WAIT_CARD)
    showHome();
}

// Called every loop: reconnects WiFi/MQTT without blocking the station
void keepCloudConnected() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED, (now / 500) % 2);            // blink = offline
    if (now - lastWifiTry > 15000) {
      lastWifiTry = now;
      Serial.println("[WIFI] Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
    }
    return;
  }

  static bool wasConnected = false;
  if (!mqtt.connected()) {
    if (wasConnected) {
      // Codes: -4 timeout, -3 connection lost, -2 connect failed, -1 disconnected
      Serial.print("[MQTT] Connection lost, state=");
      Serial.println(mqtt.state());
      wasConnected = false;
    }
    digitalWrite(STATUS_LED, (now / 500) % 2);
    if (now - lastMqttTry > 5000) {
      lastMqttTry = now;
      connectMqtt();
    }
    return;
  }

  wasConnected = true;
  digitalWrite(STATUS_LED, HIGH);                          // solid = online
  mqtt.loop();

  if (now - lastHeartbeat > HEARTBEAT_MS) {
    lastHeartbeat = now;
    sendEvent("heartbeat");
  }
}


// =====================================================
//          SERIAL MONITOR: type a card UID to tap it
// =====================================================

void checkSerialInput() {
  if (!Serial.available())
    return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.startsWith("scan "))
    line = line.substring(5);
  if (line.length() >= 8 && (state == WAIT_CARD || state == NOTICE))
    onCardScanned(line);
}


// =====================================================
//                 BUTTON DEBOUNCE
// =====================================================

bool pressedButton(int pin) {
  // True only at the moment the button goes DOWN (holding it does not repeat).
  static bool wasDown[40] = {false};
  static unsigned long lastChange[40] = {0};

  bool down = digitalRead(pin) == LOW;
  if (down != wasDown[pin] && millis() - lastChange[pin] > 30) {   // 30 ms debounce
    wasDown[pin] = down;
    lastChange[pin] = millis();
    return down;
  }
  return false;
}


// =====================================================
//                       SETUP
// =====================================================

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(100);
  delay(300);

  // OUTPUTS
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(VALVE_LED, OUTPUT);
  pinMode(ANOMALY_LED, OUTPUT);

  // BUTTONS + SWITCH
  pinMode(BTN_1L, INPUT_PULLUP);
  pinMode(BTN_2L, INPUT_PULLUP);
  pinMode(BTN_5L, INPUT_PULLUP);
  pinMode(BTN_PAY, INPUT_PULLUP);
  pinMode(BTN_ANOMALY, INPUT_PULLUP);
  pinMode(LEAK_SWITCH, INPUT);

  // FLOW SENSOR
  pinMode(FLOW_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), countFlowPulse, RISING);

  valveClose();

  // OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    Serial.println("OLED initialization failed!");

  // RFID
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, RFID_SS);
  rfid.PCD_Init();

  // WIFI + MQTT (connection finishes in the background)
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
  lastWifiTry = millis();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onCloudMessage);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);       // Wokwi's network is a bit slower than real WiFi
  mqtt.setSocketTimeout(10);

  showHome();

  Serial.println();
  Serial.println("======================================");
  Serial.println("       AQUAALLOT SMART WATER  v3");
  Serial.println(" RFID + WALLET + IoT + ANOMALY CHECK");
  Serial.println("======================================");
  Serial.println("Cards: 01:02:03:04 Rohith | 11:22:33:44 Deepankishor");
  Serial.println("       55:66:77:88 Sanjay | AA:BB:CC:DD unknown");
  Serial.println("Tip: type a card UID here to tap it.");
  Serial.print("MQTT topic: ");
  Serial.println(topic("up"));
  Serial.println();
  Serial.println("System Ready - waiting for RFID...");
}


// =====================================================
//                       MAIN LOOP
// =====================================================

void loop() {
  keepCloudConnected();
  checkSerialInput();
  checkForLeak();

  switch (state) {

    case WAIT_CARD: {
      checkRFID();
      // redraw the home screen only when the cloud status line changes
      static int shownCloudStatus = -1;
      int cloudStatus = cloudOnline() ? 2 : (WiFi.status() == WL_CONNECTED ? 1 : 0);
      if (cloudStatus != shownCloudStatus) {
        shownCloudStatus = cloudStatus;
        showHome();
      }
      break;
    }

    case CHECKING_CARD:
    case CREATING_ORDER:
      if (timedOut(REPLY_TIMEOUT_MS))
        showNotice("NO SERVER REPLY", "Is the backend", "running? (npm run dev)");
      break;

    case CHOOSE_QUANTITY:
      handleQuantity();
      break;

    case WAIT_PAYMENT:
      handlePayment();
      break;

    case CONFIRMING_PAYMENT:
      if (timedOut(REPLY_TIMEOUT_MS)) {
        paymentNote = "No reply, try again";
        setState(WAIT_PAYMENT);
        showPayment();
      }
      break;

    case DISPENSING:
      handleDispensing();
      break;

    case COMPLETE:
      if (timedOut(DONE_SCREEN_MS) || pressedButton(BTN_PAY))
        resetToHome();
      break;

    case ALERT:
      if (pressedButton(BTN_PAY)) {
        Serial.println("[ALERT] Alarm acknowledged");
        sendEvent("ack");
        resetToHome();
      }
      break;

    case NOTICE:
      if (timedOut(NOTICE_SCREEN_MS))
        resetToHome();
      break;
  }
}
