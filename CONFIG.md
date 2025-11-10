# Configuration Guide

## Overview

The build system uses `config.json` to automatically configure firmware defaults during compilation. This allows you to customize WiFi credentials, Elegoo printer IP, and other settings without modifying source code.

## Setup

1. **Copy the example configuration:**
   ```bash
   cp config.json.example config.json
   ```

2. **Edit `config.json` with your settings:**
   ```json
   {
     "wifi": {
       "ssid": "your-wifi-name",
       "password": "your-wifi-password",
       "ap_mode": false
     },
     "elegoo": {
       "ip": "192.168.1.123"
     }
   }
   ```

3. **Build firmware:**
   ```bash
   platformio run
   ```

## Configuration Options

### WiFi Settings
- `wifi.ssid`: Your WiFi network name
- `wifi.password`: Your WiFi password  
- `wifi.ap_mode`: Set to `true` to start in AP mode

### Elegoo Printer Settings
- `elegoo.ip`: IP address of your Elegoo printer
- `elegoo.timeout`: Connection timeout (ms)
- `elegoo.first_layer_timeout`: First layer timeout (ms)
- `elegoo.start_print_timeout`: Print start timeout (ms)

### Device Settings
- `device.hostname`: Device hostname
- `device.mdns_name`: mDNS name (e.g., "device.local")

### Filament Sensor Settings
- `filament_sensor.pause_on_runout`: Enable pause on filament runout
- `filament_sensor.enabled`: Enable filament sensor
- `filament_sensor.pause_verification_timeout_ms`: Pause verification timeout
- `filament_sensor.max_pause_retries`: Maximum pause retry attempts

### Build Settings
- `build.firmware_version`: Firmware version string
- `build.chip_family`: Target chip family

## How It Works

During the PlatformIO build process:

1. The build script reads `config.json`
2. Updates `SettingsManager.cpp` with your values
3. Builds the WebUI with embedded configuration
4. Compiles firmware with your custom defaults

## Notes

- `config.json` is ignored by git (local only)
- If `config.json` doesn't exist, defaults are used
- Changes take effect on next firmware build
- The device will use these as **default** values - they can still be changed via WebUI

## Example: Carbon Centauri Setup

```json
{
  "wifi": {
    "ssid": "Carbon_Centauri_5G",
    "password": "your_password_here"
  },
  "elegoo": {
    "ip": "192.168.1.100"
  },
  "device": {
    "hostname": "elegoo-sfs-01"
  }
}
```
