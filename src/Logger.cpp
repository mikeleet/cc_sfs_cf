#include "Logger.h"
#include "time.h"

// External function to get current time (from main.cpp)
extern unsigned long getTime();

// Define the static constant
const char* Logger::LOG_FILE_PATH = "/system_logs.txt";

Logger &Logger::getInstance()
{
  static Logger instance;
  return instance;
}

Logger::Logger()
{
  currentIndex = 0;
  totalEntries = 0;
  uuidGenerator.generate();
}

void Logger::log(const String &message)
{
  // Print to serial first
  Serial.println(message);

  // Generate UUID for this log entry
  uuidGenerator.generate();
  String uuid = String(uuidGenerator.toCharArray());

  // Get current timestamp
  unsigned long timestamp = getTime();

  // Store in circular buffer
  logBuffer[currentIndex].uuid = uuid;
  logBuffer[currentIndex].timestamp = timestamp;
  logBuffer[currentIndex].message = message;

  // Update indices
  currentIndex = (currentIndex + 1) % MAX_LOG_ENTRIES;
  if (totalEntries < MAX_LOG_ENTRIES)
  {
    totalEntries++;
  }

  // Write to persistent log file
  String formattedTimestamp = formatTimestamp(timestamp);
  writeLogToFile(formattedTimestamp, message);
}

void Logger::log(const char *message)
{
  log(String(message));
}

void Logger::logf(const char *format, ...)
{
  char buffer[512];
  va_list args;
  va_start(args, format);
  vsnprintf(buffer, sizeof(buffer), format, args);
  va_end(args);
  log(String(buffer));
}

String Logger::getLogsAsJson()
{
  DynamicJsonDocument jsonDoc(8192); // Allocate enough space for logs
  JsonArray logsArray = jsonDoc.createNestedArray("logs");

  // If we have less than MAX_LOG_ENTRIES, start from 0
  // Otherwise, start from currentIndex (oldest entry)
  int startIndex = (totalEntries < MAX_LOG_ENTRIES) ? 0 : currentIndex;
  int count = totalEntries;

  for (int i = 0; i < count; i++)
  {
    int bufferIndex = (startIndex + i) % MAX_LOG_ENTRIES;

    JsonObject logEntry = logsArray.createNestedObject();
    logEntry["uuid"] = logBuffer[bufferIndex].uuid;
    logEntry["timestamp"] = logBuffer[bufferIndex].timestamp;
    logEntry["message"] = logBuffer[bufferIndex].message;
  }

  String jsonResponse;
  serializeJson(jsonDoc, jsonResponse);
  return jsonResponse;
}

void Logger::clearLogs()
{
  currentIndex = 0;
  totalEntries = 0;
  // Clear the buffer
  for (int i = 0; i < MAX_LOG_ENTRIES; i++)
  {
    logBuffer[i].uuid = "";
    logBuffer[i].timestamp = 0;
    logBuffer[i].message = "";
  }
}

int Logger::getLogCount()
{
  return totalEntries;
}

void Logger::writeLogToFile(const String &timestamp, const String &message)
{
  // Check if we need to rotate the log file when it exceeds the limit
  if (getLogFileSize() > MAX_LOG_FILE_SIZE)
  {
    rotateLogFile();
  }

  // Open log file for appending
  File logFile = LittleFS.open(LOG_FILE_PATH, "a");
  if (logFile)
  {
    // Write human-readable log entry
    logFile.printf("[%s] %s\n", timestamp.c_str(), message.c_str());
    logFile.close();
  }
}

void Logger::rotateLogFile()
{
  // Simply delete the current log file when it exceeds the limit
  // No backup file to save storage space
  if (LittleFS.exists(LOG_FILE_PATH))
  {
    LittleFS.remove(LOG_FILE_PATH);
  }
}

String Logger::formatTimestamp(unsigned long timestamp)
{
  if (timestamp == 0)
  {
    return "00:00:00";
  }
  
  // Convert to hours, minutes, seconds
  unsigned long hours = (timestamp / 3600) % 24;
  unsigned long minutes = (timestamp / 60) % 60;
  unsigned long seconds = timestamp % 60;
  
  char timeStr[16];
  snprintf(timeStr, sizeof(timeStr), "%02lu:%02lu:%02lu", hours, minutes, seconds);
  return String(timeStr);
}

size_t Logger::getLogFileSize()
{
  File logFile = LittleFS.open(LOG_FILE_PATH, "r");
  if (logFile)
  {
    size_t size = logFile.size();
    logFile.close();
    return size;
  }
  return 0;
}

String Logger::getLogFileContents()
{
  String contents = "";
  
  // Read current log file only (no backup file)
  File logFile = LittleFS.open(LOG_FILE_PATH, "r");
  if (logFile)
  {
    contents += logFile.readString();
    logFile.close();
  }
  
  return contents;
}

void Logger::clearLogFile()
{
  // Remove current log file only (no backup file)
  if (LittleFS.exists(LOG_FILE_PATH))
  {
    LittleFS.remove(LOG_FILE_PATH);
  }
}

size_t Logger::getLogFileUsage()
{
  // Return only current log file size (no backup file)
  return getLogFileSize();
}