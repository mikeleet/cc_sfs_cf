#include "WebServer.h"

#include <AsyncJson.h>

#include "ElegooCC.h"
#include "Logger.h"
#include "EmbeddedWebUI.h"
#include "TimeSeriesData.h"

#define SPIFFS LittleFS

// External reference to firmware version from main.cpp
extern const char *firmwareVersion;
extern const char *chipFamily;

// External functions for uptime tracking from main.cpp
extern unsigned long getUptimeSeconds();
extern String getUptimeFormatted();

// External timeseries data from main.cpp
extern TimeSeriesData* movementData;
extern TimeSeriesData* runoutData;
extern TimeSeriesData* connectionData;

WebServer::WebServer(int port) : server(port) {}

void WebServer::begin()
{
    server.begin();

    // Get settings endpoint
    server.on("/get_settings", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  String jsonResponse = settingsManager.toJson(false);
                  request->send(200, "application/json", jsonResponse);
              });

    server.addHandler(new AsyncCallbackJsonWebHandler(
        "/update_settings",
        [this](AsyncWebServerRequest *request, JsonVariant &json)
        {
            JsonObject jsonObj = json.as<JsonObject>();
            settingsManager.setElegooIP(jsonObj["elegooip"].as<String>());
            settingsManager.setSSID(jsonObj["ssid"].as<String>());
            settingsManager.setElegooIP(jsonObj["elegooip"].as<String>());
            settingsManager.setSSID(jsonObj["ssid"].as<String>());
            if (jsonObj.containsKey("passwd") && jsonObj["passwd"].as<String>().length() > 0)
            {
                settingsManager.setPassword(jsonObj["passwd"].as<String>());
            }
            settingsManager.setAPMode(jsonObj["ap_mode"].as<bool>());
            settingsManager.setTimeout(jsonObj["timeout"].as<int>());
            settingsManager.setFirstLayerTimeout(jsonObj["first_layer_timeout"].as<int>());
            settingsManager.setPauseOnRunout(jsonObj["pause_on_runout"].as<bool>());
            settingsManager.setEnabled(jsonObj["enabled"].as<bool>());
            settingsManager.setStartPrintTimeout(jsonObj["start_print_timeout"].as<int>());
            if (jsonObj.containsKey("pause_verification_timeout_ms")) {
                settingsManager.setPauseVerificationTimeoutMs(jsonObj["pause_verification_timeout_ms"].as<int>());
            }
            if (jsonObj.containsKey("max_pause_retries")) {
                settingsManager.setMaxPauseRetries(jsonObj["max_pause_retries"].as<int>());
            }
            settingsManager.save();
            
            // Log all saved settings for verification
            logger.log("Settings saved - SSID: " + settingsManager.getSSID() + 
                      ", ElegooIP: " + settingsManager.getElegooIP() +
                      ", Timeout: " + String(settingsManager.getTimeout()) + "ms" +
                      ", FirstLayerTimeout: " + String(settingsManager.getFirstLayerTimeout()) + "ms" +
                      ", StartPrintTimeout: " + String(settingsManager.getStartPrintTimeout()) + "ms" +
                      ", PauseOnRunout: " + String(settingsManager.getPauseOnRunout()) +
                      ", Enabled: " + String(settingsManager.getEnabled()) +
                      ", PauseVerificationTimeout: " + String(settingsManager.getPauseVerificationTimeoutMs()) + "ms" +
                      ", MaxPauseRetries: " + String(settingsManager.getMaxPauseRetries()));
            
            jsonObj.clear();
            request->send(200, "text/plain", "ok");
        }));

    // Setup ElegantOTA
    ElegantOTA.begin(&server);

    // System health endpoint
    server.on("/system_health", HTTP_GET,
              [this](AsyncWebServerRequest *request)
              {
                  DynamicJsonDocument doc(1024);
                  
                  // Memory information
                  doc["memory"]["total_bytes"] = ESP.getHeapSize();
                  doc["memory"]["free_bytes"] = ESP.getFreeHeap();
                  doc["memory"]["used_bytes"] = ESP.getHeapSize() - ESP.getFreeHeap();
                  doc["memory"]["usage_percent"] = (int)((float)(ESP.getHeapSize() - ESP.getFreeHeap()) / ESP.getHeapSize() * 100);
                  doc["memory"]["largest_free_block"] = ESP.getMaxAllocHeap();
                  
                  // CPU information
                  doc["cpu"]["frequency_mhz"] = ESP.getCpuFreqMHz();
                  doc["cpu"]["cores"] = ESP.getChipCores();
                  
                  // Flash information
                  doc["flash"]["total_bytes"] = ESP.getFlashChipSize();
                  doc["flash"]["used_bytes"] = ESP.getSketchSize();
                  doc["flash"]["free_bytes"] = ESP.getFreeSketchSpace();
                  doc["flash"]["usage_percent"] = (int)((float)ESP.getSketchSize() / ESP.getFlashChipSize() * 100);
                  
                  // Uptime information
                  unsigned long uptimeSeconds = millis() / 1000;
                  doc["uptime"]["seconds"] = uptimeSeconds;
                  
                  // Format uptime
                  int days = uptimeSeconds / 86400;
                  int hours = (uptimeSeconds % 86400) / 3600;
                  int minutes = (uptimeSeconds % 3600) / 60;
                  int seconds = uptimeSeconds % 60;
                  
                  String uptimeFormatted = "";
                  if (days > 0) uptimeFormatted += String(days) + "d ";
                  if (hours > 0) uptimeFormatted += String(hours) + "h ";
                  if (minutes > 0) uptimeFormatted += String(minutes) + "m ";
                  uptimeFormatted += String(seconds) + "s";
                  doc["uptime"]["formatted"] = uptimeFormatted;
                  
                  // WiFi information
                  doc["wifi"]["rssi"] = WiFi.RSSI();
                  int rssi = WiFi.RSSI();
                  String signalStrength = "Unknown";
                  if (rssi > -50) signalStrength = "Excellent";
                  else if (rssi > -60) signalStrength = "Good";
                  else if (rssi > -70) signalStrength = "Fair";
                  else if (rssi > -80) signalStrength = "Weak";
                  else signalStrength = "Very Weak";
                  doc["wifi"]["signal_strength"] = signalStrength;
                  
                  String response;
                  serializeJson(doc, response);
                  request->send(200, "application/json", response);
              });

    // Sensor status endpoint
    server.on("/sensor_status", HTTP_GET,
              [this](AsyncWebServerRequest *request)
              {
                  // Add elegoo status information using singleton
                  printer_info_t elegooStatus = elegooCC.getCurrentInformation();

                  DynamicJsonDocument jsonDoc(512);
                  jsonDoc["stopped"]        = elegooStatus.filamentStopped;
                  jsonDoc["filamentRunout"] = elegooStatus.filamentRunout;

                  jsonDoc["elegoo"]["mainboardID"]          = elegooStatus.mainboardID;
                  jsonDoc["elegoo"]["printStatus"]          = (int) elegooStatus.printStatus;
                  jsonDoc["elegoo"]["isPrinting"]           = elegooStatus.isPrinting;
                  jsonDoc["elegoo"]["currentLayer"]         = elegooStatus.currentLayer;
                  jsonDoc["elegoo"]["totalLayer"]           = elegooStatus.totalLayer;
                  jsonDoc["elegoo"]["progress"]             = elegooStatus.progress;
                  jsonDoc["elegoo"]["currentTicks"]         = elegooStatus.currentTicks;
                  jsonDoc["elegoo"]["totalTicks"]           = elegooStatus.totalTicks;
                  jsonDoc["elegoo"]["PrintSpeedPct"]        = elegooStatus.PrintSpeedPct;
                  jsonDoc["elegoo"]["isWebsocketConnected"] = elegooStatus.isWebsocketConnected;
                  jsonDoc["elegoo"]["currentZ"]             = elegooStatus.currentZ;
                  
                  // Add uptime information
                  jsonDoc["uptime"]["seconds"] = getUptimeSeconds();
                  jsonDoc["uptime"]["formatted"] = getUptimeFormatted();

                  String jsonResponse;
                  serializeJson(jsonDoc, jsonResponse);
                  request->send(200, "application/json", jsonResponse);
              });

    // Logs endpoint (recent logs as JSON)
    server.on("/api/logs", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  String jsonResponse = logger.getLogsAsJson();
                  request->send(200, "application/json", jsonResponse);
              });

    // Historical logs endpoint (all stored logs as text)
    server.on("/logs/history", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  String logContents = logger.getLogFileContents();
                  if (logContents.length() == 0)
                  {
                      logContents = "No historical logs available.";
                  }
                  request->send(200, "text/plain", logContents);
              });

    // Clear logs endpoint
    server.on("/logs/clear", HTTP_POST,
              [](AsyncWebServerRequest *request)
              {
                  logger.clearLogs();
                  logger.clearLogFile();
                  request->send(200, "text/plain", "All logs cleared");
              });

    // Version endpoint
    server.on("/version", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  DynamicJsonDocument jsonDoc(256);
                  jsonDoc["firmware_version"] = firmwareVersion;
                  jsonDoc["chip_family"]      = chipFamily;
                  jsonDoc["build_date"]       = __DATE__;
                  jsonDoc["build_time"]       = __TIME__;

                  String jsonResponse;
                  serializeJson(jsonDoc, jsonResponse);
                  request->send(200, "application/json", jsonResponse);
              });

    // System health storage info endpoint
    server.on("/api/storage", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  DynamicJsonDocument jsonDoc(512);
                  
                  size_t totalBytes = LittleFS.totalBytes();
                  size_t usedBytes = LittleFS.usedBytes();
                  size_t freeBytes = totalBytes - usedBytes;
                  size_t logUsage = logger.getLogFileUsage();
                  
                  jsonDoc["total_bytes"] = totalBytes;
                  jsonDoc["used_bytes"] = usedBytes;
                  jsonDoc["free_bytes"] = freeBytes;
                  jsonDoc["total_kb"] = totalBytes / 1024;
                  jsonDoc["used_kb"] = usedBytes / 1024;
                  jsonDoc["free_kb"] = freeBytes / 1024;
                  jsonDoc["usage_percent"] = (usedBytes * 100) / totalBytes;
                  
                  // Log file specific info
                  jsonDoc["log_usage_bytes"] = logUsage;
                  jsonDoc["log_usage_kb"] = logUsage / 1024;
                  jsonDoc["log_limit_kb"] = 200;
                  jsonDoc["log_usage_percent"] = (logUsage * 100) / (200 * 1024);
                  
                  // Timeseries data info
                  size_t movementSize = movementData ? movementData->getDataSize() : 0;
                  size_t runoutSize = runoutData ? runoutData->getDataSize() : 0;
                  size_t connectionSize = connectionData ? connectionData->getDataSize() : 0;
                  size_t totalTimeseriesSize = movementSize + runoutSize + connectionSize;
                  
                  jsonDoc["timeseries"]["movement_kb"] = movementSize / 1024;
                  jsonDoc["timeseries"]["runout_kb"] = runoutSize / 1024;
                  jsonDoc["timeseries"]["connection_kb"] = connectionSize / 1024;
                  jsonDoc["timeseries"]["total_kb"] = totalTimeseriesSize / 1024;
                  jsonDoc["timeseries"]["limit_kb"] = 450; // 150KB * 3
                  jsonDoc["timeseries"]["usage_percent"] = (totalTimeseriesSize * 100) / (450 * 1024);
                  
                  jsonDoc["timeseries"]["movement_points"] = movementData ? movementData->getPointCount() : 0;
                  jsonDoc["timeseries"]["runout_points"] = runoutData ? runoutData->getPointCount() : 0;
                  jsonDoc["timeseries"]["connection_points"] = connectionData ? connectionData->getPointCount() : 0;

                  String jsonResponse;
                  serializeJson(jsonDoc, jsonResponse);
                  request->send(200, "application/json", jsonResponse);
              });

    // Human-readable storage page
    server.on("/storage/view", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  size_t totalBytes = LittleFS.totalBytes();
                  size_t usedBytes = LittleFS.usedBytes();
                  size_t freeBytes = totalBytes - usedBytes;
                  size_t logUsage = logger.getLogFileUsage();
                  
                  String html = "<!DOCTYPE html><html><head>";
                  html += "<title>System Health - Storage Information</title>";
                  html += "<style>";
                  html += "body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }";
                  html += ".container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }";
                  html += "h1 { color: #333; text-align: center; }";
                  html += ".storage-item { margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }";
                  html += ".storage-label { font-weight: bold; color: #555; }";
                  html += ".storage-value { color: #007bff; font-size: 1.1em; }";
                  html += ".progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 5px 0; }";
                  html += ".progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); transition: width 0.3s; }";
                  html += ".log-progress { background: linear-gradient(90deg, #17a2b8, #6f42c1); }";
                  html += ".nav-link { display: inline-block; margin: 10px 5px; padding: 8px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }";
                  html += ".nav-link:hover { background: #0056b3; }";
                  html += "</style></head><body>";
                  
                  html += "<div class='container'>";
                  html += "<h1>🖥️ System Health - Storage Information</h1>";
                  
                  // Navigation
                  html += "<div style='text-align: center; margin-bottom: 20px;'>";
                  html += "<a href='/' class='nav-link'>🏠 Home</a>";
                  html += "<a href='/logs/history' class='nav-link'>📋 View Logs</a>";
                  html += "<a href='/storage' class='nav-link'>📊 JSON Data</a>";
                  html += "</div>";
                  
                  // Filesystem Storage
                  html += "<div class='storage-item'>";
                  html += "<div class='storage-label'>💾 Filesystem Storage</div>";
                  html += "<div class='storage-value'>Total: " + String(totalBytes / 1024) + " KB (" + String(totalBytes) + " bytes)</div>";
                  html += "<div class='storage-value'>Used: " + String(usedBytes / 1024) + " KB (" + String(usedBytes) + " bytes)</div>";
                  html += "<div class='storage-value'>Free: " + String(freeBytes / 1024) + " KB (" + String(freeBytes) + " bytes)</div>";
                  
                  int usagePercent = (usedBytes * 100) / totalBytes;
                  html += "<div class='progress-bar'>";
                  html += "<div class='progress-fill' style='width: " + String(usagePercent) + "%'></div>";
                  html += "</div>";
                  html += "<div>Usage: " + String(usagePercent) + "%</div>";
                  html += "</div>";
                  
                  // Log Storage
                  html += "<div class='storage-item'>";
                  html += "<div class='storage-label'>📝 Log Storage</div>";
                  html += "<div class='storage-value'>Used: " + String(logUsage / 1024) + " KB (" + String(logUsage) + " bytes)</div>";
                  html += "<div class='storage-value'>Limit: 200 KB (204,800 bytes)</div>";
                  html += "<div class='storage-value'>Available: " + String((200 * 1024 - logUsage) / 1024) + " KB</div>";
                  
                  int logPercent = (logUsage * 100) / (200 * 1024);
                  html += "<div class='progress-bar'>";
                  html += "<div class='progress-fill log-progress' style='width: " + String(logPercent) + "%'></div>";
                  html += "</div>";
                  html += "<div>Log Usage: " + String(logPercent) + "%</div>";
                  html += "</div>";
                  
                  // Storage Breakdown
                  html += "<div class='storage-item'>";
                  html += "<div class='storage-label'>📁 Storage Breakdown</div>";
                  html += "<div>• Settings: ~1 KB</div>";
                  html += "<div>• WebUI Assets: Embedded in firmware</div>";
                  html += "<div>• Log Files: " + String(logUsage / 1024) + " KB</div>";
                  html += "<div>• Other Files: " + String((usedBytes - logUsage) / 1024) + " KB</div>";
                  html += "<p style='margin-top: 10px; font-size: 0.9em; color: #666;'>• Logs are automatically rotated when they exceed 200KB</p>";
                  html += "</div>";
                  
                  // Actions
                  html += "<div class='storage-item' style='text-align: center;'>";
                  html += "<div class='storage-label'>🔧 Actions</div>";
                  html += "<button onclick='clearLogs()' style='margin: 5px; padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;'>Clear All Logs</button>";
                  html += "<button onclick='location.reload()' style='margin: 5px; padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;'>Refresh</button>";
                  html += "</div>";
                  
                  html += "</div>";
                  
                  // JavaScript
                  html += "<script>";
                  html += "function clearLogs() {";
                  html += "  if (confirm('Are you sure you want to clear all logs?')) {";
                  html += "    fetch('/logs/clear', { method: 'POST' })";
                  html += "      .then(response => response.text())";
                  html += "      .then(data => { alert(data); location.reload(); })";
                  html += "      .catch(error => alert('Error: ' + error));";
                  html += "  }";
                  html += "}";
                  html += "</script>";
                  
                  html += "</body></html>";
                  
                  request->send(200, "text/html", html);
              });

    // Restart endpoint
    server.on("/restart", HTTP_POST,
              [](AsyncWebServerRequest *request)
              {
                  logger.log("Restart requested via WebUI");
                  request->send(200, "text/plain", "Restarting device...");
                  // Delay restart to allow response to be sent
                  delay(1000);
                  ESP.restart();
              });

    // Timeseries data endpoints
    server.on("/api/timeseries/movement", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  if (movementData) {
                      String data = movementData->getDataAsJSON(100);
                      request->send(200, "application/json", data);
                  } else {
                      request->send(500, "application/json", "{\"error\":\"Movement data not initialized\"}");
                  }
              });

    server.on("/api/timeseries/runout", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  if (runoutData) {
                      String data = runoutData->getDataAsJSON(100);
                      request->send(200, "application/json", data);
                  } else {
                      request->send(500, "application/json", "{\"error\":\"Runout data not initialized\"}");
                  }
              });

    server.on("/api/timeseries/connection", HTTP_GET,
              [](AsyncWebServerRequest *request)
              {
                  if (connectionData) {
                      String data = connectionData->getDataAsJSON(100);
                      request->send(200, "application/json", data);
                  } else {
                      request->send(500, "application/json", "{\"error\":\"Connection data not initialized\"}");
                  }
              });

    // Clear timeseries data endpoints
    server.on("/api/timeseries/clear", HTTP_POST,
              [](AsyncWebServerRequest *request)
              {
                  if (movementData) movementData->clearData();
                  if (runoutData) runoutData->clearData();
                  if (connectionData) connectionData->clearData();
                  request->send(200, "text/plain", "All timeseries data cleared");
              });

    // Favicon not embedded - browsers will handle gracefully without it
    
    // SPA fallback and asset serving
    server.onNotFound([](AsyncWebServerRequest *request) {
        String path = request->url();
        
        // Check if it's an API endpoint
        if (path.startsWith("/get_") || path.startsWith("/update_") || 
            path.startsWith("/sensor_") || path.startsWith("/logs/") || 
            path.startsWith("/version") || path.startsWith("/restart") || 
            path.startsWith("/storage/") || path.startsWith("/api/")) {
            request->send(404, "text/plain", "Not Found");
            return;
        }
        
        // Handle CSS files
        if (path.startsWith("/assets/") && path.endsWith(".css")) {
            AsyncWebServerResponse *response = request->beginResponse(200, webui_css_mime, webui_css_gz, webui_css_gz_len);
            if (webui_css_compressed) response->addHeader("Content-Encoding", "gzip");
            response->addHeader("Cache-Control", "max-age=31536000");
            request->send(response);
            return;
        }
        
        // Handle JS files
        if (path.startsWith("/assets/") && path.endsWith(".js")) {
            AsyncWebServerResponse *response = request->beginResponse(200, webui_js_mime, webui_js_gz, webui_js_gz_len);
            if (webui_js_compressed) response->addHeader("Content-Encoding", "gzip");
            response->addHeader("Cache-Control", "max-age=31536000");
            request->send(response);
            return;
        }
        
        // Serve embedded WebUI index file for all other routes (SPA fallback)
        AsyncWebServerResponse *response = request->beginResponse(200, webui_index_html_mime, webui_index_html_gz, webui_index_html_gz_len);
        if (webui_index_html_compressed) response->addHeader("Content-Encoding", "gzip");
        response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        request->send(response);
    });
}

void WebServer::loop()
{
    ElegantOTA.loop();
}