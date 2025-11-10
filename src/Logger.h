#ifndef LOGGER_H
#define LOGGER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <UUID.h>
#include <LittleFS.h>

struct LogEntry
{
  String uuid;
  unsigned long timestamp;
  String message;
};

class Logger
{
private:
  static const int MAX_LOG_ENTRIES = 50;
  static const size_t MAX_LOG_FILE_SIZE = 200 * 1024; // 200KB
  static const char* LOG_FILE_PATH;
  
  LogEntry logBuffer[MAX_LOG_ENTRIES];
  int currentIndex;
  int totalEntries;
  UUID uuidGenerator;
  
  void writeLogToFile(const String &timestamp, const String &message);
  void rotateLogFile();
  String formatTimestamp(unsigned long timestamp);
  size_t getLogFileSize();

  Logger();

  // Delete copy constructor and assignment operator
  Logger(const Logger &) = delete;
  Logger &operator=(const Logger &) = delete;

public:
  // Singleton access method
  static Logger &getInstance();

  void log(const String &message);
  void log(const char *message);
  void logf(const char *format, ...);
  String getLogsAsJson();
  String getLogFileContents();
  void clearLogs();
  void clearLogFile();
  int getLogCount();
  size_t getLogFileUsage();
};

// Convenience macro for easier access
#define logger Logger::getInstance()

#endif // LOGGER_H