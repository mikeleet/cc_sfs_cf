#include "PauseAttemptData.h"
#include "Logger.h"

extern unsigned long getTime();

PauseAttemptData::PauseAttemptData(const String& filePath) : 
    dataFilePath(filePath), 
    currentIndex(0), 
    totalPoints(0), 
    isCircularBuffer(false) {
    
    dataBuffer = new PauseAttemptPoint[MAX_POINTS_PER_SERIES];
    loadDataFromFile();
}

PauseAttemptData::~PauseAttemptData() {
    writeDataToFile();
    delete[] dataBuffer;
}

void PauseAttemptData::addAttempt(PauseAttemptType type, int retryCount, int printStatus) {
    addAttempt(getTime(), type, retryCount, printStatus);
}

void PauseAttemptData::addAttempt(unsigned long timestamp, PauseAttemptType type, int retryCount, int printStatus) {
    if (dataBuffer == nullptr) return;
    
    dataBuffer[currentIndex] = {timestamp, type, retryCount, printStatus};
    
    currentIndex = (currentIndex + 1) % MAX_POINTS_PER_SERIES;
    
    if (!isCircularBuffer) {
        totalPoints++;
        if (totalPoints >= MAX_POINTS_PER_SERIES) {
            isCircularBuffer = true;
            totalPoints = MAX_POINTS_PER_SERIES;
        }
    }
    
    // Check if we need to rotate data to stay under size limit
    if (getDataSize() > MAX_DATA_SIZE) {
        rotateData();
    }
}

void PauseAttemptData::writeDataToFile() {
    if (!LittleFS.begin()) return;
    
    File file = LittleFS.open(dataFilePath, "w");
    if (!file) return;
    
    DynamicJsonDocument doc(8192);
    doc["currentIndex"] = currentIndex;
    doc["totalPoints"] = totalPoints;
    doc["isCircularBuffer"] = isCircularBuffer;
    
    JsonArray dataArray = doc.createNestedArray("data");
    
    size_t pointsToWrite = isCircularBuffer ? MAX_POINTS_PER_SERIES : totalPoints;
    size_t startIndex = isCircularBuffer ? currentIndex : 0;
    
    for (size_t i = 0; i < pointsToWrite; i++) {
        size_t index = (startIndex + i) % MAX_POINTS_PER_SERIES;
        JsonObject point = dataArray.createNestedObject();
        point["timestamp"] = dataBuffer[index].timestamp;
        point["type"] = (int)dataBuffer[index].type;
        point["retryCount"] = dataBuffer[index].retryCount;
        point["printStatus"] = dataBuffer[index].printStatus;
    }
    
    serializeJson(doc, file);
    file.close();
}

void PauseAttemptData::loadDataFromFile() {
    if (!LittleFS.begin()) return;
    
    File file = LittleFS.open(dataFilePath, "r");
    if (!file) return;
    
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) return;
    
    currentIndex = doc["currentIndex"] | 0;
    totalPoints = doc["totalPoints"] | 0;
    isCircularBuffer = doc["isCircularBuffer"] | false;
    
    JsonArray dataArray = doc["data"];
    size_t arraySize = dataArray.size();
    
    for (size_t i = 0; i < arraySize && i < MAX_POINTS_PER_SERIES; i++) {
        JsonObject point = dataArray[i];
        dataBuffer[i].timestamp = point["timestamp"];
        dataBuffer[i].type = (PauseAttemptType)(int)point["type"];
        dataBuffer[i].retryCount = point["retryCount"];
        dataBuffer[i].printStatus = point["printStatus"];
    }
}

String PauseAttemptData::getDataAsJSON(size_t maxPoints) {
    DynamicJsonDocument doc(4096);
    JsonArray dataArray = doc.createNestedArray("data");
    
    size_t pointsToReturn = min(maxPoints, totalPoints);
    size_t startIndex = isCircularBuffer ? 
        (currentIndex + MAX_POINTS_PER_SERIES - pointsToReturn) % MAX_POINTS_PER_SERIES : 
        (totalPoints > pointsToReturn ? totalPoints - pointsToReturn : 0);
    
    for (size_t i = 0; i < pointsToReturn; i++) {
        size_t index = isCircularBuffer ? 
            (startIndex + i) % MAX_POINTS_PER_SERIES : 
            startIndex + i;
            
        JsonObject point = dataArray.createNestedObject();
        point["timestamp"] = dataBuffer[index].timestamp;
        point["type"] = (int)dataBuffer[index].type;
        point["retryCount"] = dataBuffer[index].retryCount;
        point["printStatus"] = dataBuffer[index].printStatus;
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

String PauseAttemptData::getRecentData(size_t minutes) {
    unsigned long cutoffTime = getTime() - (minutes * 60);
    
    DynamicJsonDocument doc(4096);
    JsonArray dataArray = doc.createNestedArray("data");
    
    size_t pointsToCheck = totalPoints;
    size_t startIndex = isCircularBuffer ? currentIndex : 0;
    
    for (size_t i = 0; i < pointsToCheck; i++) {
        size_t index = isCircularBuffer ? 
            (startIndex + i) % MAX_POINTS_PER_SERIES : i;
            
        if (dataBuffer[index].timestamp >= cutoffTime) {
            JsonObject point = dataArray.createNestedObject();
            point["timestamp"] = dataBuffer[index].timestamp;
            point["type"] = (int)dataBuffer[index].type;
            point["retryCount"] = dataBuffer[index].retryCount;
            point["printStatus"] = dataBuffer[index].printStatus;
        }
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

String PauseAttemptData::getStatistics() {
    DynamicJsonDocument doc(2048);
    
    int initialAttempts = 0;
    int retryAttempts = 0;
    int successfulPauses = 0;
    int maxExceeded = 0;
    int alreadyPaused = 0;
    
    size_t pointsToCheck = totalPoints;
    size_t startIndex = isCircularBuffer ? currentIndex : 0;
    
    for (size_t i = 0; i < pointsToCheck; i++) {
        size_t index = isCircularBuffer ? 
            (startIndex + i) % MAX_POINTS_PER_SERIES : i;
            
        switch (dataBuffer[index].type) {
            case PAUSE_ATTEMPT_INITIAL:
                initialAttempts++;
                break;
            case PAUSE_ATTEMPT_RETRY:
                retryAttempts++;
                break;
            case PAUSE_ATTEMPT_SUCCESS:
                successfulPauses++;
                break;
            case PAUSE_ATTEMPT_MAX_EXCEEDED:
                maxExceeded++;
                break;
            case PAUSE_ATTEMPT_ALREADY_PAUSED:
                alreadyPaused++;
                break;
        }
    }
    
    doc["totalAttempts"] = totalPoints;
    doc["initialAttempts"] = initialAttempts;
    doc["retryAttempts"] = retryAttempts;
    doc["successfulPauses"] = successfulPauses;
    doc["maxExceeded"] = maxExceeded;
    doc["alreadyPaused"] = alreadyPaused;
    doc["dataSize"] = getDataSize();
    doc["maxDataSize"] = MAX_DATA_SIZE;
    
    String result;
    serializeJson(doc, result);
    return result;
}

void PauseAttemptData::clearData() {
    currentIndex = 0;
    totalPoints = 0;
    isCircularBuffer = false;
    if (LittleFS.begin()) {
        LittleFS.remove(dataFilePath);
    }
}

void PauseAttemptData::rotateData() {
    // Remove oldest 25% of data to stay under size limit
    size_t pointsToRemove = totalPoints / 4;
    if (pointsToRemove == 0) pointsToRemove = 1;
    
    // Shift data to remove oldest points
    for (size_t i = 0; i < totalPoints - pointsToRemove; i++) {
        size_t sourceIndex = isCircularBuffer ? 
            (currentIndex + pointsToRemove + i) % MAX_POINTS_PER_SERIES : 
            pointsToRemove + i;
        dataBuffer[i] = dataBuffer[sourceIndex];
    }
    
    totalPoints -= pointsToRemove;
    currentIndex = totalPoints;
    isCircularBuffer = false;
}

size_t PauseAttemptData::getDataSize() {
    if (!LittleFS.begin()) return 0;
    
    File file = LittleFS.open(dataFilePath, "r");
    if (!file) return 0;
    size_t size = file.size();
    file.close();
    return size;
}

size_t PauseAttemptData::getPointCount() {
    return totalPoints;
}
