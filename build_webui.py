Import("env")
import os
import subprocess
import gzip
import binascii
import json

def load_config(project_dir):
    """Load configuration from config.json"""
    config_path = os.path.join(project_dir, "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            print(f"✅ Loaded configuration from {config_path}")
            return config
        except Exception as e:
            print(f"⚠️  Failed to load config.json: {e}")
    else:
        print("⚠️  config.json not found, using defaults")
    return {}

def update_settings_defaults(project_dir, config):
    """Update SettingsManager.cpp with config values"""
    if not config:
        return
        
    settings_path = os.path.join(project_dir, "src", "SettingsManager.cpp")
    if not os.path.exists(settings_path):
        print("⚠️  SettingsManager.cpp not found")
        return
        
    try:
        with open(settings_path, 'r') as f:
            content = f.read()
        
        # Update WiFi defaults if provided
        wifi_config = config.get("wifi", {})
        if "ssid" in wifi_config:
            content = content.replace(
                'settings.ssid                = "lee";',
                f'settings.ssid                = "{wifi_config["ssid"]}";'
            )
        if "password" in wifi_config:
            content = content.replace(
                'settings.passwd              = "qqqqqqqq";',
                f'settings.passwd              = "{wifi_config["password"]}";'
            )
        if "ap_mode" in wifi_config:
            ap_mode_str = "true" if wifi_config["ap_mode"] else "false"
            content = content.replace(
                'settings.ap_mode             = false;',
                f'settings.ap_mode             = {ap_mode_str};'
            )
            
        # Update Elegoo defaults if provided
        elegoo_config = config.get("elegoo", {})
        if "ip" in elegoo_config:
            content = content.replace(
                'settings.elegooip            = "192.168.1.123";',
                f'settings.elegooip            = "{elegoo_config["ip"]}";'
            )
        if "timeout" in elegoo_config:
            content = content.replace(
                'settings.timeout             = 4000;',
                f'settings.timeout             = {elegoo_config["timeout"]};'
            )
        if "first_layer_timeout" in elegoo_config:
            content = content.replace(
                'settings.first_layer_timeout = 8000;',
                f'settings.first_layer_timeout = {elegoo_config["first_layer_timeout"]};'
            )
        if "start_print_timeout" in elegoo_config:
            content = content.replace(
                'settings.start_print_timeout = 10000;',
                f'settings.start_print_timeout = {elegoo_config["start_print_timeout"]};'
            )
            
        # Update filament sensor defaults if provided
        sensor_config = config.get("filament_sensor", {})
        if "pause_on_runout" in sensor_config:
            pause_str = "true" if sensor_config["pause_on_runout"] else "false"
            content = content.replace(
                'settings.pause_on_runout     = true;',
                f'settings.pause_on_runout     = {pause_str};'
            )
        if "enabled" in sensor_config:
            enabled_str = "true" if sensor_config["enabled"] else "false"
            content = content.replace(
                'settings.enabled             = true;',
                f'settings.enabled             = {enabled_str};'
            )
        if "pause_verification_timeout_ms" in sensor_config:
            content = content.replace(
                'settings.pause_verification_timeout_ms = 15000;',
                f'settings.pause_verification_timeout_ms = {sensor_config["pause_verification_timeout_ms"]};'
            )
        if "max_pause_retries" in sensor_config:
            content = content.replace(
                'settings.max_pause_retries   = 5;',
                f'settings.max_pause_retries   = {sensor_config["max_pause_retries"]};'
            )
        
        with open(settings_path, 'w') as f:
            f.write(content)
        print("✅ Updated SettingsManager.cpp with config values")
        
    except Exception as e:
        print(f"⚠️  Failed to update SettingsManager.cpp: {e}")

def build_and_embed_webui(target, source, env):
    """Build WebUI and embed it in firmware"""
    print("=" * 50)
    print("Building and embedding WebUI...")
    print("=" * 50)
    
    # Get project directory
    project_dir = env.get("PROJECT_DIR")
    webui_dir = os.path.join(project_dir, "webui")
    dist_dir = os.path.join(webui_dir, "dist")
    
    # Load and apply configuration
    config = load_config(project_dir)
    update_settings_defaults(project_dir, config)
    
    # Step 1: Build WebUI
    print("Step 1: Building WebUI...")
    if os.path.exists(webui_dir) and os.path.exists(os.path.join(webui_dir, "package.json")):
        try:
            os.chdir(webui_dir)
            result = subprocess.run(["npm", "run", "build"], 
                                  capture_output=True, text=True, check=True)
            print("✅ WebUI build completed successfully")
            os.chdir(project_dir)
        except subprocess.CalledProcessError as e:
            print(f"❌ WebUI build failed: {e}")
            print(f"Error output: {e.stderr}")
            os.chdir(project_dir)
        except FileNotFoundError:
            print("❌ npm not found, skipping WebUI build")
    else:
        print("❌ WebUI directory or package.json not found")
    
    # Step 2: Embed WebUI files
    print("Step 2: Embedding WebUI files...")
    
    def file_to_progmem(file_path, var_name, compress=True):
        """Convert a file to C++ PROGMEM array"""
        with open(file_path, 'rb') as f:
            data = f.read()
        
        # Compress if requested and beneficial
        if compress and len(data) > 100:
            data = gzip.compress(data)
            var_name += "_gz"
        
        # Convert to hex array
        hex_data = ', '.join(f'0x{b:02x}' for b in data)
        
        # Generate C++ code
        cpp_code = f"""
// Auto-generated from {os.path.basename(file_path)}
const uint8_t {var_name}[] PROGMEM = {{
    {hex_data}
}};
const size_t {var_name}_len = {len(data)};
"""
        return cpp_code, compress
    
    # Generate header content
    header_content = """#ifndef EMBEDDED_WEBUI_H
#define EMBEDDED_WEBUI_H

#include <Arduino.h>

"""
    
    # Files to embed - check what actually exists
    files_to_check = [
        ("index.html", "webui_index_html"),
    ]
    
    # Find CSS and JS files dynamically
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        for file in os.listdir(assets_dir):
            if file.endswith('.css'):
                files_to_check.append((f"assets/{file}", "webui_css"))
            elif file.endswith('.js'):
                files_to_check.append((f"assets/{file}", "webui_js"))
    
    # Add favicon if it exists (might be in assets or root)
    favicon_paths = ["favicon.ico", "assets/favicon.ico"]
    for favicon_path in favicon_paths:
        if os.path.exists(os.path.join(dist_dir, favicon_path)):
            files_to_check.append((favicon_path, "webui_favicon"))
            break
    
    # Process each file that exists
    embedded_count = 0
    for file_path, var_name in files_to_check:
        full_path = os.path.join(dist_dir, file_path)
        if os.path.exists(full_path):
            print(f"  📦 Embedding {file_path}...")
            try:
                cpp_code, is_compressed = file_to_progmem(full_path, var_name)
                header_content += cpp_code
                
                # Add MIME type info
                if file_path.endswith('.html') or file_path.endswith('.htm'):
                    mime_type = "text/html"
                elif file_path.endswith('.css'):
                    mime_type = "text/css"
                elif file_path.endswith('.js'):
                    mime_type = "application/javascript"
                elif file_path.endswith('.ico'):
                    mime_type = "image/x-icon"
                else:
                    mime_type = "application/octet-stream"
                
                header_content += f'const char {var_name}_mime[] = "{mime_type}";\n'
                header_content += f'const bool {var_name}_compressed = {"true" if is_compressed else "false"};\n\n'
                embedded_count += 1
            except Exception as e:
                print(f"  ❌ Failed to embed {file_path}: {e}")
        else:
            print(f"  ⚠️  File not found: {file_path}")
    
    header_content += """#endif // EMBEDDED_WEBUI_H
"""
    
    # Write header file
    header_path = os.path.join(project_dir, "src", "EmbeddedWebUI.h")
    with open(header_path, 'w') as f:
        f.write(header_content)
    
    print(f"✅ Generated {header_path} with {embedded_count} embedded files")
    print("=" * 50)

# Register the build scripts
env.AddPreAction("buildprog", build_and_embed_webui)
