import { createSignal, onMount } from 'solid-js'

interface VersionInfo {
  firmware_version: string
  build_date: string
  build_time: string
}

function About() {
  const [versionInfo, setVersionInfo] = createSignal<VersionInfo | null>(null)

  const fetchVersionInfo = async () => {
    try {
      const response = await fetch('/version')
      if (response.ok) {
        const data = await response.json()
        setVersionInfo(data)
      }
    } catch (err) {
      console.error('Failed to fetch version info:', err)
    }
  }

  onMount(fetchVersionInfo)

  return <div>
    <div class="mb-6">
      <h2 class="text-lg font-bold mb-2">Custom Firmware (CFW) 1.0.1</h2>
      <p class="mb-4">This is a <strong>custom firmware</strong> enhancement of the original project by <a class="link link-accent" href="https://github.com/jrowny">Jonathan Rowny</a>. The CFW adds advanced features and improvements:</p>
      
      <div class="mb-4">
        <h3 class="font-semibold mb-2">🚀 Latest Features (v1.0.1)</h3>
        <ul class="list-disc list-inside mb-4 space-y-1 text-sm">
          <li><strong>Historical Data Charts</strong> - Real-time timeseries visualization for movement, runout, and connection data</li>
          <li><strong>Enhanced System Health Monitoring</strong> - 450KB timeseries data storage (150KB per chart) with automatic rotation</li>
          <li><strong>Accurate Uptime Tracking</strong> - Precise device uptime calculation since NTP synchronization</li>
          <li><strong>Optimized Logging</strong> - Reduced to 200KB with improved rotation and human-readable timestamps</li>
        </ul>
      </div>
      
      <div class="mb-4">
        <h3 class="font-semibold mb-2">⚡ Core Enhancements</h3>
        <ul class="list-disc list-inside mb-4 space-y-1 text-sm">
          <li><strong>Enhanced WebUI</strong> - Embedded SolidJS SPA with modern responsive design</li>
          <li><strong>System Health Dashboard</strong> - Real-time system monitoring with visual progress bars and comprehensive metrics</li>
          <li><strong>Configuration System</strong> - Build-time configuration via config.json</li>
          <li><strong>Improved Stability</strong> - Enhanced pause verification and retry mechanisms with intelligent failure recovery</li>
          <li><strong>Single Binary Deployment</strong> - Complete WebUI embedded in firmware for easy updates</li>
        </ul>
      </div>
      
      <div class="mb-4">
        <h3 class="font-semibold mb-2">🔄 Smart Pause Mechanism</h3>
        <div class="bg-base-200 p-4 rounded-lg text-sm space-y-2">
          <p><strong>How it works:</strong></p>
          <ul class="list-disc list-inside space-y-1 ml-4">
            <li><strong>Detection:</strong> When filament runout or movement stoppage is detected, the system sends a pause command via WebSocket to the Elegoo printer</li>
            <li><strong>Verification:</strong> The system monitors the printer's status response to confirm the pause was successful (PAUSED/PAUSING state)</li>
            <li><strong>Retry Logic:</strong> If pause verification fails, the system automatically retries up to 3 times with a 15-second timeout between attempts</li>
            <li><strong>State Management:</strong> Prevents duplicate pause commands while verification is in progress and resets retry counters on successful operations</li>
            <li><strong>Recovery:</strong> Automatically resets pause state on printer disconnect, successful pause confirmation, or print resume</li>
          </ul>
          <p class="mt-2"><strong>Why this matters:</strong> This ensures reliable filament detection on subsequent print failures, solving the common issue where printers only pause on the first detection but ignore later runout events.</p>
        </div>
      </div>
      
      <div class="bg-info/10 p-3 rounded-lg mb-4">
        <p class="text-sm">
          <strong>🔗 Source Code:</strong> <a class="link link-accent" href="https://github.com/mikeleet/cc_sfs_cf" target="_blank">github.com/mikeleet/cc_sfs_cf</a>
        </p>
      </div>
      
      {versionInfo() && (
        <div class="bg-base-200 p-4 rounded-lg mb-4">
          <h3 class="font-semibold mb-2">Build Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm font-mono">
            <div><span class="font-sans">Version:</span> {versionInfo()!.firmware_version}</div>
            <div><span class="font-sans">Built:</span> {versionInfo()!.build_date}</div>
            <div><span class="font-sans">Time:</span> {versionInfo()!.build_time}</div>
          </div>
        </div>
      )}
    </div>

    <p class="mb-4">This free and opensource software was originally made by <a class="link link-accent" href="https://github.com/jrowny">Jonathan Rowny</a> based on several amazing projects. It is in no way officially affiliated with Elegoo or BigTreeTech.</p>
    <h2 class="text-lg font-bold mt-4 mb-4">Credits</h2>
    <ul>
      <li><a class="link link-accent" target="_blank" href="https://github.com/QuinnDamerell/OctoPrint-OctoEverywhere">OctoEverywhere</a> - ideas on how to use Centauri Carbon websocket protocol</li>
      <li><a class="link link-accent" target="_blank" href="https://suchmememanyskill.github.io/OpenCentauri/">OpenCentauri</a> - general information about the Centauri Carbon</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/cbd-tech/SDCP-Smart-Device-Control-Protocol-V3.0.0/tree/main">Smart Device Control Protocol</a> - WS control protocol used by Elegoo Centauri Carbon</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/bblanchon/ArduinoJson">ArduinoJSON</a> - JSON library</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/me-no-dev/ESPAsyncWebServer">ESPAsyncWebServer</a> - webserver</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/Links2004/arduinoWebSockets">WebSocket Client</a> - websockets</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/robtillaart/UUID">UUID</a> - uuids</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/ayushsharma82/ElegantOTA">ElegantOTA</a> - firmware updater</li>
      <li><a class="link link-accent" target="_blank" href="https://www.solidjs.com/">Solid-JS</a> - frontend library</li>
      <li><a class="link link-accent" target="_blank" href="https://tailwindcss.com/">TailwindCSS</a> - css framework</li>
      <li><a class="link link-accent" target="_blank" href="https://daisyui.com/">DaisyUI</a> - ui framework</li>
      <li><a class="link link-accent" target="_blank" href="https://vitejs.dev/">Vite</a> - frontend build tool</li>
      <li><a class="link link-accent" target="_blank" href="https://www.typescriptlang.org/">TypeScript</a> - programming language</li>
      <li><a class="link link-accent" target="_blank" href="https://platformio.org/">PlatformIO</a> - build tool</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/espressif/arduino-esp32">Arduino ESP32</a> - Arduino ESP Framework</li>
      <li><a class="link link-accent" target="_blank" href="https://github.com/bigtreetech/smart-filament-detection-module">Smart Filament Detection Module</a> - filament detection module</li>
    </ul>
  </div>
}

export default About