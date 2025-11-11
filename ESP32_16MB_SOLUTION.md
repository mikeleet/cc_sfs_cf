# ESP32-S3 16MB Flash Configuration - Complete Solution

## Hardware Used
**Development Board**: ESP32-S3-DevKitC-1  
**Module**: ESP32-S3-WROOM-1-N16R8 (or N16R8V)
- **Flash**: 16MB (Quad SPI, DIO/QIO mode)
- **PSRAM**: 8MB (Octal SPI)
- **Form Factor**: 44-pin with Type-C USB
- **Part Number**: Look for "N16R8" or "N16R8V" marking on the module

**⚠️ Critical**: Standard ESP32-S3-DevKitC-1 boards typically come with 8MB flash (N8 variant). You specifically need the N16R8/N16R8V variant for this 16MB configuration.

## Problem
ESP32-S3-WROOM-1-N16R8V boards (16MB flash, 8MB PSRAM) were causing boot loops when using custom partition tables, despite PlatformIO showing 16MB flash detection.

## Root Cause
PlatformIO's default `esp32-s3-devkitc-1` board definition only supports 8MB flash. Attempting to override flash size or use custom partitions resulted in boot failures.

## Working Solution

### Step 1: Create Custom Board Definition

Create `boards/esp32-s3-devkitc-1-n16r8v.json`:

```json
{
  "build": {
    "arduino": {
      "ldscript": "esp32s3_out.ld",
      "partitions": "default_16MB.csv",
      "memory_type": "qio_opi"
    },
    "core": "esp32",
    "extra_flags": [
      "-DARDUINO_ESP32S3_DEV",
      "-DARDUINO_RUNNING_CORE=1",
      "-DARDUINO_EVENT_RUNNING_CORE=1",
      "-DBOARD_HAS_PSRAM"
    ],
    "f_cpu": "240000000L",
    "f_flash": "80000000L",
    "flash_mode": "qio",
    "hwids": [
      [
        "0x303A",
        "0x1001"
      ]
    ],
    "mcu": "esp32s3",
    "variant": "esp32s3"
  },
  "connectivity": [
    "wifi",
    "bluetooth"
  ],
  "debug": {
    "default_tool": "esp-builtin",
    "onboard_tools": [
      "esp-builtin"
    ],
    "openocd_target": "esp32s3.cfg"
  },
  "frameworks": [
    "arduino",
    "espidf"
  ],
  "name": "Espressif ESP32-S3-DevKitC-1-N16R8V (16 MB QD, 8MB PSRAM)",
  "upload": {
    "flash_size": "16MB",
    "maximum_ram_size": 327680,
    "maximum_size": 16777216,
    "require_upload_port": true,
    "speed": 921600
  },
  "url": "https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/hw-reference/esp32s3/user-guide-devkitc-1.html",
  "vendor": "Espressif"
}
```

### Step 2: Update platformio.ini

```ini
[env:esp32-s3-devkitc-1]
platform = espressif32
board = esp32-s3-devkitc-1-n16r8v  # Custom 16MB board
framework = arduino
board_build.filesystem = littlefs
# Do NOT add custom partitions - use default_16MB.csv from board definition
build_flags = ${common.build_flags}
lib_deps = ${common.lib_deps}
upload_protocol = esptool
monitor_speed = 115200
extra_scripts = build_webui.py
```

### Step 3: Build and Flash

```bash
./build_and_upload.sh
```

## Results

### Before (8MB Configuration)
- LittleFS: **896KB**
- Log capacity: 512KB
- Boot: Stable

### After (16MB Configuration)
- LittleFS: **3.4MB** (4x larger!)
- Log capacity: 1.5MB (3x larger!)
- Total flash: 16MB
- PSRAM: 8MB enabled
- Boot: Stable, no loops

## Storage Breakdown

```
💾 ESP32 Flash (16MB total):
├── Bootloader (~32KB)
├── Partition Table (~4KB)
├── Firmware + WebUI (~1098KB)
├── LittleFS Filesystem (3456KB) ← 4x larger!
│   ├── Logs (1536KB limit)
│   ├── Settings (~1KB)
│   └── Timeseries data (450KB)
└── OTA Partitions (~6MB)
```

## Key Learnings

### What Works ✅
1. **Custom board definition** - Essential for >8MB flash
2. **Default partition table** - ESP32's `default_16MB.csv` is reliable
3. **No flash size overrides** - Board definition handles it properly
4. **PSRAM support** - `-DBOARD_HAS_PSRAM` flag enables 8MB

### What Doesn't Work ❌
1. Overriding flash size on 8MB board definition
2. Custom partition tables (alignment issues)
3. Trying to maximize every byte (causes instability)
4. Multiple boot loops from custom partitions

## Troubleshooting

### Boot Loop After Flashing
- **Symptom**: Device resets at `entry 0x403c98d0`
- **Cause**: Custom partition table issues
- **Solution**: Use default partition (comment out `board_build.partitions`)

### Build Errors
- **Symptom**: `InvalidBoardManifest` error
- **Cause**: Malformed or missing board JSON
- **Solution**: Verify JSON syntax and file location

### Wrong Flash Size Detected
- **Symptom**: Shows 8MB instead of 16MB
- **Cause**: Using wrong board definition
- **Solution**: Ensure board = `esp32-s3-devkitc-1-n16r8v`

## Credits

Solution derived from:
- PlatformIO Community Forums (user: maxgerhardt)
- GitHub PR: [platformio/platform-espressif32 #921](https://github.com/platformio/platform-espressif32/pull/921)
- Espressif ESP32-S3 Technical Documentation

## Summary

**The secret**: Don't fight PlatformIO's defaults. Create a proper board definition and let the built-in 16MB partition table do its job. Result: 4x storage increase with zero boot issues.
