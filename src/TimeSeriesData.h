#ifndef TIMESERIESDATA_H
#define TIMESERIESDATA_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

struct DataPoint {
    unsigned long timestamp;
    float value;
};

class TimeSeriesData {
private:
    static const size_t MAX_DATA_SIZE = 150 * 1024; // 150KB per series
    static const size_t MAX_POINTS_PER_SERIES = 1000; // Limit data points
    
    String dataFilePath;
    DataPoint* dataBuffer;
    size_t currentIndex;
    size_t totalPoints;
    bool isCircularBuffer;
    
    void writeDataToFile();
    void loadDataFromFile();
    void rotateData();
    
public:
    TimeSeriesData(const String& filePath);
    ~TimeSeriesData();
    
    void addDataPoint(float value);
    void addDataPoint(unsigned long timestamp, float value);
    String getDataAsJSON(size_t maxPoints = 100);
    void clearData();
    size_t getDataSize();
    size_t getPointCount();
    
    // Get recent data points
    String getRecentData(size_t minutes = 60);
};

#endif
