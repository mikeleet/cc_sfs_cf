#ifndef PAUSEATTEMPTDATA_H
#define PAUSEATTEMPTDATA_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

enum PauseAttemptType {
    PAUSE_ATTEMPT_INITIAL = 0,    // Initial pause attempt
    PAUSE_ATTEMPT_RETRY = 1,      // Retry attempt
    PAUSE_ATTEMPT_SUCCESS = 2,    // Successful pause
    PAUSE_ATTEMPT_MAX_EXCEEDED = 3, // Max retries exceeded
    PAUSE_ATTEMPT_ALREADY_PAUSED = 4 // Attempted pause when already paused/idle
};

struct PauseAttemptPoint {
    unsigned long timestamp;
    PauseAttemptType type;
    int retryCount;
    int printStatus;  // Printer status at time of attempt
};

class PauseAttemptData {
private:
    static const size_t MAX_DATA_SIZE = 50 * 1024; // 50KB limit as requested
    static const size_t MAX_POINTS_PER_SERIES = 500; // Limit data points
    
    String dataFilePath;
    PauseAttemptPoint* dataBuffer;
    size_t currentIndex;
    size_t totalPoints;
    bool isCircularBuffer;
    
    void writeDataToFile();
    void loadDataFromFile();
    void rotateData();
    
public:
    PauseAttemptData(const String& filePath);
    ~PauseAttemptData();
    
    void addAttempt(PauseAttemptType type, int retryCount, int printStatus);
    void addAttempt(unsigned long timestamp, PauseAttemptType type, int retryCount, int printStatus);
    String getDataAsJSON(size_t maxPoints = 100);
    void clearData();
    size_t getDataSize();
    size_t getPointCount();
    
    // Get recent data points
    String getRecentData(size_t minutes = 60);
    
    // Get statistics
    String getStatistics();
};

#endif
