#include "TimeSeriesData.h"
#include "Logger.h"

extern unsigned long getTime();

TimeSeriesData::TimeSeriesData(const String& filePath) : 
    dataFilePath(filePath), 
    currentIndex(0), 
    totalPoints(0), 
    isCircularBuffer(false) {
    
    dataBuffer = new DataPoint[MAX_POINTS_PER_SERIES];
    loadDataFromFile();
}

TimeSeriesData::~TimeSeriesData() {
    writeDataToFile();
    delete[] dataBuffer;
}

void TimeSeriesData::addDataPoint(float value) {
    addDataPoint(getTime(), value);
}

void TimeSeriesData::addDataPoint(unsigned long timestamp, float value) {
    if (dataBuffer == nullptr) return;
    
    dataBuffer[currentIndex] = {timestamp, value};
    
    if (!isCircularBuffer) {
        totalPoints++;
        currentIndex++;
        
        if (currentIndex >= MAX_POINTS_PER_SERIES) {
            isCircularBuffer = true;
            currentIndex = 0;
            totalPoints = MAX_POINTS_PER_SERIES;
        }
    } else {
        currentIndex = (currentIndex + 1) % MAX_POINTS_PER_SERIES;
    }
    
    // Write to file periodically (every 10 points to reduce wear)
    if (totalPoints % 10 == 0) {
        writeDataToFile();
    }
}

void TimeSeriesData::writeDataToFile() {
    if (!LittleFS.begin()) return;
    
    File file = LittleFS.open(dataFilePath, "w");
    if (!file) return;
    
    DynamicJsonDocument doc(8192);
    doc["circular"] = isCircularBuffer;
    doc["currentIndex"] = currentIndex;
    doc["totalPoints"] = totalPoints;
    
    JsonArray dataArray = doc.createNestedArray("data");
    
    size_t pointsToSave = (totalPoints < MAX_POINTS_PER_SERIES) ? totalPoints : MAX_POINTS_PER_SERIES;
    
    if (isCircularBuffer) {
        // Save from currentIndex to end, then from 0 to currentIndex
        for (size_t i = currentIndex; i < MAX_POINTS_PER_SERIES; i++) {
            JsonObject point = dataArray.createNestedObject();
            point["t"] = dataBuffer[i].timestamp;
            point["v"] = dataBuffer[i].value;
        }
        for (size_t i = 0; i < currentIndex; i++) {
            JsonObject point = dataArray.createNestedObject();
            point["t"] = dataBuffer[i].timestamp;
            point["v"] = dataBuffer[i].value;
        }
    } else {
        // Save from 0 to currentIndex
        for (size_t i = 0; i < currentIndex; i++) {
            JsonObject point = dataArray.createNestedObject();
            point["t"] = dataBuffer[i].timestamp;
            point["v"] = dataBuffer[i].value;
        }
    }
    
    serializeJson(doc, file);
    file.close();
}

void TimeSeriesData::loadDataFromFile() {
    if (!LittleFS.begin()) return;
    
    File file = LittleFS.open(dataFilePath, "r");
    if (!file) return;
    
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) return;
    
    isCircularBuffer = doc["circular"] | false;
    currentIndex = doc["currentIndex"] | 0;
    totalPoints = doc["totalPoints"] | 0;
    
    JsonArray dataArray = doc["data"];
    size_t arrayIndex = 0;
    
    for (JsonObject point : dataArray) {
        if (arrayIndex >= MAX_POINTS_PER_SERIES) break;
        
        dataBuffer[arrayIndex].timestamp = point["t"];
        dataBuffer[arrayIndex].value = point["v"];
        arrayIndex++;
    }
}

String TimeSeriesData::getDataAsJSON(size_t maxPoints) {
    DynamicJsonDocument doc(4096);
    JsonArray dataArray = doc.createNestedArray("data");
    
    size_t pointsToReturn = (totalPoints < maxPoints) ? totalPoints : maxPoints;
    size_t step = (totalPoints / pointsToReturn > 1) ? (totalPoints / pointsToReturn) : 1;
    
    if (isCircularBuffer) {
        size_t startIndex = (currentIndex + MAX_POINTS_PER_SERIES - pointsToReturn * step) % MAX_POINTS_PER_SERIES;
        for (size_t i = 0; i < pointsToReturn; i++) {
            size_t index = (startIndex + i * step) % MAX_POINTS_PER_SERIES;
            JsonObject point = dataArray.createNestedObject();
            point["t"] = dataBuffer[index].timestamp;
            point["v"] = dataBuffer[index].value;
        }
    } else {
        size_t startIndex = ((int)(currentIndex - pointsToReturn * step) > 0) ? (currentIndex - pointsToReturn * step) : 0;
        for (size_t i = 0; i < pointsToReturn && (startIndex + i * step) < currentIndex; i++) {
            size_t index = startIndex + i * step;
            JsonObject point = dataArray.createNestedObject();
            point["t"] = dataBuffer[index].timestamp;
            point["v"] = dataBuffer[index].value;
        }
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

String TimeSeriesData::getRecentData(size_t minutes) {
    unsigned long cutoffTime = getTime() - (minutes * 60);
    
    DynamicJsonDocument doc(4096);
    JsonArray dataArray = doc.createNestedArray("data");
    
    if (isCircularBuffer) {
        for (size_t i = 0; i < MAX_POINTS_PER_SERIES; i++) {
            size_t index = (currentIndex + i) % MAX_POINTS_PER_SERIES;
            if (dataBuffer[index].timestamp >= cutoffTime) {
                JsonObject point = dataArray.createNestedObject();
                point["t"] = dataBuffer[index].timestamp;
                point["v"] = dataBuffer[index].value;
            }
        }
    } else {
        for (size_t i = 0; i < currentIndex; i++) {
            if (dataBuffer[i].timestamp >= cutoffTime) {
                JsonObject point = dataArray.createNestedObject();
                point["t"] = dataBuffer[i].timestamp;
                point["v"] = dataBuffer[i].value;
            }
        }
    }
    
    String result;
    serializeJson(doc, result);
    return result;
}

void TimeSeriesData::clearData() {
    currentIndex = 0;
    totalPoints = 0;
    isCircularBuffer = false;
    
    if (LittleFS.begin()) {
        LittleFS.remove(dataFilePath);
    }
}

size_t TimeSeriesData::getDataSize() {
    if (!LittleFS.begin()) return 0;
    
    File file = LittleFS.open(dataFilePath, "r");
    if (!file) return 0;
    
    size_t size = file.size();
    file.close();
    return size;
}

size_t TimeSeriesData::getPointCount() {
    return totalPoints;
}
