#!/bin/bash

# ESP32 Filament Sensor Firmware Build Script
# Builds firmware.bin for OTA updates with configuration options

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONFIG_FILE="config.json"
FIRMWARE_OUTPUT="firmware.bin"
BUILD_ENV="esp32-s3-dev"

echo -e "${BLUE}ESP32 Filament Sensor Firmware Builder${NC}"
echo "========================================"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PlatformIO is installed
if ! command -v pio &> /dev/null; then
    print_error "PlatformIO CLI not found. Please install PlatformIO first."
    echo "Install with: pip install platformio"
    exit 1
fi

# Function to create default config.json
create_default_config() {
    cat > "$CONFIG_FILE" << EOF
{
  "wifi": {
    "ssid": "YourWiFiNetwork",
    "password": "YourWiFiPassword",
    "ap_mode": false
  },
  "elegoo": {
    "ip_address": "192.168.1.100"
  },
  "timeouts": {
    "movement_timeout_ms": 20000,
    "first_layer_timeout_ms": 8000,
    "start_print_timeout_ms": 10000,
    "pause_verification_timeout_ms": 15000,
    "max_pause_retries": 5
  },
  "sensor": {
    "pause_on_runout": true,
    "enabled": true
  }
}
EOF
    print_success "Created default $CONFIG_FILE"
    print_warning "Please edit $CONFIG_FILE with your settings before building with config"
}

# Function to build firmware with config
build_with_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "$CONFIG_FILE not found!"
        echo "Would you like to create a default config file? (y/n)"
        read -r create_config
        if [[ $create_config =~ ^[Yy]$ ]]; then
            create_default_config
            echo "Please edit $CONFIG_FILE and run the script again."
            exit 0
        else
            print_error "Cannot build with config without $CONFIG_FILE"
            exit 1
        fi
    fi

    print_info "Building firmware with configuration from $CONFIG_FILE"
    
    # Read config values
    WIFI_SSID=$(jq -r '.wifi.ssid' "$CONFIG_FILE")
    WIFI_PASSWORD=$(jq -r '.wifi.password' "$CONFIG_FILE")
    ELEGOO_IP=$(jq -r '.elegoo.ip_address // "192.168.1.100"' "$CONFIG_FILE")
    AP_MODE=$(jq -r '.wifi.ap_mode // false' "$CONFIG_FILE")
    
    print_info "WiFi SSID: $WIFI_SSID"
    print_info "Elegoo IP: $ELEGOO_IP"
    print_info "AP Mode: $AP_MODE"
    
    # Set build flags based on config
    export PLATFORMIO_BUILD_FLAGS="-D WIFI_SSID=\\\"$WIFI_SSID\\\" -D WIFI_PASSWORD=\\\"$WIFI_PASSWORD\\\" -D ELEGOO_IP=\\\"$ELEGOO_IP\\\" -D AP_MODE=$AP_MODE"
}

# Function to build default firmware (AP mode)
build_default() {
    print_info "Building default firmware (AP mode enabled)"
    print_info "Device will create WiFi hotspot: ElegooXBTTSFS20"
    print_info "Connect to hotspot and configure WiFi via web interface"
    
    # Clear any existing build flags
    unset PLATFORMIO_BUILD_FLAGS
}


# Main menu
echo ""
echo "Build Options:"
echo "1) Default firmware (AP mode - no WiFi config needed)"
echo "2) Configured firmware (uses config.json for WiFi settings)"
echo "3) Create/edit config.json"
echo ""
echo -n "Select option (1-3): "
read -r choice

case $choice in
    1)
        build_default
        ;;
    2)
        build_with_config
        ;;
    3)
        if [ -f "$CONFIG_FILE" ]; then
            print_info "Current $CONFIG_FILE:"
            cat "$CONFIG_FILE"
            echo ""
            echo "Edit $CONFIG_FILE? (y/n)"
            read -r edit_config
            if [[ $edit_config =~ ^[Yy]$ ]]; then
                ${EDITOR:-nano} "$CONFIG_FILE"
            fi
        else
            create_default_config
        fi
        echo "Run the script again to build firmware."
        exit 0
        ;;
    *)
        print_error "Invalid option"
        exit 1
        ;;
esac

# Clean previous build
print_info "Cleaning previous build..."
pio run -e "$BUILD_ENV" --target clean

# Build firmware
print_info "Building firmware for $BUILD_ENV..."
pio run -e "$BUILD_ENV"

# Copy firmware to root directory
FIRMWARE_SOURCE=".pio/build/$BUILD_ENV/firmware.bin"

if [ -f "$FIRMWARE_SOURCE" ]; then
    cp "$FIRMWARE_SOURCE" "$FIRMWARE_OUTPUT"
    
    # Get firmware size
    FIRMWARE_SIZE=$(stat -f%z "$FIRMWARE_OUTPUT" 2>/dev/null || stat -c%s "$FIRMWARE_OUTPUT" 2>/dev/null)
    FIRMWARE_SIZE_KB=$((FIRMWARE_SIZE / 1024))
    
    print_success "Firmware built successfully!"
    echo ""
    echo "📁 Output: $FIRMWARE_OUTPUT"
    echo "📏 Size: ${FIRMWARE_SIZE_KB}KB"
    echo ""
    echo "🚀 OTA Update Instructions:"
    echo "1. Connect to your ESP32 device WiFi network"
    echo "2. Open web browser to: http://ccxsfs20.local/update"
    echo "3. Click 'Choose File' and select: $FIRMWARE_OUTPUT"
    echo "4. Click 'Update' and wait for completion"
    echo "5. Device will restart automatically"
    echo ""
    
    if [[ $choice == "1" ]]; then
        echo "🔧 First-time setup (AP mode firmware):"
        echo "1. After flashing, device will create WiFi hotspot"
        echo "2. Connect to: ElegooXBTTSFS20 (password: elegooccsfs20)"
        echo "3. Open browser to: http://192.168.4.1"
        echo "4. Configure your WiFi settings in Settings tab"
        echo "5. Device will connect to your WiFi network"
    fi
    
else
    print_error "Build failed - firmware.bin not found"
    exit 1
fi
