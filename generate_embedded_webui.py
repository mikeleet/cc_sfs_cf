#!/usr/bin/env python3
"""
Standalone script to generate embedded WebUI files for ESP32 firmware
"""
import os
import gzip
import json

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

def main():
    print("=" * 50)
    print("Generating Embedded WebUI...")
    print("=" * 50)
    
    # Get project directory
    project_dir = os.path.dirname(os.path.abspath(__file__))
    webui_dir = os.path.join(project_dir, "webui")
    dist_dir = os.path.join(webui_dir, "dist")
    
    if not os.path.exists(dist_dir):
        print(f"❌ WebUI dist directory not found: {dist_dir}")
        print("Please run 'cd webui && npm run build' first")
        return False
    
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
    
    return embedded_count > 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
