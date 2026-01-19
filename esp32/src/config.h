// ============================================
// JARVIS ESP32-S3 Configuration
// ============================================

#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// WiFi Configuration
// ============================================
#define WIFI_SSID "vivo Y22"
#define WIFI_PASSWORD "88888888"

// Use WiFiManager for setup portal
#define USE_WIFI_MANAGER true
#define WIFI_MANAGER_AP_NAME "JARVIS-Setup"
#define WIFI_MANAGER_AP_PASSWORD "jarvis123"

// ============================================
// JARVIS Server Configuration
// ============================================
// For Hugging Face Spaces:
// #define JARVIS_SERVER "https://YOUR-USERNAME-jarvis-api.hf.space"
// For Railway:
// #define JARVIS_SERVER "https://your-app.up.railway.app"
// For local testing:
// #define JARVIS_SERVER "http://192.168.1.100:8000"

#define JARVIS_SERVER "https://mainhushivam-jarvis-v1-2.hf.space"
#define JARVIS_WS_SERVER "wss://mainhushivam-jarvis-v1-2.hf.space/ws/esp32"

// API endpoints
#define API_CHAT "/api/chat"
#define API_DEVICES_STATUS "/api/devices/status"
#define API_DEVICES_CONTROL "/api/devices/control"
#define API_DEVICES_SENSORS "/api/devices/sensors"
#define API_DEVICES_COMMANDS "/api/devices/commands"
#define API_HEALTH "/health"

// ============================================
// Pin Configuration - ESP32-S3
// ============================================

// Sensors
#define DHT_PIN 4                  // DHT22 Temperature/Humidity
#define DHT_TYPE DHT22
#define PIR_PIN 5                  // Motion sensor
#define LDR_PIN 6                  // Light sensor (ADC)
#define GAS_PIN 7                  // Gas sensor (ADC)
#define SOUND_PIN 8                // Sound sensor (ADC)

// Relays / Outputs
#define RELAY_1_PIN 9              // Light 1
#define RELAY_2_PIN 10             // Light 2
#define RELAY_3_PIN 11             // Fan
#define RELAY_4_PIN 12             // AC
#define RELAY_5_PIN 13             // Spare
#define RELAY_6_PIN 14             // Spare

// Servo
#define SERVO_1_PIN 15             // Curtain/Door servo
#define SERVO_2_PIN 16             // Spare servo

// Status LEDs
#define LED_STATUS_PIN 2           // Built-in LED
#define LED_WIFI_PIN 17            // WiFi status
#define LED_SERVER_PIN 18          // Server connection

// Buzzer
#define BUZZER_PIN 19

// Display (I2C)
#define DISPLAY_SDA 21
#define DISPLAY_SCL 22
#define DISPLAY_ADDRESS 0x3C
#define DISPLAY_WIDTH 128
#define DISPLAY_HEIGHT 64

// Audio (I2S) - Optional
#define I2S_BCLK 25
#define I2S_LRC 26
#define I2S_DOUT 27

// Touch Buttons - Optional
#define TOUCH_1_PIN 32
#define TOUCH_2_PIN 33

// ============================================
// Timing Configuration
// ============================================
#define SENSOR_READ_INTERVAL 5000      // Read sensors every 5 seconds
#define SERVER_SYNC_INTERVAL 10000     // Sync with server every 10 seconds
#define COMMAND_CHECK_INTERVAL 2000    // Check for commands every 2 seconds
#define DISPLAY_UPDATE_INTERVAL 1000   // Update display every second
#define HEARTBEAT_INTERVAL 30000       // Heartbeat every 30 seconds
#define WIFI_CHECK_INTERVAL 60000      // Check WiFi every 60 seconds

// ============================================
// Device Configuration
// ============================================
#define DEVICE_ID "esp32_main"
#define DEVICE_NAME "JARVIS IoT Hub"
#define FIRMWARE_VERSION "2.0.0"

// Relay active state (LOW or HIGH depending on relay module)
#define RELAY_ACTIVE LOW
#define RELAY_INACTIVE HIGH

// ============================================
// Alert Thresholds
// ============================================
#define TEMP_HIGH_ALERT 35.0
#define TEMP_LOW_ALERT 15.0
#define HUMIDITY_HIGH_ALERT 80
#define HUMIDITY_LOW_ALERT 20
#define GAS_ALERT_LEVEL 500
#define LIGHT_LOW_LEVEL 100

// ============================================
// Debug Configuration
// ============================================
#define DEBUG_SERIAL true
#define DEBUG_LEVEL 2  // 0=None, 1=Error, 2=Info, 3=Verbose

#if DEBUG_SERIAL
    #define DEBUG_PRINT(x) Serial.print(x)
    #define DEBUG_PRINTLN(x) Serial.println(x)
    #define DEBUG_PRINTF(format, ...) Serial.printf(format, ##__VA_ARGS__)
#else
    #define DEBUG_PRINT(x)
    #define DEBUG_PRINTLN(x)
    #define DEBUG_PRINTF(format, ...)
#endif

#endif // CONFIG_H