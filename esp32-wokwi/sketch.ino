#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
//                 AQUAALLOT
// RFID + PAYMENT + SMART DISPENSING + FLOW MONITORING
// =====================================================

// ---------------- PIN DEFINITIONS ----------------

#define RFID_SS       5
#define RFID_RST      27
#define SPI_SCK       18
#define SPI_MISO      19
#define SPI_MOSI      23

#define OLED_SDA      21
#define OLED_SCL      22

#define RELAY_PIN     26
#define FLOW_PIN      25
#define BUZZER_PIN    14

#define STATUS_LED     2
#define VALVE_LED      4
#define ANOMALY_LED   12

#define BTN_1L        32
#define BTN_2L        33
#define BTN_5L        16
#define BTN_PAY       17
#define BTN_ANOMALY   13

// ---------------- OLED ----------------

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  -1
);

// ---------------- RFID ----------------

MFRC522 rfid(RFID_SS, RFID_RST);

// ---------------- FLOW SENSOR ----------------

volatile unsigned long flowPulses = 0;

const float PULSES_PER_LITER = 450.0;

// ---------------- SYSTEM STATES ----------------

enum SystemState {

  WAIT_RFID,
  AUTHENTICATED,
  WAIT_PAYMENT,
  DISPENSING,
  COMPLETE,
  ALERT
};

SystemState state = WAIT_RFID;

// ---------------- VARIABLES ----------------

String currentUser = "";
String currentUid = "";

float selectedLiters = 0.0;
float amount = 0.0;

float dispensedLiters = 0.0;
float flowLpm = 0.0;

bool paymentVerified = false;

unsigned long transactionNo = 1001;

unsigned long lastDisplay = 0;
unsigned long lastFlowSample = 0;
unsigned long lastPulseSnapshot = 0;


// =====================================================
//                    RFID FUNCTIONS
// =====================================================

String uidToString() {

  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {

    if (i)
      uid += ":";

    if (rfid.uid.uidByte[i] < 0x10)
      uid += "0";

    uid += String(
      rfid.uid.uidByte[i],
      HEX
    );
  }

  uid.toUpperCase();

  return uid;
}


String identifyUser(String uid) {

  if (uid == "01:02:03:04")
    return "Rohith";

  if (uid == "11:22:33:44")
    return "Deepankishor";

  if (uid == "55:66:77:88")
    return "Sanjay";

  return "";
}


// =====================================================
//                FLOW SENSOR INTERRUPT
// =====================================================

void IRAM_ATTR countFlowPulse() {

  flowPulses++;
}


// =====================================================
//                     OLED FUNCTIONS
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

  display.println("RFID Water Station");

  display.println("Scan your card...");

  display.display();
}


void showQuantityMenu() {

  oledClear();

  display.println("USER VERIFIED");

  display.print("User: ");

  display.println(currentUser);

  display.println();

  display.println("Select quantity:");

  display.println("1L   [1]");

  display.println("2L   [2]");

  display.println("5L   [5]");

  display.display();
}


void showPayment() {

  oledClear();

  display.println("PAYMENT REQUIRED");

  display.println("----------------");

  display.print("User: ");

  display.println(currentUser);

  display.print("Water: ");

  display.print(selectedLiters, 1);

  display.println(" L");

  display.print("Amount: Rs ");

  display.println(amount, 0);

  display.println();

  display.println("Press PAY button");

  display.display();
}


void showDispensing() {

  float remaining =
    selectedLiters - dispensedLiters;

  if (remaining < 0)
    remaining = 0;

  oledClear();

  display.println("DISPENSING...");

  display.println("----------------");

  display.print("User: ");

  display.println(currentUser);

  display.print("Target : ");

  display.print(selectedLiters, 2);

  display.println(" L");

  display.print("Used   : ");

  display.print(dispensedLiters, 2);

  display.println(" L");

  display.print("Remain : ");

  display.print(remaining, 2);

  display.println(" L");

  display.print("Flow   : ");

  display.print(flowLpm, 1);

  display.println(" L/min");

  display.display();
}


void showComplete() {

  oledClear();

  display.println("DISPENSING DONE");

  display.println("----------------");

  display.print("User: ");

  display.println(currentUser);

  display.print("Delivered: ");

  display.print(dispensedLiters, 2);

  display.println(" L");

  display.println("Transaction saved");

  display.print("TXN: AA");

  display.println(transactionNo - 1);

  display.display();
}


void showAnomaly() {

  oledClear();

  display.println("!! ANOMALY !!");

  display.println("----------------");

  display.println("Abnormal usage");

  display.println("detected by AI");

  display.println();

  display.println("VALVE CLOSED");

  display.println("ADMIN ALERT");

  display.println("TRIGGERED");

  display.display();
}


// =====================================================
//                  VALVE CONTROL
// =====================================================

void valveOpen() {

  digitalWrite(
    RELAY_PIN,
    HIGH
  );

  digitalWrite(
    VALVE_LED,
    HIGH
  );

  Serial.println(
    "[ACTUATOR] Solenoid valve OPEN"
  );
}


void valveClose() {

  digitalWrite(
    RELAY_PIN,
    LOW
  );

  digitalWrite(
    VALVE_LED,
    LOW
  );

  Serial.println(
    "[ACTUATOR] Solenoid valve CLOSED"
  );
}


// =====================================================
//                      BUZZER
// =====================================================

void beep(int durationMs = 100) {

  digitalWrite(
    BUZZER_PIN,
    HIGH
  );

  delay(durationMs);

  digitalWrite(
    BUZZER_PIN,
    LOW
  );
}


// =====================================================
//                  TRANSACTION LOG
// =====================================================

void logTransaction() {

  Serial.println();

  Serial.println(
    "========== TRANSACTION =========="
  );

  Serial.print(
    "Transaction ID : AA"
  );

  Serial.println(
    transactionNo++
  );

  Serial.print(
    "User           : "
  );

  Serial.println(
    currentUser
  );

  Serial.println(
    "Payment status : SUCCESS"
  );

  Serial.print(
    "Amount paid    : Rs "
  );

  Serial.println(
    amount,
    0
  );

  Serial.print(
    "Quantity       : "
  );

  Serial.print(
    dispensedLiters,
    2
  );

  Serial.println(
    " L"
  );

  Serial.print(
    "Flow rate      : "
  );

  Serial.print(
    flowLpm,
    1
  );

  Serial.println(
    " L/min"
  );

  Serial.println(
    "Database       : usage record created"
  );

  Serial.println(
    "Dashboard      : telemetry updated"
  );

  Serial.println(
    "================================="
  );

  Serial.println();
}


// =====================================================
//                     RESET SYSTEM
// =====================================================

void resetToHome() {

  valveClose();

  paymentVerified = false;

  selectedLiters = 0;

  amount = 0;

  dispensedLiters = 0;

  flowPulses = 0;

  flowLpm = 0;

  currentUser = "";

  currentUid = "";

  state = WAIT_RFID;

  digitalWrite(
    ANOMALY_LED,
    LOW
  );

  showHome();

  Serial.println(
    "System Ready - waiting for RFID..."
  );
}


// =====================================================
//                 BUTTON DEBOUNCE
// =====================================================

bool pressed(int pin) {

  static unsigned long
    lastPress[40] = {0};

  if (
    digitalRead(pin) == LOW &&
    millis() - lastPress[pin] > 250
  ) {

    lastPress[pin] = millis();

    return true;
  }

  return false;
}


// =====================================================
//                       SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(300);

  // OUTPUTS

  pinMode(
    RELAY_PIN,
    OUTPUT
  );

  pinMode(
    BUZZER_PIN,
    OUTPUT
  );

  pinMode(
    STATUS_LED,
    OUTPUT
  );

  pinMode(
    VALVE_LED,
    OUTPUT
  );

  pinMode(
    ANOMALY_LED,
    OUTPUT
  );


  // BUTTONS

  pinMode(
    BTN_1L,
    INPUT_PULLUP
  );

  pinMode(
    BTN_2L,
    INPUT_PULLUP
  );

  pinMode(
    BTN_5L,
    INPUT_PULLUP
  );

  pinMode(
    BTN_PAY,
    INPUT_PULLUP
  );

  pinMode(
    BTN_ANOMALY,
    INPUT_PULLUP
  );


  // FLOW SENSOR

  pinMode(
    FLOW_PIN,
    INPUT
  );

  attachInterrupt(
    digitalPinToInterrupt(FLOW_PIN),
    countFlowPulse,
    RISING
  );


  // STATUS

  digitalWrite(
    STATUS_LED,
    HIGH
  );

  valveClose();


  // OLED

  Wire.begin(
    OLED_SDA,
    OLED_SCL
  );

  if (
    !display.begin(
      SSD1306_SWITCHCAPVCC,
      0x3C
    )
  ) {
    Serial.println(
      "OLED 0x3C failed, trying 0x3D..."
    );
    display.begin(
      SSD1306_SWITCHCAPVCC,
      0x3D
    );
  }

  display.setContrast(255);
  showHome();


  // RFID

  SPI.begin(
    SPI_SCK,
    SPI_MISO,
    SPI_MOSI,
    RFID_SS
  );

  rfid.PCD_Init();


  // SERIAL INFORMATION

  Serial.println();

  Serial.println(
    "======================================"
  );

  Serial.println(
    "       AQUAALLOT SMART WATER"
  );

  Serial.println(
    " RFID + PAYMENT + IoT + AI PROTOTYPE"
  );

  Serial.println(
    "======================================"
  );

  Serial.println(
    "Authorized cards:"
  );

  Serial.println(
    "01:02:03:04 -> Rohith"
  );

  Serial.println(
    "11:22:33:44 -> Deepankishor"
  );

  Serial.println(
    "55:66:77:88 -> Sanjay"
  );

  Serial.println();

  Serial.println(
    "System Ready - waiting for RFID..."
  );
}


// =====================================================
//                    RFID CHECK
// =====================================================

void checkRFID() {

  if (
    !rfid.PICC_IsNewCardPresent()
  )
    return;

  if (
    !rfid.PICC_ReadCardSerial()
  )
    return;


  String uid =
    uidToString();

  String user =
    identifyUser(uid);


  Serial.print(
    "[RFID] UID: "
  );

  Serial.println(uid);


  // UNAUTHORIZED

  if (
    user.length() == 0
  ) {

    Serial.println(
      "[SECURITY] ACCESS DENIED"
    );

    oledClear();

    display.println(
      "ACCESS DENIED"
    );

    display.println();

    display.println(
      "Unauthorized card"
    );

    display.println(
      "Try again"
    );

    display.display();

    beep(300);

    delay(1200);

    showHome();
  }


  // AUTHORIZED

  else {

    currentUser = user;

    currentUid = uid;

    state =
      AUTHENTICATED;


    Serial.print(
      "[RFID] AUTHENTICATED: "
    );

    Serial.println(
      currentUser
    );


    beep(100);

    showQuantityMenu();
  }


  rfid.PICC_HaltA();

  rfid.PCD_StopCrypto1();
}


// =====================================================
//                 QUANTITY SELECTION
// =====================================================

void handleQuantity() {

  if (
    pressed(BTN_1L)
  ) {

    selectedLiters = 1.0;

    amount = 5.0;
  }

  else if (
    pressed(BTN_2L)
  ) {

    selectedLiters = 2.0;

    amount = 10.0;
  }

  else if (
    pressed(BTN_5L)
  ) {

    selectedLiters = 5.0;

    amount = 25.0;
  }

  else {

    return;
  }


  state =
    WAIT_PAYMENT;


  Serial.println();

  Serial.println(
    "[ORDER] Quantity selected"
  );

  Serial.print(
    "[ORDER] "
  );

  Serial.print(
    selectedLiters,
    1
  );

  Serial.println(
    " L"
  );

  Serial.print(
    "[PAYMENT] Amount: Rs "
  );

  Serial.println(
    amount,
    0
  );


  beep(80);

  showPayment();
}


// =====================================================
//                     PAYMENT
// =====================================================

void handlePayment() {

  if (
    !pressed(BTN_PAY)
  )
    return;


  paymentVerified =
    true;


  Serial.println(
    "[PAYMENT] SUCCESS"
  );

  Serial.println(
    "[PAYMENT] Razorpay confirmation simulated"
  );

  Serial.println(
    "[ESP32] Payment confirmation received"
  );


  beep(150);


  flowPulses = 0;

  dispensedLiters = 0;

  flowLpm = 0;

  lastFlowSample =
    millis();

  lastPulseSnapshot = 0;


  state =
    DISPENSING;


  valveOpen();

  showDispensing();
}


// =====================================================
//              FLOW + DISPENSING
// =====================================================

void handleDispensing() {

  unsigned long pulsesCopy;


  noInterrupts();

  pulsesCopy =
    flowPulses;

  interrupts();


  // Convert pulses → liters

  dispensedLiters =
    pulsesCopy /
    PULSES_PER_LITER;


  unsigned long now =
    millis();


  // Flow rate every second

  if (
    now - lastFlowSample >= 1000
  ) {

    unsigned long pulseDelta =
      pulsesCopy -
      lastPulseSnapshot;


    flowLpm =
      (
        pulseDelta /
        PULSES_PER_LITER
      ) * 60.0;


    lastPulseSnapshot =
      pulsesCopy;

    lastFlowSample =
      now;
  }


  // ANOMALY TEST

  if (
    pressed(BTN_ANOMALY)
  ) {

    state =
      ALERT;


    valveClose();


    digitalWrite(
      ANOMALY_LED,
      HIGH
    );


    Serial.println();

    Serial.println(
      "[AI/ANN] ANOMALY DETECTED"
    );

    Serial.println(
      "[ALERT] Abnormal water usage"
    );

    Serial.println(
      "[ALERT] Valve shutdown initiated"
    );

    Serial.println(
      "[ALERT] Administrator email simulated"
    );


    beep(500);

    showAnomaly();

    return;
  }


  // OLED UPDATE

  if (
    now - lastDisplay >= 200
  ) {

    lastDisplay =
      now;

    showDispensing();
  }


  // TARGET REACHED

  if (
    dispensedLiters >= selectedLiters
  ) {

    valveClose();


    dispensedLiters =
      selectedLiters;


    logTransaction();


    state =
      COMPLETE;


    showComplete();


    beep(200);


    Serial.println(
      "[SYSTEM] Dispensing completed."
    );
  }
}


// =====================================================
//                       MAIN LOOP
// =====================================================

void loop() {

  switch (state) {

    case WAIT_RFID:

      checkRFID();

      break;


    case AUTHENTICATED:

      handleQuantity();

      break;


    case WAIT_PAYMENT:

      handlePayment();

      break;


    case DISPENSING:

      handleDispensing();

      break;


    case COMPLETE:

      if (
        pressed(BTN_1L) ||
        pressed(BTN_2L) ||
        pressed(BTN_5L)
      ) {

        resetToHome();
      }

      break;


    case ALERT:

      if (
        pressed(BTN_PAY)
      ) {

        Serial.println(
          "[ALERT] Alarm acknowledged"
        );

        resetToHome();
      }

      break;
  }
}
