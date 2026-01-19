// ============================================
// 🤖 JARVIS ESP32-S3 Main Controller
// ============================================
// Features:
// - WiFi connectivity with auto-reconnect
// - Sensor reading (Temp, Humidity, Motion, Light, Gas)
// - Device control (Relays, Servos)
// - JARVIS server communication
// - OLED display status
// - Audio feedback
// - OTA updates
// ============================================

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <Preferences.h>

#include "config.h"

// ============================================
// OBJECTS
// ============================================

// Sensors
DHT dht(DHT_PIN, DHT_TYPE);

// Display
Adafruit_SSD1306 display(DISPLAY_WIDTH, DISPLAY_HEIGHT, &Wire, -1);

// Servos
Servo servo1;
Servo servo2;

// WebSocket
WebSocketsClient webSocket;

// Preferences (persistent storage)
Preferences preferences;

// HTTP Client
HTTPClient http;

// ============================================
// STATE VARIABLES
// ============================================

// Connection status
bool wifiConnected = false;
bool serverConnected = false;
bool wsConnected = false;

// Sensor data
struct SensorData {
    float temperature = 0;
    float humidity = 0;
    int lightLevel = 0;
    int gasLevel = 0;
    bool motionDetected = false;
    int soundLevel = 0;
} sensors;

// Device states
struct DeviceStates {
    bool relay1 = false;  // Light 1
    bool relay2 = false;  // Light 2
    bool relay3 = false;  // Fan
    bool relay4 = false;  // AC
    bool relay5 = false;  // Spare
    bool relay6 = false;  // Spare
    int servo1Pos = 0;    // Curtain position
    int servo2Pos = 0;    // Spare servo
} devices;

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastServerSync = 0;
unsigned long lastCommandCheck = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastWifiCheck = 0;

// Stats
unsigned long bootTime = 0;
unsigned long commandsReceived = 0;
unsigned long errorsCount = 0;

// ============================================
// FUNCTION PROTOTYPES
// ============================================

void setupWiFi();
void setupDisplay();
void setupSensors();
void setupRelays();
void setupServos();
void setupWebSocket();

void readSensors();
void sendSensorData();
void checkCommands();
void processCommand(JsonObject& cmd);
void executeDeviceCommand(String deviceId, String action, int value);

void updateDisplay();
void updateStatusLEDs();
void beep(int times, int duration = 100);

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
void handleWebSocketMessage(uint8_t* payload, size_t length);

String getDeviceStatesJson();
String getSensorDataJson();

// ============================================
// SETUP
// ============================================

void setup() {
    // Initialize Serial
    Serial.begin(115200);
    delay(1000);
    
    DEBUG_PRINTLN("\n");
    DEBUG_PRINTLN("╔════════════════════════════════════════╗");
    DEBUG_PRINTLN("║   🤖 JARVIS ESP32-S3 Starting...       ║");
    DEBUG_PRINTLN("╚════════════════════════════════════════╝");
    DEBUG_PRINTLN("");
    
    bootTime = millis();
    
    // Initialize preferences
    preferences.begin("jarvis", false);
    
    // Setup components
    setupDisplay();
    displayMessage("JARVIS", "Initializing...");
    
    setupRelays();
    setupServos();
    setupSensors();
    
    // Connect WiFi
    setupWiFi();
    
    if (wifiConnected) {
        // Setup WebSocket
        setupWebSocket();
        
        // Initial server sync
        sendSensorData();
        checkCommands();
    }
    
    // Ready
    displayMessage("JARVIS", "Online!");
    beep(2);
    
    DEBUG_PRINTLN("");
    DEBUG_PRINTLN("╔════════════════════════════════════════╗");
    DEBUG_PRINTLN("║   ✅ JARVIS ESP32-S3 Ready!            ║");
    DEBUG_PRINTLN("╚════════════════════════════════════════╝");
    DEBUG_PRINTLN("");
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
    unsigned long currentTime = millis();
    
    // Handle WebSocket
    if (wifiConnected) {
        webSocket.loop();
    }
    
    // Check WiFi connection
    if (currentTime - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
        if (WiFi.status() != WL_CONNECTED) {
            wifiConnected = false;
            serverConnected = false;
            DEBUG_PRINTLN("❌ WiFi disconnected! Reconnecting...");
            setupWiFi();
        }
        lastWifiCheck = currentTime;
    }
    
    // Read sensors
    if (currentTime - lastSensorRead >= SENSOR_READ_INTERVAL) {
        readSensors();
        lastSensorRead = currentTime;
    }
    
    // Send sensor data to server
    if (currentTime - lastServerSync >= SERVER_SYNC_INTERVAL) {
        if (wifiConnected) {
            sendSensorData();
        }
        lastServerSync = currentTime;
    }
    
    // Check for commands from server
    if (currentTime - lastCommandCheck >= COMMAND_CHECK_INTERVAL) {
        if (wifiConnected) {
            checkCommands();
        }
        lastCommandCheck = currentTime;
    }
    
    // Update display
    if (currentTime - lastDisplayUpdate >= DISPLAY_UPDATE_INTERVAL) {
        updateDisplay();
        lastDisplayUpdate = currentTime;
    }
    
    // Heartbeat
    if (currentTime - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        if (wifiConnected && wsConnected) {
            webSocket.sendPing();
        }
        lastHeartbeat = currentTime;
    }
    
    // Update status LEDs
    updateStatusLEDs();
    
    // Handle serial commands (for testing)
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        handleSerialCommand(cmd);
    }
    
    // Small delay
    delay(10);
}

// ============================================
// SETUP FUNCTIONS
// ============================================

void setupWiFi() {
    DEBUG_PRINTLN("📡 Connecting to WiFi...");
    displayMessage("WiFi", "Connecting...");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        DEBUG_PRINT(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        DEBUG_PRINTLN("");
        DEBUG_PRINTLN("✅ WiFi Connected!");
        DEBUG_PRINTF("   IP: %s\n", WiFi.localIP().toString().c_str());
        DEBUG_PRINTF("   RSSI: %d dBm\n", WiFi.RSSI());
        
        displayMessage("WiFi OK", WiFi.localIP().toString().c_str());
        beep(1);
    } else {
        wifiConnected = false;
        DEBUG_PRINTLN("");
        DEBUG_PRINTLN("❌ WiFi Connection Failed!");
        displayMessage("WiFi", "FAILED!");
        beep(3, 200);
    }
}

void setupDisplay() {
    DEBUG_PRINTLN("📺 Initializing display...");
    
    Wire.begin(DISPLAY_SDA, DISPLAY_SCL);
    
    if (!display.begin(SSD1306_SWITCHCAPVCC, DISPLAY_ADDRESS)) {
        DEBUG_PRINTLN("❌ Display initialization failed!");
        return;
    }
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.display();
    
    DEBUG_PRINTLN("✅ Display ready");
}

void setupSensors() {
    DEBUG_PRINTLN("🌡️ Initializing sensors...");
    
    // DHT sensor
    dht.begin();
    
    // Motion sensor
    pinMode(PIR_PIN, INPUT);
    
    // Analog sensors
    analogReadResolution(12);  // 12-bit ADC
    
    DEBUG_PRINTLN("✅ Sensors ready");
}

void setupRelays() {
    DEBUG_PRINTLN("🔌 Initializing relays...");
    
    pinMode(RELAY_1_PIN, OUTPUT);
    pinMode(RELAY_2_PIN, OUTPUT);
    pinMode(RELAY_3_PIN, OUTPUT);
    pinMode(RELAY_4_PIN, OUTPUT);
    pinMode(RELAY_5_PIN, OUTPUT);
    pinMode(RELAY_6_PIN, OUTPUT);
    
    // Set all relays to OFF
    digitalWrite(RELAY_1_PIN, RELAY_INACTIVE);
    digitalWrite(RELAY_2_PIN, RELAY_INACTIVE);
    digitalWrite(RELAY_3_PIN, RELAY_INACTIVE);
    digitalWrite(RELAY_4_PIN, RELAY_INACTIVE);
    digitalWrite(RELAY_5_PIN, RELAY_INACTIVE);
    digitalWrite(RELAY_6_PIN, RELAY_INACTIVE);
    
    // Status LEDs
    pinMode(LED_STATUS_PIN, OUTPUT);
    pinMode(LED_WIFI_PIN, OUTPUT);
    pinMode(LED_SERVER_PIN, OUTPUT);
    
    // Buzzer
    pinMode(BUZZER_PIN, OUTPUT);
    
    DEBUG_PRINTLN("✅ Relays ready");
}

void setupServos() {
    DEBUG_PRINTLN("⚙️ Initializing servos...");
    
    servo1.attach(SERVO_1_PIN);
    servo2.attach(SERVO_2_PIN);
    
    servo1.write(0);
    servo2.write(0);
    
    DEBUG_PRINTLN("✅ Servos ready");
}

void setupWebSocket() {
    DEBUG_PRINTLN("🔗 Setting up WebSocket...");
    
    // Parse WebSocket URL
    String wsUrl = String(JARVIS_WS_SERVER);
    
    // Remove protocol prefix
    if (wsUrl.startsWith("wss://")) {
        wsUrl = wsUrl.substring(6);
        webSocket.beginSSL(wsUrl.c_str(), 443, "/ws/esp32");
    } else if (wsUrl.startsWith("ws://")) {
        wsUrl = wsUrl.substring(5);
        // Parse host and port
        int colonIndex = wsUrl.indexOf(':');
        if (colonIndex > 0) {
            String host = wsUrl.substring(0, colonIndex);
            int port = wsUrl.substring(colonIndex + 1).toInt();
            webSocket.begin(host.c_str(), port, "/ws/esp32");
        } else {
            webSocket.begin(wsUrl.c_str(), 80, "/ws/esp32");
        }
    }
    
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    DEBUG_PRINTLN("✅ WebSocket setup complete");
}

// ============================================
// SENSOR FUNCTIONS
// ============================================

void readSensors() {
    // Read DHT sensor
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    
    if (!isnan(temp) && !isnan(hum)) {
        sensors.temperature = temp;
        sensors.humidity = hum;
    }
    
    // Read analog sensors
    sensors.lightLevel = analogRead(LDR_PIN);
    sensors.gasLevel = analogRead(GAS_PIN);
    sensors.soundLevel = analogRead(SOUND_PIN);
    
    // Read motion sensor
    sensors.motionDetected = digitalRead(PIR_PIN) == HIGH;
    
    // Check for alerts
    checkAlerts();
    
    // Debug output
    DEBUG_PRINTF("📊 Sensors: Temp=%.1f°C, Hum=%.1f%%, Light=%d, Gas=%d, Motion=%s\n",
                sensors.temperature, sensors.humidity, sensors.lightLevel,
                sensors.gasLevel, sensors.motionDetected ? "Yes" : "No");
}

void checkAlerts() {
    // Temperature alerts
    if (sensors.temperature > TEMP_HIGH_ALERT) {
        DEBUG_PRINTLN("⚠️ HIGH TEMPERATURE ALERT!");
        beep(3, 50);
    } else if (sensors.temperature < TEMP_LOW_ALERT) {
        DEBUG_PRINTLN("⚠️ LOW TEMPERATURE ALERT!");
        beep(2, 50);
    }
    
    // Gas alert
    if (sensors.gasLevel > GAS_ALERT_LEVEL) {
        DEBUG_PRINTLN("🚨 GAS LEVEL ALERT!");
        beep(5, 100);
    }
}

// ============================================
// SERVER COMMUNICATION
// ============================================

void sendSensorData() {
    if (!wifiConnected) return;
    
    DEBUG_PRINTLN("📤 Sending sensor data...");
    
    // Create JSON payload
    StaticJsonDocument<512> doc;
    doc["temperature"] = sensors.temperature;
    doc["humidity"] = sensors.humidity;
    doc["light_level"] = sensors.lightLevel;
    doc["gas_level"] = sensors.gasLevel;
    doc["motion"] = sensors.motionDetected;
    doc["sound_level"] = sensors.soundLevel;
    
    // Add device states
    JsonObject devs = doc.createNestedObject("devices");
    devs["relay_1"] = devices.relay1;
    devs["relay_2"] = devices.relay2;
    devs["relay_3"] = devices.relay3;
    devs["relay_4"] = devices.relay4;
    devs["servo_1"] = devices.servo1Pos;
    
    String payload;
    serializeJson(doc, payload);
    
    // Send via HTTP
    String url = String(JARVIS_SERVER) + API_DEVICES_SENSORS;
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
        String response = http.getString();
        DEBUG_PRINTLN("✅ Sensor data sent successfully");
        serverConnected = true;
        
        // Check for alerts in response
        StaticJsonDocument<256> responseDoc;
        deserializeJson(responseDoc, response);
        
        JsonArray alerts = responseDoc["alerts"];
        for (JsonObject alert : alerts) {
            String alertType = alert["type"];
            String message = alert["message"];
            DEBUG_PRINTF("⚠️ Alert: %s - %s\n", alertType.c_str(), message.c_str());
        }
    } else {
        DEBUG_PRINTF("❌ Sensor send failed: %d\n", httpCode);
        serverConnected = false;
        errorsCount++;
    }
    
    http.end();
}

void checkCommands() {
    if (!wifiConnected) return;
    
    DEBUG_PRINTLN("📥 Checking for commands...");
    
    String url = String(JARVIS_SERVER) + API_DEVICES_COMMANDS;
    
    http.begin(url);
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
        String response = http.getString();
        
        // Parse commands
        StaticJsonDocument<1024> doc;
        DeserializationError error = deserializeJson(doc, response);
        
        if (!error) {
            JsonArray commands = doc["commands"];
            
            for (JsonObject cmd : commands) {
                processCommand(cmd);
            }
            
            serverConnected = true;
        }
    } else {
        DEBUG_PRINTF("❌ Command check failed: %d\n", httpCode);
        errorsCount++;
    }
    
    http.end();
}

void processCommand(JsonObject& cmd) {
    String deviceId = cmd["device_id"] | "";
    String action = cmd["action"] | "";
    int value = cmd["value"] | 0;
    
    DEBUG_PRINTF("⚡ Command: %s -> %s (value=%d)\n", 
                deviceId.c_str(), action.c_str(), value);
    
    executeDeviceCommand(deviceId, action, value);
    commandsReceived++;
}

// ============================================
// DEVICE CONTROL
// ============================================

void executeDeviceCommand(String deviceId, String action, int value) {
    // Determine relay based on device ID
    int relayPin = -1;
    bool* statePtr = nullptr;
    
    if (deviceId == "light_living" || deviceId == "light_1" || deviceId == "relay_1") {
        relayPin = RELAY_1_PIN;
        statePtr = &devices.relay1;
    } else if (deviceId == "light_bedroom" || deviceId == "light_2" || deviceId == "relay_2") {
        relayPin = RELAY_2_PIN;
        statePtr = &devices.relay2;
    } else if (deviceId == "fan_main" || deviceId == "fan" || deviceId == "relay_3") {
        relayPin = RELAY_3_PIN;
        statePtr = &devices.relay3;
    } else if (deviceId == "ac_main" || deviceId == "ac" || deviceId == "relay_4") {
        relayPin = RELAY_4_PIN;
        statePtr = &devices.relay4;
    } else if (deviceId == "curtain" || deviceId == "servo_1") {
        // Handle servo
        if (action == "open" || action == "on") {
            servo1.write(90);
            devices.servo1Pos = 90;
        } else if (action == "close" || action == "off") {
            servo1.write(0);
            devices.servo1Pos = 0;
        } else if (action == "set" && value >= 0 && value <= 180) {
            servo1.write(value);
            devices.servo1Pos = value;
        }
        
        DEBUG_PRINTF("🚪 Curtain: %d°\n", devices.servo1Pos);
        beep(1);
        return;
    }
    
    // Handle relay commands
    if (relayPin > 0 && statePtr != nullptr) {
        if (action == "on") {
            digitalWrite(relayPin, RELAY_ACTIVE);
            *statePtr = true;
        } else if (action == "off") {
            digitalWrite(relayPin, RELAY_INACTIVE);
            *statePtr = false;
        } else if (action == "toggle") {
            *statePtr = !(*statePtr);
            digitalWrite(relayPin, *statePtr ? RELAY_ACTIVE : RELAY_INACTIVE);
        }
        
        DEBUG_PRINTF("🔌 %s: %s\n", deviceId.c_str(), *statePtr ? "ON" : "OFF");
        beep(1);
    }
}

// ============================================
// WEBSOCKET FUNCTIONS
// ============================================

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            DEBUG_PRINTLN("❌ WebSocket disconnected");
            wsConnected = false;
            break;
            
        case WStype_CONNECTED:
            DEBUG_PRINTLN("✅ WebSocket connected");
            wsConnected = true;
            
            // Send initial status
            webSocket.sendTXT("{\"type\":\"register\",\"device_id\":\"" DEVICE_ID "\"}");
            break;
            
        case WStype_TEXT:
            handleWebSocketMessage(payload, length);
            break;
            
        case WStype_PING:
            DEBUG_PRINTLN("🏓 Ping received");
            break;
            
        case WStype_PONG:
            DEBUG_PRINTLN("🏓 Pong received");
            break;
            
        case WStype_ERROR:
            DEBUG_PRINTLN("❌ WebSocket error");
            errorsCount++;
            break;
    }
}

void handleWebSocketMessage(uint8_t* payload, size_t length) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    
    if (error) {
        DEBUG_PRINTLN("❌ JSON parse error");
        return;
    }
    
    String type = doc["type"] | "";
    
    if (type == "device_control") {
        String device = doc["device"] | "";
        String action = doc["action"] | "";
        int value = doc["value"] | 0;
        
        executeDeviceCommand(device, action, value);
        
        // Send acknowledgment
        StaticJsonDocument<256> response;
        response["type"] = "ack";
        response["device"] = device;
        response["success"] = true;
        
        String responseStr;
        serializeJson(response, responseStr);
        webSocket.sendTXT(responseStr);
        
    } else if (type == "request_status") {
        // Send current status
        StaticJsonDocument<512> status;
        status["type"] = "status";
        status["sensors"] = getSensorDataJson();
        status["devices"] = getDeviceStatesJson();
        
        String statusStr;
        serializeJson(status, statusStr);
        webSocket.sendTXT(statusStr);
        
    } else if (type == "ping") {
        webSocket.sendTXT("{\"type\":\"pong\"}");
    }
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

void displayMessage(const char* line1, const char* line2) {
    display.clearDisplay();
    
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.print(line1);
    
    display.setTextSize(1);
    display.setCursor(0, 25);
    display.print(line2);
    
    display.display();
}

void updateDisplay() {
    display.clearDisplay();
    
    // Header
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.print("JARVIS IoT Hub");
    
    // Status icons
    display.setCursor(100, 0);
    display.print(wifiConnected ? "W" : "-");
    display.print(serverConnected ? "S" : "-");
    display.print(wsConnected ? "C" : "-");
    
    display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
    
    // Sensor data
    display.setCursor(0, 14);
    display.printf("Temp: %.1fC", sensors.temperature);
    
    display.setCursor(70, 14);
    display.printf("Hum: %.0f%%", sensors.humidity);
    
    display.setCursor(0, 24);
    display.printf("Light: %d", sensors.lightLevel);
    
    display.setCursor(70, 24);
    display.printf("Gas: %d", sensors.gasLevel);
    
    // Motion
    display.setCursor(0, 34);
    display.print("Motion: ");
    display.print(sensors.motionDetected ? "YES" : "NO");
    
    // Device states
    display.drawLine(0, 44, 128, 44, SSD1306_WHITE);
    
    display.setCursor(0, 48);
    display.print("L1:");
    display.print(devices.relay1 ? "ON " : "OFF");
    
    display.print(" L2:");
    display.print(devices.relay2 ? "ON " : "OFF");
    
    display.setCursor(0, 56);
    display.print("Fan:");
    display.print(devices.relay3 ? "ON " : "OFF");
    
    display.print(" AC:");
    display.print(devices.relay4 ? "ON " : "OFF");
    
    display.display();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

void updateStatusLEDs() {
    // WiFi LED
    if (!wifiConnected) {
        // Fast blink - no WiFi
        digitalWrite(LED_WIFI_PIN, (millis() / 200) % 2);
    } else {
        digitalWrite(LED_WIFI_PIN, HIGH);
    }
    
    // Server LED
    if (!serverConnected) {
        // Slow blink - no server
        digitalWrite(LED_SERVER_PIN, (millis() / 1000) % 2);
    } else if (wsConnected) {
        digitalWrite(LED_SERVER_PIN, HIGH);
    } else {
        digitalWrite(LED_SERVER_PIN, (millis() / 500) % 2);
    }
    
    // Status LED - heartbeat
    digitalWrite(LED_STATUS_PIN, (millis() / 1000) % 2);
}

void beep(int times, int duration) {
    for (int i = 0; i < times; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(duration);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < times - 1) delay(duration);
    }
}

String getSensorDataJson() {
    StaticJsonDocument<256> doc;
    doc["temperature"] = sensors.temperature;
    doc["humidity"] = sensors.humidity;
    doc["light_level"] = sensors.lightLevel;
    doc["gas_level"] = sensors.gasLevel;
    doc["motion"] = sensors.motionDetected;
    
    String result;
    serializeJson(doc, result);
    return result;
}

String getDeviceStatesJson() {
    StaticJsonDocument<256> doc;
    doc["relay_1"] = devices.relay1;
    doc["relay_2"] = devices.relay2;
    doc["relay_3"] = devices.relay3;
    doc["relay_4"] = devices.relay4;
    doc["servo_1"] = devices.servo1Pos;
    
    String result;
    serializeJson(doc, result);
    return result;
}

void handleSerialCommand(String cmd) {
    cmd.toLowerCase();
    
    if (cmd == "status") {
        Serial.println("\n📊 JARVIS ESP32 Status:");
        Serial.printf("  WiFi: %s (RSSI: %d dBm)\n", 
                     wifiConnected ? "Connected" : "Disconnected", WiFi.RSSI());
        Serial.printf("  Server: %s\n", serverConnected ? "Connected" : "Disconnected");
        Serial.printf("  WebSocket: %s\n", wsConnected ? "Connected" : "Disconnected");
        Serial.printf("  Uptime: %lu seconds\n", (millis() - bootTime) / 1000);
        Serial.printf("  Commands: %lu, Errors: %lu\n", commandsReceived, errorsCount);
        Serial.println("\n📊 Sensors:");
        Serial.printf("  Temperature: %.1f°C\n", sensors.temperature);
        Serial.printf("  Humidity: %.1f%%\n", sensors.humidity);
        Serial.printf("  Light: %d\n", sensors.lightLevel);
        Serial.printf("  Gas: %d\n", sensors.gasLevel);
        Serial.printf("  Motion: %s\n", sensors.motionDetected ? "Yes" : "No");
        Serial.println("\n📊 Devices:");
        Serial.printf("  Relay 1 (Light): %s\n", devices.relay1 ? "ON" : "OFF");
        Serial.printf("  Relay 2 (Light): %s\n", devices.relay2 ? "ON" : "OFF");
        Serial.printf("  Relay 3 (Fan): %s\n", devices.relay3 ? "ON" : "OFF");
        Serial.printf("  Relay 4 (AC): %s\n", devices.relay4 ? "ON" : "OFF");
        Serial.printf("  Servo 1: %d°\n", devices.servo1Pos);
        
    } else if (cmd == "light1 on") {
        executeDeviceCommand("relay_1", "on", 0);
    } else if (cmd == "light1 off") {
        executeDeviceCommand("relay_1", "off", 0);
    } else if (cmd == "light2 on") {
        executeDeviceCommand("relay_2", "on", 0);
    } else if (cmd == "light2 off") {
        executeDeviceCommand("relay_2", "off", 0);
    } else if (cmd == "fan on") {
        executeDeviceCommand("relay_3", "on", 0);
    } else if (cmd == "fan off") {
        executeDeviceCommand("relay_3", "off", 0);
    } else if (cmd == "ac on") {
        executeDeviceCommand("relay_4", "on", 0);
    } else if (cmd == "ac off") {
        executeDeviceCommand("relay_4", "off", 0);
    } else if (cmd == "curtain open") {
        executeDeviceCommand("servo_1", "open", 0);
    } else if (cmd == "curtain close") {
        executeDeviceCommand("servo_1", "close", 0);
    } else if (cmd == "reboot") {
        Serial.println("🔄 Rebooting...");
        ESP.restart();
    } else if (cmd == "help") {
        Serial.println("\n📋 Available Commands:");
        Serial.println("  status       - Show system status");
        Serial.println("  light1 on/off");
        Serial.println("  light2 on/off");
        Serial.println("  fan on/off");
        Serial.println("  ac on/off");
        Serial.println("  curtain open/close");
        Serial.println("  reboot       - Restart ESP32");
        Serial.println("  help         - Show this help");
    }
}