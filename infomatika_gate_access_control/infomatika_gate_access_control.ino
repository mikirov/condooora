#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <Preferences.h>
#include <Wiegand.h>
#include <ArduinoJson.h>

// Constants and Configurable Variables
char WIFI_SSID[50] = "A1_59E8";
char WIFI_PASSWORD[50] = "13415327";
char SERVER_BASE_URL[100] = "http://192.168.0.2:3002";
char NTP_SERVER[50] = "pool.ntp.org";
long POLLING_INTERVAL = 3000;
int QUEUE_SIZE = 10;

// DHCP and Static IP Settings
bool USE_DHCP = true;
IPAddress staticIP(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

// Command Enum
enum CommandType {
  FETCH_LOGS,
  SET_USER_METADATA,
  SET_SUCCESS_BEEP,
  SET_FAIL_BEEP,
  SET_RELAY_MODE,
  SET_DHCP,
  SET_WIFI_CONFIG,
  UNKNOWN_COMMAND
};

// Pin Definitions
const uint8_t RELAY1_PIN = 21;
const uint8_t RELAY2_PIN = 22;
const uint8_t ENTRY_READER_D0 = 12;
const uint8_t ENTRY_READER_D1 = 14;
const uint8_t LEAVE_READER_D0 = 23;
const uint8_t LEAVE_READER_D1 = 5;
const uint8_t PIN_BEEP = 5;  // Pin for buzzer

// Relay and Beep State Config
bool useBothRelays = false;  // Config flag for using both relays
uint8_t relay1DefaultState = LOW;  // Default state for relay 1
uint8_t relay2DefaultState = LOW;  // Default state for relay 2
uint16_t successBeepDuration = 100;
uint16_t successBeepRepeat = 5;
uint16_t failBeepDuration = 300;
uint16_t failBeepRepeat = 3;

// Authentication Log Enum
enum AuthAttempt {
  ENTRY_ALLOWED,
  INTERMEDIARY_ACCESS,
  ANTI_PASSBACK,
  NOT_REGISTERED,
  DEACTIVATED_CARD
};

// Flags Bitmask
const uint8_t ANTI_PASSBACK_FLAG = 0x1;
const uint8_t DEACTIVATED_FLAG = 0x2;
const uint8_t INTERMEDIARY_GATE_FLAG = 0x4;

// Structures
struct LogEntry {
  uint32_t cardId;
  uint32_t userId;
  AuthAttempt attempt;
  unsigned long timestamp;
};

// Globals
WIEGAND entryReader;
WIEGAND leaveReader;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, NTP_SERVER, 0, 60000);
Preferences preferences;
String jwtToken;
LogEntry* logQueue;
int logQueueIndex = 0;
unsigned long previousMillis = 0;
unsigned long previousTimeUpdateMillis = 0;
bool isBeeping = false;
unsigned long lastBeepTime = 0;
uint16_t beepStep = 0;
bool isRegistered = false;  // Flag to check if registration was successful

// Function Prototypes
void connectToWiFi(const char* ssid, const char* password);
void reconnectToWiFi();
void pollServerForCommands();
void handleWiegand();
void enqueueLogEntry(uint32_t cardId, uint32_t userId, AuthAttempt attempt);
CommandType parseCommandType(const String& commandStr);
void sendLogQueue();
uint16_t getUserIdFromCard(uint32_t cardId);
uint32_t getUserMetadata(uint16_t userId);
void setUserMetadata(uint16_t userId, uint32_t metadata, uint32_t cardId = 0);
String getRequestWithAuth(const String& endpoint);
String postRequestWithPayload(const String& endpoint);
void setupLogQueue();
bool registerDevice();
void handleCommand(CommandType commandType, DynamicJsonDocument& jsonDoc);
void startBeep(uint16_t duration, uint16_t repeat);
void stopBeep();
void processBeep(uint16_t duration, uint16_t repeat);
void successBeep();
void errorBeep();
void setRelayState(uint8_t state);
IPAddress IPAddressFromString(const char* str);

void setup() {
  Serial.begin(115200);
  reconnectToWiFi();
  setupLogQueue();

  // Initialize Wiegand readers
  entryReader.begin(ENTRY_READER_D0, ENTRY_READER_D1);
  leaveReader.begin(LEAVE_READER_D0, LEAVE_READER_D1);

  // Initialize relays
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, relay1DefaultState);
  digitalWrite(RELAY2_PIN, relay2DefaultState);

  // Initialize buzzer
  pinMode(PIN_BEEP, OUTPUT);
  digitalWrite(PIN_BEEP, LOW);

  timeClient.begin();
}

void setupLogQueue() {
  logQueue = (LogEntry*)malloc(sizeof(LogEntry) * QUEUE_SIZE);
}

bool registerDevice() {
  String macAddress = WiFi.macAddress();

  StaticJsonDocument<256> jsonDoc;
  jsonDoc["macAddress"] = macAddress;

  String payload;
  serializeJson(jsonDoc, payload);

  String response = postRequestWithPayload("/auth/register", payload);

  if (response.isEmpty()) {
    Serial.println("Failed to register device.");
    return false;
  }

  DynamicJsonDocument responseDoc(1024);
  DeserializationError error = deserializeJson(responseDoc, response);

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return false;
  }

  // Parse and apply configurations
  strlcpy(SERVER_BASE_URL, responseDoc["serverBaseUrl"].as<const char*>(), sizeof(SERVER_BASE_URL));
  strlcpy(NTP_SERVER, responseDoc["ntpServer"].as<const char*>(), sizeof(NTP_SERVER));
  POLLING_INTERVAL = responseDoc["pollingInterval"].as<long>();
  QUEUE_SIZE = responseDoc["queueSize"].as<int>();
  jwtToken = responseDoc["jwtToken"].as<String>();

  // Handle initial commands from the server
  if (responseDoc.containsKey("initialCommands")) {
    JsonArray commandsArray = responseDoc["initialCommands"].as<JsonArray>();
    for (JsonObject commandObj : commandsArray) {
      String commandStr = commandObj["name"].as<String>();
      CommandType commandType = parseCommandType(commandStr);

      // Create a new DynamicJsonDocument to pass to handleCommand
      DynamicJsonDocument commandDoc(256);
      commandDoc.set(commandObj);

      handleCommand(commandType, commandDoc);
    }
  }

  Serial.println("Device registered successfully and configuration updated.");
  return true;
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= POLLING_INTERVAL) {
    previousMillis = currentMillis;

    // Attempt to register if not registered
    if (!isRegistered) {
      isRegistered = registerDevice();
    } else {
      // Once registered, start polling for commands
      pollServerForCommands();
    }
  }

  if (currentMillis - previousTimeUpdateMillis >= 60000) {
    previousTimeUpdateMillis = currentMillis;
    timeClient.update();
  }

  handleWiegand();
  processBeep(100, 5);
}

// Reusable WiFi Connection Function
void connectToWiFi(const char* ssid, const char* password) {
  Serial.println("Connecting to Wi-Fi...");

  if (!USE_DHCP) {
    if (!WiFi.config(staticIP, gateway, subnet, dns)) {
      Serial.println("Static IP configuration failed.");
    } else {
      Serial.println("Static IP configuration set.");
    }
  }

  WiFi.begin(ssid, password);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
    retries++;
    if (retries > 10) {
      Serial.println("Wi-Fi connection failed. Continuing without internet.");
      return;
    }
  }

  Serial.println();
  Serial.println("Connected to Wi-Fi.");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

// Reconnect to WiFi using current global parameters
void reconnectToWiFi() {
  connectToWiFi(WIFI_SSID, WIFI_PASSWORD);
}

void pollServerForCommands() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi not connected. Skipping server polling.");
    return;
  }

  String payload = getRequestWithAuth("/commands");

  if (payload.isEmpty()) {
    Serial.println("No valid response received.");
    return;
  }

  DynamicJsonDocument jsonDoc(2048); // Adjust size as needed for the full payload
  DeserializationError error = deserializeJson(jsonDoc, payload);

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  // Ensure the response is an array of commands
  if (!jsonDoc.is<JsonArray>()) {
    Serial.println("Expected a JSON array of commands.");
    return;
  }

  // Iterate through each command in the array
  JsonArray commandsArray = jsonDoc.as<JsonArray>();
  for (JsonObject commandObj : commandsArray) {
    String commandStr = commandObj["name"].as<String>();
    CommandType commandType = parseCommandType(commandStr);

    // Extract the "payload" field, if it exists, otherwise use an empty document
    DynamicJsonDocument payloadDoc(512); // Adjust size as needed for the payload content
    if (commandObj.containsKey("payload")) {
      payloadDoc.set(commandObj["payload"]);
    } else {
      // Use an empty object if "payload" is not present
      payloadDoc.to<JsonObject>();
    }

    // Pass the commandType and the payload document to handleCommand
    handleCommand(commandType, payloadDoc);
  }
}

CommandType parseCommandType(const String& commandStr) {
  if (commandStr == "SET_WIFI_CONFIG") {
    return SET_WIFI_CONFIG;
  } else if (commandStr == "SET_USER_METADATA") {
    return SET_USER_METADATA;
  } else if (commandStr == "SET_SUCCESS_BEEP") {
    return SET_SUCCESS_BEEP;
  } else if (commandStr == "SET_FAIL_BEEP") {
    return SET_FAIL_BEEP;
  } else if (commandStr == "SET_DHCP") {
    return SET_DHCP;
  } else if (commandStr == "SET_RELAY_MODE") {
    return SET_RELAY_MODE;
  } else if (commandStr == "FETCH_LOGS") {
    return FETCH_LOGS;
  } else {
    return UNKNOWN_COMMAND;
  }
}

void handleCommand(CommandType commandType, DynamicJsonDocument& jsonDoc) {
  switch (commandType) {
    case SET_WIFI_CONFIG: {
      Serial.println("Handling command: SET_WIFI_CONFIG");
      const char* newSSID = jsonDoc["ssid"].as<const char*>();
      const char* newPassword = jsonDoc["password"].as<const char*>();

      if (newSSID && newPassword) {
        strlcpy(WIFI_SSID, newSSID, sizeof(WIFI_SSID));
        strlcpy(WIFI_PASSWORD, newPassword, sizeof(WIFI_PASSWORD));
        reconnectToWiFi();
      }
      break;
    }
    case SET_USER_METADATA: {
      Serial.println("Handling command: SET_USER_METADATA");
      uint32_t userId = jsonDoc["userId"].as<uint32_t>();
      uint32_t metadata = jsonDoc["metadata"].as<uint32_t>();
      uint32_t cardId = jsonDoc["cardId"].as<uint32_t>();
      setUserMetadata(userId, metadata, cardId);
      break;
    }
    case SET_SUCCESS_BEEP: {
      Serial.println("Handling command: SET_SUCCESS_BEEP");
      successBeepDuration = jsonDoc["duration"].as<uint16_t>();
      successBeepRepeat = jsonDoc["repeat"].as<uint16_t>();
      break;
    }
    case SET_FAIL_BEEP: {
      Serial.println("Handling command: SET_FAIL_BEEP");
      failBeepDuration = jsonDoc["duration"].as<uint16_t>();
      failBeepRepeat = jsonDoc["repeat"].as<uint16_t>();
      break;
    }
    case SET_RELAY_MODE: {
      Serial.println("Handling command: SET_RELAY_MODE");
      useBothRelays = jsonDoc["useBothRelays"].as<bool>();
      relay1DefaultState = jsonDoc["relay1DefaultState"].as<uint8_t>();
      if (useBothRelays) {
        relay2DefaultState = jsonDoc["relay2DefaultState"].as<uint8_t>();
      }
      digitalWrite(RELAY1_PIN, relay1DefaultState);
      digitalWrite(RELAY2_PIN, relay2DefaultState);
      break;
    }
    case SET_DHCP: {
      Serial.println("Handling command: SET_DHCP");
      USE_DHCP = jsonDoc["useDHCP"].as<bool>();
      const char* ip = jsonDoc["staticIP"].as<const char*>();
      const char* gw = jsonDoc["gateway"].as<const char*>();
      const char* sn = jsonDoc["subnet"].as<const char*>();
      const char* dnsServer = jsonDoc["dns"].as<const char*>();

      if (!USE_DHCP && ip && gw && sn && dnsServer) {
        staticIP = IPAddressFromString(ip);
        gateway = IPAddressFromString(gw);
        subnet = IPAddressFromString(sn);
        dns = IPAddressFromString(dnsServer);
      }
      reconnectToWiFi();
      break;
    }
    case FETCH_LOGS: {
      sendLogQueue();
      break;
    }
    default:
      Serial.println("Unknown command received.");
      break;
  }
}

IPAddress IPAddressFromString(const char* str) {
  uint8_t ip[4];
  sscanf(str, "%hhu.%hhu.%hhu.%hhu", &ip[0], &ip[1], &ip[2], &ip[3]);
  return IPAddress(ip[0], ip[1], ip[2], ip[3]);
}

void sendLogQueue() {
  if (logQueueIndex == 0) {
    Serial.println("Log queue is empty. Nothing to send.");
    return;
  }

  StaticJsonDocument<1024> jsonDoc;
  JsonArray logArray = jsonDoc.createNestedArray("logs");

  for (int i = 0; i < logQueueIndex; i++) {
    JsonObject logEntry = logArray.createNestedObject();
    logEntry["cardId"] = logQueue[i].cardId;
    logEntry["userId"] = logQueue[i].userId;
    logEntry["attempt"] = logQueue[i].attempt;
    logEntry["timestamp"] = logQueue[i].timestamp;
  }

  String payload;
  serializeJson(jsonDoc, payload);

  postRequestWithPayload("/logs", payload);
  logQueueIndex = 0;
}

void startBeep(uint16_t duration, uint16_t repeat) {
  isBeeping = true;
  lastBeepTime = millis();
  digitalWrite(PIN_BEEP, HIGH);
  beepStep = 0;
}

void stopBeep() {
  isBeeping = false;
  digitalWrite(PIN_BEEP, LOW);
}

void processBeep(uint16_t duration, uint16_t repeat) {
  if (!isBeeping) return;

  unsigned long currentMillis = millis();
  if (currentMillis - lastBeepTime >= duration) {
    digitalWrite(PIN_BEEP, !digitalRead(PIN_BEEP));
    lastBeepTime = currentMillis;
    beepStep++;

    if (beepStep >= repeat * 2) {
      stopBeep();
    }
  }
}

void successBeep() {
  startBeep(successBeepDuration, successBeepRepeat);
}

void errorBeep() {
  startBeep(failBeepDuration, failBeepRepeat);
}

void setRelayState(uint8_t state) {
  digitalWrite(RELAY1_PIN, state);
  if (useBothRelays) {
    digitalWrite(RELAY2_PIN, state);
  }
}

void handleWiegand() {
  if (entryReader.available() || leaveReader.available()) {
    uint32_t cardId;
    bool isEntry = entryReader.available();

    if (isEntry) {
      cardId = entryReader.getCode();
    } else {
      cardId = leaveReader.getCode();
    }

    uint16_t userId = getUserIdFromCard(cardId);

    if (userId == 0) {
      enqueueLogEntry(cardId, 0, NOT_REGISTERED);
      Serial.printf("Card ID: %lu is not registered.\n", cardId);
      errorBeep();
      return;
    }

    uint32_t userMetadata = getUserMetadata(userId);

    if (userMetadata & DEACTIVATED_FLAG) {
      enqueueLogEntry(cardId, userId, DEACTIVATED_CARD);
      Serial.printf("Card ID: %lu, User ID: %lu - Access denied (Deactivated).\n", cardId, userId);
      errorBeep();
      return;
    }

    if (userMetadata & INTERMEDIARY_GATE_FLAG) {
      enqueueLogEntry(cardId, userId, INTERMEDIARY_ACCESS);
      Serial.printf("Card ID: %lu, User ID: %lu - Intermediary access allowed.\n", cardId, userId);
      successBeep();
      setRelayState(HIGH);
      return;
    }

    if (!(userMetadata & ANTI_PASSBACK_FLAG)) {
      enqueueLogEntry(cardId, userId, ENTRY_ALLOWED);
      Serial.printf("Card ID: %lu, User ID: %lu - Access allowed.\n", cardId, userId);
      userMetadata |= ANTI_PASSBACK_FLAG;
      setUserMetadata(userId, userMetadata);
      successBeep();
      setRelayState(HIGH);
    } else {
      enqueueLogEntry(cardId, userId, ANTI_PASSBACK);
      Serial.printf("Card ID: %lu, User ID: %lu - Access forbidden due to anti-passback.\n", cardId, userId);
      errorBeep();
    }
  }
}

void enqueueLogEntry(uint32_t cardId, uint32_t userId, AuthAttempt attempt) {
  if (logQueueIndex >= QUEUE_SIZE) {
    Serial.println("Log queue full. Dropping entry.");
    return;
  }

  LogEntry entry;
  entry.cardId = cardId;
  entry.userId = userId;
  entry.attempt = attempt;
  entry.timestamp = timeClient.getEpochTime();

  logQueue[logQueueIndex++] = entry;
  Serial.println("Log entry added to queue.");
}

uint16_t getUserIdFromCard(uint32_t cardId) {
  preferences.begin("card-mapping", true);
  uint16_t userId = preferences.getUShort(String(cardId).c_str(), 0);
  preferences.end();
  return userId;
}

uint32_t getUserMetadata(uint16_t userId) {
  preferences.begin("user-metadata", true);
  uint32_t metadata = preferences.getUInt(String(userId).c_str(), 0);
  preferences.end();
  return metadata;
}

void setUserMetadata(uint16_t userId, uint32_t metadata, uint32_t cardId) {
  if (cardId) {
    preferences.begin("card-mapping", false);
    preferences.putUShort(String(cardId).c_str(), userId);
    preferences.end();
  }

  preferences.begin("user-metadata", false);
  preferences.putUInt(String(userId).c_str(), metadata);
  preferences.end();
  Serial.printf("Set metadata for User ID %lu to %lu\n", userId, metadata);
}

String getRequestWithAuth(const String& endpoint) {
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + endpoint;
  http.begin(url);
  if(!jwtToken.isEmpty()) {
    http.addHeader("Authorization", "Bearer " + jwtToken);
  }
  int httpCode = http.GET();
  String payload;

  if (httpCode > 0) {
    payload = http.getString();
    Serial.printf("Request to %s successful. Response: %s\n", endpoint.c_str(), payload.c_str());
  } else {
    Serial.printf("Error sending request to %s: %s\n", endpoint.c_str(), http.errorToString(httpCode).c_str());
  }

  http.end();
  return payload;
}

String postRequestWithPayload(const String& endpoint, const String& payload) {
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + endpoint;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (!jwtToken.isEmpty()) {
    http.addHeader("Authorization", "Bearer " + jwtToken);
  }

  int httpCode = http.POST(payload);
  String response;

  if (httpCode > 0) {
    response = http.getString();
    Serial.printf("Request to %s successful. Response: %s\n", endpoint.c_str(), response.c_str());
  } else {
    Serial.printf("Error sending request to %s: %s\n", endpoint.c_str(), http.errorToString(httpCode).c_str());
  }

  http.end();
  return response;
}