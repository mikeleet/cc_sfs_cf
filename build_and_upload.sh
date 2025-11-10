#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="/Users/mike/Documents/GitHub/non_sn/cc_sfs_cf"

echo -e "${BLUE}🚀 ESP32 Build and Upload Script${NC}"
echo -e "${BLUE}=================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Force device disconnect/reconnect
echo -e "\n${BLUE}Step 1: Force Device Disconnect/Reconnect${NC}"
echo "Attempting to reset USB connection..."

# Find ESP32 device
ESP_DEVICE=$(ls /dev/cu.wchusbserial* 2>/dev/null | head -1)
if [ -z "$ESP_DEVICE" ]; then
    ESP_DEVICE=$(ls /dev/cu.usbserial* 2>/dev/null | head -1)
fi

if [ -n "$ESP_DEVICE" ]; then
    print_status "Found ESP32 device: $ESP_DEVICE"
    
    # Try to reset the device using esptool
    echo "Resetting device..."
    python3 -m esptool --port "$ESP_DEVICE" --before default_reset chip_id 2>/dev/null || true
    
    # Wait a moment
    sleep 2
    print_status "Device reset completed"
else
    print_warning "No ESP32 device found, continuing anyway..."
fi

# Step 2: Build WebUI
echo -e "\n${BLUE}Step 2: Building WebUI${NC}"
cd "$PROJECT_DIR/webui"

if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found, installing..."
    npm install
fi

echo "Building WebUI..."
if npm run build; then
    print_status "WebUI build completed"
else
    print_error "WebUI build failed"
    exit 1
fi

# Step 2.5: Generate Embedded WebUI
echo -e "\n${BLUE}Step 2.5: Generating Embedded WebUI${NC}"
cd "$PROJECT_DIR"
echo "Generating embedded WebUI assets..."
if python3 generate_embedded_webui.py; then
    print_status "Embedded WebUI generation completed"
else
    print_error "Embedded WebUI generation failed"
    exit 1
fi

# Step 3: Build and Upload Firmware
echo -e "\n${BLUE}Step 3: Building and Uploading Firmware${NC}"
cd "$PROJECT_DIR"

echo "Cleaning previous build..."
platformio run --target clean

echo "Building firmware (this will embed the WebUI)..."
if platformio run; then
    print_status "Firmware build completed"
else
    print_error "Firmware build failed"
    exit 1
fi

echo "Performing complete flash erase (this will delete all settings)..."
if platformio run --target erase; then
    print_status "Flash erase completed"
else
    print_error "Flash erase failed"
    exit 1
fi

echo "Uploading firmware to device..."
if platformio run --target upload; then
    print_status "Firmware upload completed"
else
    print_error "Firmware upload failed"
    exit 1
fi

# Step 4: Wait for device to boot and show status
echo -e "\n${BLUE}Step 4: Device Status${NC}"
echo "Waiting for device to boot..."
sleep 5

# Try to detect device IP
echo "Attempting to find device..."
DEVICE_IP=""

# Try mDNS first
if ping -c 1 ccxsfs20.local >/dev/null 2>&1; then
    DEVICE_IP="ccxsfs20.local"
    print_status "Device found via mDNS: http://$DEVICE_IP"
else
    # Try to find IP in common ranges
    for ip in 192.168.0.{100..120} 192.168.1.{100..120}; do
        if timeout 1 bash -c "echo >/dev/tcp/$ip/80" 2>/dev/null; then
            # Check if it's our device by checking for version endpoint
            if curl -s --max-time 2 "http://$ip/version" | grep -q "firmware_version" 2>/dev/null; then
                DEVICE_IP="$ip"
                break
            fi
        fi
    done
    
    if [ -n "$DEVICE_IP" ]; then
        print_status "Device found at: http://$DEVICE_IP"
    else
        print_warning "Device IP not auto-detected. Check your router's DHCP table."
    fi
fi

# Show completion summary
echo -e "\n${GREEN}🎉 Clean Installation Complete!${NC}"
echo -e "${GREEN}====================================${NC}"

echo -e "\n${YELLOW}⚠️  IMPORTANT: Complete flash erase was performed${NC}"
echo -e "${YELLOW}All previous settings, WiFi credentials, and logs have been deleted.${NC}"
echo -e "${YELLOW}You will need to reconfigure the device from scratch.${NC}"

echo -e "\n${BLUE}Initial Setup Required:${NC}"
echo "1. Connect to WiFi network: ElegooXBTTSFS20 (password: elegooccsfs20)"
echo "2. Navigate to: http://192.168.4.1"
echo "3. Enter your WiFi credentials and printer IP address"
echo "4. Device will restart and connect to your network"

if [ -n "$DEVICE_IP" ]; then
    echo -e "\n${BLUE}After setup, access via:${NC}"
    echo -e "📱 WebUI: ${BLUE}http://$DEVICE_IP/${NC}"
    echo -e "🖥️ System Health: ${BLUE}http://$DEVICE_IP/storage${NC}"
    echo -e "📋 Logs: ${BLUE}http://$DEVICE_IP/logs/history${NC}"
    echo -e "⚙️  Settings: ${BLUE}http://$DEVICE_IP/settings${NC}"
else
    echo -e "\n${BLUE}After setup, access via:${NC}"
    echo -e "📱 WebUI: ${BLUE}http://ccxsfs20.local/${NC} or ${BLUE}http://[DEVICE_IP]/${NC}"
fi

echo -e "\n${YELLOW}New Features Available:${NC}"
echo "✅ System Health tab with comprehensive monitoring"
echo "✅ Device uptime display in Status tab"
echo "✅ Updated title with 'cfw 1.0.1'"
echo "✅ Enhanced About section with CFW info"
echo "✅ 400KB persistent logging with auto-rotation"
echo "✅ Comprehensive system health and storage monitoring"

echo -e "\n${BLUE}Happy coding! 🚀${NC}"
