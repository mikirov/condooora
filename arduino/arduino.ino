#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <Preferences.h>
#include <Wiegand.h>
#include <ArduinoJson.h>

// may not be needed, investigate further
#include <AsyncTCP.h>

// #include "Vector.h"
#include <vector>

#ifndef HAS_BACKEND
//change to false if it should not have backend server connection
#define HAS_BACKEND false
#else
    #error HAS_BACKEND defined already!
#endif

#ifndef HAS_LOCAL_SERVER
//change to true if it should not have backend server connection
#define HAS_LOCAL_SERVER true
#else
    #error HAS_BACKEND defined already!
#endif

#if HAS_BACKEND && HAS_LOCAL_SERVER
    #error "Both HAS_BACKEND and HAS_LOCAL_SERVER cannot be set simultaneously!"
#endif

// Pin Definitions -> DO NOT MODIFY
const uint8_t RELAY1_PIN = 22;
const uint8_t RELAY2_PIN = 23;
const uint8_t ENTRY_READER_D0 = 12;
const uint8_t ENTRY_READER_D1 = 14;
const uint8_t LEAVE_READER_D0 = 26  ; // not sure, most likely wrong
const uint8_t LEAVE_READER_D1 = 27; // could be reversed
const uint8_t PIN_BEEP = 5;  //  Pin for buzzer -> Arduino 5, GPIO 8, D5 pin

// Debug and logging modes, can be set to false in production. Shouldn't impact performance much
const bool INIT_LOG = true;
const bool DEV_MODE = true;
const bool DEBUG_LOG = true;

// Constants and Configurable Variables
// char WIFI_SSID[20] = "A1_59E8";
char WIFI_SSID[20] = "mikirov";
char WIFI_PASSWORD[20] = "12345678";
// char SERVER_BASE_URL[50] = "http://192.168.0.4:3003";
char SERVER_BASE_URL[50] = "http://172.20.10.6:3003";
char NTP_SERVER[50] = "pool.ntp.org";
// long POLLING_INTERVAL = 3000;
long POLLING_INTERVAL = 10000;

// assuming we have 4 (cardId) + 4 (userId) + 4 (timestamp) + 1 (attempt enum) = 13 bytes for each log stored in preferences, this is 13000 bytes, which is way less than the 4 MB limit of ESP32 flash
int QUEUE_SIZE = 1000;

uint32_t logIndex = 0;

// DHCP and Static IP Settings
bool USE_DHCP = true;
IPAddress staticIP(192, 168, 1, 50);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

#if HAS_LOCAL_SERVER
  String index_html;// = "<!DOCTYPE HTML><html><head><title>HTML Form to Input Data</title><meta name='viewport' content='width=device-width, initial-scale=1'><style>html {font-family: Times New Roman; display: inline-block; text-align: center;}table{display: inline-block; text-align: center;}h4 {font-size: 1.0rem; color: #FF0000;}</style></head><body><h4>Edit Users</h4><form action='/get'>User: <input type='text' name='input_number' size='12'><br />Card Number: <input type='text' name='input_card' size='12'><input type='submit' value='Submit'></form><br></body></html>";
  const char* ssid     = "Access control";
  const char* password = "1223334444";
  WiFiServer server(80);
  String header;
  String tablex;

  void handleLocalServer();
  void handleIncomingClient(WiFiClient& client);
  String buildTableData();
  void sendHttpResponse(WiFiClient& client);
  void processHttpRequest();

#endif

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

const uint8_t BEEP_HIGH = 180;
const uint8_t BEEP_LOW = 0;

// Relay and Beep State Config
bool useBothRelays = false;  // Config flag for using both relays
bool isRelayOpen = false;
uint8_t relay1DefaultState = LOW;  // Default state for relay 1
uint8_t relay2DefaultState = LOW;  // Default state for relay 2
uint16_t successBeepDuration = 150;
uint16_t successBeepRepeat = 10;
uint16_t failBeepDuration = 1000;
uint16_t failBeepRepeat = 2;


// Flags Bitmask
const uint8_t ANTI_PASSBACK_FLAG = 0x1;
const uint8_t DEACTIVATED_FLAG = 0x2;
const uint8_t INTERMEDIARY_GATE_FLAG = 0x4;

#if HAS_BACKEND
  const uint8_t AUTH_ATTEMPT_NOT_REGISTERED = 0;
  const uint8_t AUTH_ATTEMPT_ENTRY_ALLOWED = 1;
  const uint8_t AUTH_ATTEMPT_INTERMEDIARY_ACCESS = 2;
  const uint8_t AUTH_ATTEMPT_ANTI_PASSBACK = 3;
  const uint8_t AUTH_ATTEMPT_DEACTIVATED_CARD = 4;

  // Structures
  struct LogEntry {
    uint32_t logIndex;
    uint32_t cardId;
    uint32_t userId;
    uint32_t timestamp;
    uint8_t attempt;

        // Constructor for convenience
      LogEntry(uint32_t logIndex = 0, uint32_t cardId = 0, uint32_t userId = 0, uint32_t timestamp = 0, uint8_t attempt = 0)
          : logIndex(logIndex), cardId(cardId), userId(userId), timestamp(timestamp), attempt(attempt) {}
  };
#endif

struct User {
  uint16_t id;
  uint32_t cardId;
  uint8_t metadataBitmask; //bitmask 

      User(uint16_t id, uint32_t cardId, uint8_t metadataBitmask)
        : id(id), cardId(cardId), metadataBitmask(metadataBitmask) {}
};

std::vector<User> users;

// Globals
WIEGAND entryReader;
WIEGAND leaveReader;
Preferences preferences;
unsigned long previousMillis = 0;
unsigned long previousTimeUpdateMillis = 0;
bool isBeeping = false;
unsigned long lastBeepTime = 0;
unsigned long lastRelayOpenTime = 0;
uint16_t beepStep = 0;
uint16_t beep_duration = 100;
uint16_t beep_repeat = 15;
uint16_t relay_open_duration = 3000;

#if HAS_BACKEND
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, NTP_SERVER, 0, 60000);
String jwtToken;
bool isRegistered = false;  // Flag to check if registration was successful
bool hasInitialWifiConnectionCompleted = false;
#endif

// Function Prototypes
#if HAS_BACKEND
void connectToWiFi(const char* ssid, const char* password);
void reconnectToWiFi();
void pollServerForCommands();
void enqueueLogEntry(uint32_t cardId, uint32_t userId, char attempt);
CommandType parseCommandType(const String& commandStr);
bool sendLogQueue();
String getRequestWithAuth(const String& endpoint);
String postRequestWithPayload(const String& endpoint);
bool registerDevice();
void handleCommand(CommandType commandType, DynamicJsonDocument& jsonDoc);
IPAddress IPAddressFromString(const char* str);
#endif

void handleWiegand();
uint16_t getUserIdFromCard(uint32_t cardId);
uint8_t getUserMetadata(uint16_t userId);
void setUserMetadata(uint16_t userId, uint8_t metadata, uint32_t cardId = 0);
void startBeep(uint16_t duration, uint16_t repeat);
void stopBeep();
void processBeep();
void successBeep();
void errorBeep();
void setRelayState(uint8_t state);
void processRelayState();

void setup() {
  Serial.begin(115200);

  #if HAS_BACKEND
    preferences.begin("config", true); // Open the namespace for reading
      strlcpy(SERVER_BASE_URL, preferences.getString("serverBaseUrl", SERVER_BASE_URL).c_str(), sizeof(SERVER_BASE_URL));
      strlcpy(NTP_SERVER, preferences.getString("ntpServer", NTP_SERVER).c_str(), sizeof(NTP_SERVER));
      POLLING_INTERVAL = preferences.getInt("pollingInterval", POLLING_INTERVAL);
      QUEUE_SIZE = preferences.getInt("queueSize", QUEUE_SIZE);
      logIndex = preferences.getUInt("logIndex", QUEUE_SIZE);
      // jwtToken = preferences.getString("jwtToken", jwtToken);
      // isRegistered = preferences.getBool("registered", false);
    preferences.end();

    if(INIT_LOG) Serial.printf("JWT Token: %s\n", jwtToken.c_str());

    reconnectToWiFi();
    timeClient.begin();
  #elif HAS_LOCAL_SERVER
    WiFi.softAP(ssid, password);
    IPAddress IP = WiFi.softAPIP();
    Serial.print("AP IP address: ");
    Serial.println(IP);
    preferences.begin("Cards", false);
    index_html = "<!DOCTYPE HTML><html><head><title>HTML Form to Input Data</title><meta name='viewport' content='width=device-width, initial-scale=1'>";
    index_html += "<style>html {font-family: Times New Roman; display: inline-block; text-align: center;}table{display: inline-block; text-align: center;}h4 {font-size: 1.0rem; color: #FF0000;}</style>";
    index_html += "</head><body><h4>ACCESS CONTROL</h4><form action='/GET'><table><tr><td align='right'>User:</td><td align='left'><input type='text' name='input_number' size='12'></td></tr>";
    index_html += "<tr><td align='right'>Card Number:</td><td align='left'><input type='text' name='input_card' size='12'></td></tr>";
    index_html += "<tr><td align='right'>Active:</td><td align='left'><input type='text' name='input_active' size='12'></td></tr>";
    index_html += "<tr><td colspan='2' align='center'><input type='submit' value='Submit'></td></tr></table></form>";
    tablex="<table border='1px'><tr><th>ID</th><th>CardNo</th><th>act</th><th>ID</th><th>CardNo</th><th>act</th><th>ID</th><th>CardNo</th><th>act</th><th>ID</th><th>CardNo</th><th>act</th><th>ID</th><th>CardNo</th><th>act</th></tr>";
    server.begin();
  #endif

  // Initialize Wiegand readers
  entryReader.begin(ENTRY_READER_D0, ENTRY_READER_D1);
  leaveReader.begin(LEAVE_READER_D0, LEAVE_READER_D1);

  // Initialize relays
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, relay1DefaultState);
  digitalWrite(RELAY2_PIN, relay2DefaultState);

  // if (DEBUG_LOG) Serial.println("Relays set up");
  // Initialize buzzer
  beep_duration = 100;
  beep_repeat = 15;
  
  pinMode(PIN_BEEP, OUTPUT);
  digitalWrite(PIN_BEEP, LOW);
  // if (DEBUG_LOG) Serial.println("Buzzer set up");

  if (DEBUG_LOG) Serial.println("Initialization complete");
}

void loop() {

  #if HAS_BACKEND
    if(hasInitialWifiConnectionCompleted && WiFi.status() != WL_CONNECTED) {
      reconnectToWiFi();
    }

    unsigned long currentMillis = millis();

    if (currentMillis - previousMillis >= POLLING_INTERVAL) {
      previousMillis = currentMillis;

      // Attempt to register if not registered
      if (!isRegistered) {
        if(DEBUG_LOG) Serial.print("Not registered, registering to server ...");
        isRegistered = registerDevice();
      } else {
        // Once registered, start polling for commands
        pollServerForCommands();
      }
    }

    //update the time every 60 seconds
    else if (currentMillis - previousTimeUpdateMillis >= 60000) {
      previousTimeUpdateMillis = currentMillis;
      timeClient.update();
      if(DEBUG_LOG) Serial.printf("Updated time. Current time: %s\n", timeClient.getFormattedTime().c_str());
    }
  #elif HAS_LOCAL_SERVER
  handleLocalServer();
  #endif

  handleWiegand();
  processBeep();
  processRelayState();
}

#if HAS_LOCAL_SERVER
void handleIncomingClient(WiFiClient& client) {
  String currentLine = "";
  while (client.connected()) {
    if (client.available()) {
      char c = client.read();
      header += c;

      if (c == '\n') {
        if (currentLine.length() == 0) {
          sendHttpResponse(client);
          break;
        } else {
          currentLine = "";
        }
      } else if (c != '\r') {
        currentLine += c;
      }
    }
  }
  header = "";
  client.stop();
  Serial.println("Client disconnected.");
}
// Build the HTML table with user data
String buildTableData() {
    String table = R"rawliteral(
      <table class="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr class="bg-blue-100">
            <th class="border border-gray-300 px-4 py-2">User ID</th>
            <th class="border border-gray-300 px-4 py-2">Card ID</th>
            <th class="border border-gray-300 px-4 py-2">Active</th>
          </tr>
        </thead>
        <tbody>
    )rawliteral";

    for (size_t i = 0; i < users.size(); i++) {
        table += "<tr class='hover:bg-gray-100'>";
        table += "<td class='border border-gray-300 px-4 py-2'>" + String(users[i].id) + "</td>";
        table += "<td class='border border-gray-300 px-4 py-2'>" + String(users[i].cardId) + "</td>";
        table += "<td class='border border-gray-300 px-4 py-2'>" + String(users[i].metadataBitmask ? "Yes" : "No") + "</td>";
        table += "</tr>";
    }

    table += "</tbody></table>";
    return table;
}

// Serve HTTP response with HTML content
void sendHttpResponse(WiFiClient& client) {
    processHttpRequest(); // Process the incoming request

    // Serve HTML response
    client.println("HTTP/1.1 200 OK");
    client.println("Content-type:text/html");
    client.println("Connection: close");
    client.println();

    // HTML structure with Tailwind CSS
    client.println(R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registered Users</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-gray-800">
  <header class="bg-blue-500 text-white py-4 shadow">
    <div class="container mx-auto text-center">
      <h1 class="text-2xl font-bold">User Registration Dashboard</h1>
    </div>
  </header>
  <main class="container mx-auto my-6">
    <div class="bg-white shadow rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Registered Users</h2>
)rawliteral");

    client.println(buildTableData()); // Inject dynamic table data

    client.println(R"rawliteral(
    </div>
  </main>
  <footer class="bg-gray-800 text-white py-4">
    <div class="container mx-auto text-center">
      <p>&copy; 2025 Local Server. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>
    )rawliteral");
}

void processHttpRequest() {
    if (header.indexOf("/GET?") < 0) return;

    // Extract query parameters
    String query = header.substring(header.indexOf("/GET?") + 5, header.indexOf("HTTP/1.1") - 1);
    String id = query.substring(0, query.indexOf("&"));
    String cardIdStr = query.substring(query.indexOf("&cardId=") + 8, query.lastIndexOf("&active="));
    String activeStr = query.substring(query.indexOf("&active=") + 8);

    uint32_t cardId = cardIdStr.toInt();
    bool activeFlag = (activeStr == "true");
    uint16_t userId = id.toInt();
    uint8_t bitmask = getUserMetadata(userId);

    // Check if the user already exists
    for (size_t i = 0; i < users.size(); i++) {
        if (users[i].id == userId) {
            users[i].cardId = cardId; // Update cardId
            users[i].metadataBitmask = bitmask & activeFlag; // Update active status
            return;
        }
    }

    // Add new user if not found
    users.push_back(User(id.toInt(), cardId, bitmask & activeFlag));
    Serial.printf("New User Added: ID=%s, CardID=%u, Active=%s\n", userId, cardId, activeFlag ? "true" : "false");
}

void handleLocalServer() {
  WiFiClient client = server.available(); // Listen for incoming clients
  if (client) {
    Serial.println("New Client Connected.");
    handleIncomingClient(client);
  }
}
#endif

void successBeep() {
  startBeep(successBeepDuration, successBeepRepeat);
}

void errorBeep() {
  startBeep(failBeepDuration, failBeepRepeat);
}

void startBeep(uint16_t duration, uint16_t repeat) {
  isBeeping = true;
  beep_duration = duration;
  beep_repeat = repeat;
  lastBeepTime = millis();
  analogWrite(PIN_BEEP, BEEP_HIGH);
  beepStep = 0;
}

void stopBeep() {
  isBeeping = false;
  analogWrite(PIN_BEEP, BEEP_LOW);
}

void processBeep() {
  if (!isBeeping) return;
  // if(DEBUG_LOG) Serial.println("Processing beep");
  unsigned long currentMillis = millis();
  if (currentMillis - lastBeepTime >= beep_duration) {
    // if(DEBUG_LOG) Serial.println("Beep duration elapsed");
    if(beepStep % 2 == 0) {
      analogWrite(PIN_BEEP, BEEP_HIGH);
    } else {
      analogWrite(PIN_BEEP, BEEP_LOW);
    }
    lastBeepTime = currentMillis;
    beepStep++;

    if (beepStep >= beep_repeat * 2) {
      if(DEBUG_LOG) Serial.printf("Stopping beep after %d duration and %d repeats\n", beep_duration, beep_repeat);
    //  if(DEBUG_LOG) Serial.printf("Stopping beep \n");
      stopBeep();
    }
  }
}

void processRelayState() {
  if(!isRelayOpen) return;
    
  unsigned long currentMillis = millis();
  if (currentMillis - lastRelayOpenTime >= relay_open_duration) {
    if(DEBUG_LOG) Serial.println("Relay open duration elapsed");
    setRelayState(LOW);
    isRelayOpen = false;
  }
}

void successRelay() {
  isRelayOpen = true;
  lastRelayOpenTime = millis();
  setRelayState(HIGH);
}

void setRelayState(uint8_t state) {
  digitalWrite(RELAY1_PIN, state);
  if(DEBUG_LOG) Serial.printf("Setting Relay state to %d\n", state);
  if (useBothRelays) {
    digitalWrite(RELAY2_PIN, state);
    if(DEBUG_LOG) Serial.printf("Setting Both Relay's state to %d\n", state);
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

    if(DEBUG_LOG) Serial.printf("Card detected. Card ID: %d\n", cardId);

    uint16_t userId = getUserIdFromCard(cardId);
    
    if(DEBUG_LOG) Serial.printf("User ID associated with card: %d\n", cardId);

    if (userId == 0) {
      #if HAS_BACKEND
      enqueueLogEntry(cardId, 0, AUTH_ATTEMPT_NOT_REGISTERED);
      #endif
      if(DEBUG_LOG) Serial.printf("Card ID: %lu is not registered.\n", cardId);
      errorBeep();
      return;
    }

    uint32_t userMetadata = getUserMetadata(userId);

    if(DEBUG_LOG) Serial.printf("User Metadata bitmask for Gate: %d\n", userMetadata);


    if (userMetadata & DEACTIVATED_FLAG) {
      #if HAS_BACKEND
      enqueueLogEntry(cardId, userId, AUTH_ATTEMPT_DEACTIVATED_CARD);
      #endif
      if(DEBUG_LOG) Serial.printf("Card ID: %lu, User ID: %lu - Access denied (Deactivated).\n", cardId, userId);
      errorBeep();
      return;
    }

    if (userMetadata & INTERMEDIARY_GATE_FLAG) {
      #if HAS_BACKEND
      enqueueLogEntry(cardId, userId, AUTH_ATTEMPT_INTERMEDIARY_ACCESS);
      #endif
      if(DEBUG_LOG) Serial.printf("Card ID: %lu, User ID: %lu - Intermediary access allowed.\n", cardId, userId);
      successBeep();
      successRelay();
      return;
    }

    if (!(userMetadata & ANTI_PASSBACK_FLAG)) {
      #if HAS_BACKEND
      enqueueLogEntry(cardId, userId, AUTH_ATTEMPT_ENTRY_ALLOWED);
      #endif
      if(DEBUG_LOG) Serial.printf("Card ID: %lu, User ID: %lu - Access allowed.\n", cardId, userId);
      userMetadata |= ANTI_PASSBACK_FLAG;
      setUserMetadata(userId, userMetadata);
      successBeep();
      successRelay();
    } else {
      #if HAS_BACKEND
      enqueueLogEntry(cardId, userId, AUTH_ATTEMPT_ANTI_PASSBACK);
      #endif
      if(DEBUG_LOG) Serial.printf("Card ID: %lu, User ID: %lu - Access forbidden due to anti-passback.\n", cardId, userId);
      errorBeep();
    }
  }
}

uint16_t getUserIdFromCard(uint32_t cardId) {
  preferences.begin("card-mapping", true);
  uint16_t userId = preferences.getUShort(String(cardId).c_str(), 0);
  preferences.end();
  return userId;
}

uint8_t getUserMetadata(uint16_t userId) {
  preferences.begin("user-metadata", true);
  uint8_t metadata = preferences.getUChar(String(userId).c_str(), 0);
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

#if HAS_BACKEND
bool registerDevice() {
  String macAddress = WiFi.macAddress();

  StaticJsonDocument<256> jsonDoc;
  jsonDoc["macAddress"] = macAddress;

  String payload;
  serializeJson(jsonDoc, payload);

  String response = postRequestWithPayload("/device/register", payload);

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

  // Store configurations in Preferences
  preferences.begin("config", false); // Create or open a namespace

  preferences.putBool("registered", true);

  if(responseDoc.containsKey("serverBaseUrl")) {
      strlcpy(SERVER_BASE_URL, responseDoc["serverBaseUrl"].as<const char*>(), sizeof(SERVER_BASE_URL));
      preferences.putString("serverBaseUrl", SERVER_BASE_URL);
  }
  if(responseDoc.containsKey("ntpServer")) {
    strlcpy(NTP_SERVER, responseDoc["ntpServer"].as<const char*>(), sizeof(NTP_SERVER));
    preferences.putString("ntpServer", NTP_SERVER);
  }
  if(responseDoc.containsKey("pollingInterval")) {
    POLLING_INTERVAL = responseDoc["pollingInterval"].as<long>();
    preferences.putInt("pollingInterval", POLLING_INTERVAL);
  }
  if(responseDoc.containsKey("queueSize")) {
    QUEUE_SIZE = responseDoc["queueSize"].as<int>();
    preferences.putInt("queueSize", QUEUE_SIZE);
  }
  if(responseDoc.containsKey("jwtToken")) {
    jwtToken = responseDoc["jwtToken"].as<String>();
    preferences.putString("jwtToken", jwtToken);
  }

  preferences.end();

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
// Reconnect to WiFi using current global parameters
void reconnectToWiFi() {
  connectToWiFi(WIFI_SSID, WIFI_PASSWORD);
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

  hasInitialWifiConnectionCompleted = true;

  if(INIT_LOG) {
    Serial.println();
    Serial.println("Connected to Wi-Fi.");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    Serial.printf("MAC Address: %s\n", WiFi.macAddress().c_str());

  }
}

void pollServerForCommands() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi not connected. Skipping server polling.");
    return;
  }

  String payload = getRequestWithAuth("/commands");

  if (payload.isEmpty()) {
    // Serial.println("No valid response received.");
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

bool sendLogQueue() {
  LogEntry entry = dequeueLogEntry();

  if (entry.cardId == 0 && entry.userId == 0 && entry.timestamp == 0) {
    Serial.println("Queue is empty.");
    return false;
  } 

  if(DEBUG_LOG) {
    printQueue();
  }

  // StaticJsonDocument<1024> jsonDoc;
  DynamicJsonDocument jsonDoc(QUEUE_SIZE);
  JsonArray logArray = jsonDoc.to<JsonArray>();

  for(int i = 0; i < QUEUE_SIZE; i++) {
    JsonObject logEntry = logArray.createNestedObject();
    logEntry["cardId"] = entry.cardId;
    logEntry["userId"] = entry.userId;
    logEntry["attempt"] = entry.attempt;
    logEntry["timestamp"] = entry.timestamp;

    entry = dequeueLogEntry();
    if (entry.cardId == 0 && entry.userId == 0 && entry.timestamp == 0) {
      Serial.println("Queue is empty.");
      break;
    } 

  }

  String payload;
  serializeJson(jsonDoc, payload);

  String response = postRequestWithPayload("/logs", payload);

  if (response.isEmpty()) {
    Serial.println("Failed to send logs");
    return false;
  }

  return true;
}

void enqueueLogEntry(uint32_t cardId, uint32_t userId, uint8_t attempt) {
  preferences.begin("logs", false);

  // Get the current write index
  uint32_t writeIndex = preferences.getUInt("writeIndex", 0);
  uint32_t readIndex = preferences.getUInt("readIndex", 0);

  // Check if the queue is full
  if (((writeIndex + 1) % QUEUE_SIZE) == readIndex) {
    if (DEBUG_LOG) Serial.println("Log queue full. Dropping entry.");
    preferences.end();
    return;
  }

  // Store the log entry in flash
  String baseKey = String(writeIndex) + "_"; // Prefix for log keys
  preferences.putUInt((baseKey + "logIndex").c_str(), logIndex);
  preferences.putUInt((baseKey + "cardId").c_str(), cardId);
  preferences.putUInt((baseKey + "userId").c_str(), userId);
  preferences.putULong((baseKey + "timestamp").c_str(), timeClient.getEpochTime());
  preferences.putChar((baseKey + "attempt").c_str(), attempt);

  // Update the write index
  writeIndex = (writeIndex + 1) % QUEUE_SIZE;
  preferences.putUInt("writeIndex", writeIndex);

  preferences.end();

  preferences.begin("config");
  preferences.putUInt("logIndex", logIndex);
  preferences.end();

  logIndex += 1;
  
  Serial.println("Log entry added to queue.");
}

LogEntry dequeueLogEntry() {
  preferences.begin("logs", false);

  // Get the current write and read indices
  uint32_t writeIndex = preferences.getUInt("writeIndex", 0);
  uint32_t readIndex = preferences.getUInt("readIndex", 0);

  // Check if the queue is empty
  if (readIndex == writeIndex) {
    if (DEBUG_LOG) Serial.println("Log queue is empty. Nothing to dequeue.");
    preferences.end();
    return {0, 0, 0, 'N'}; // Return a default entry to indicate an empty queue
  }

  // Read the log entry from flash
  String baseKey = String(readIndex) + "_";
  uint32_t cardId = preferences.getUInt((baseKey + "cardId").c_str(), 0);
  uint32_t userId = preferences.getUInt((baseKey + "userId").c_str(), 0);
  uint32_t timestamp = preferences.getULong((baseKey + "timestamp").c_str(), 0);
  uint8_t attempt = preferences.getChar((baseKey + "attempt").c_str(), 'N');

  // Debug log the dequeued entry
  if (DEBUG_LOG) {
    Serial.printf("Dequeued Log - Card ID: %u, User ID: %u, Timestamp: %u, Attempt: %d\n",
                  cardId, userId, timestamp, attempt);
  }

  // Update the read index
  readIndex = (readIndex + 1) % QUEUE_SIZE;
  preferences.putUInt("readIndex", readIndex);

  preferences.end();

  // Construct and return the log entry
  return {cardId, userId, timestamp, attempt};
}

void printQueue() {
  preferences.begin("logs", true);

  uint32_t writeIndex = preferences.getUInt("writeIndex", 0);
  uint32_t readIndex = preferences.getUInt("readIndex", 0);

  Serial.println("Current Queue:");
  while (readIndex != writeIndex) {
    String baseKey = String(readIndex) + "_";
    uint32_t cardId = preferences.getUInt((baseKey + "cardId").c_str(), 0);
    uint32_t userId = preferences.getUInt((baseKey + "userId").c_str(), 0);
    uint8_t attempt = preferences.getChar((baseKey + "attempt").c_str(), 0);

    Serial.printf("Card ID: %d, User ID: %d, , Attempt: %d\n", cardId, userId, attempt);

    readIndex = (readIndex + 1) % QUEUE_SIZE;
  }

  preferences.end();
}

String getRequestWithAuth(const String& endpoint) {
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + endpoint;
  http.begin(url);
  if(!jwtToken.isEmpty()) {
    http.addHeader("Authorization", "Bearer " + jwtToken);
    // if(DEBUG_LOG) Serial.printf("JWT Token: %s", jwtToken.c_str());
  }
  int httpCode = http.GET();
  String payload;

  if (httpCode > 0) {
    payload = http.getString();
    if (DEBUG_LOG) Serial.printf("Request to %s successful. Response: %s\n", endpoint.c_str(), payload.c_str());
  } else {
    if (DEBUG_LOG) Serial.printf("Error sending request to %s,  endpoint: %s: %s\n",String(SERVER_BASE_URL).c_str(),  endpoint.c_str(), http.errorToString(httpCode).c_str());
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
    Serial.printf("Error sending request to %s, endpoint: %s: %s\n", String(SERVER_BASE_URL).c_str(), endpoint.c_str(), http.errorToString(httpCode).c_str());
  }

  http.end();
  return response;
}
#endif