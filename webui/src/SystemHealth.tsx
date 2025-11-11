import { createSignal, onMount } from 'solid-js'

interface StorageInfo {
  total_kb: number
  total_mb: number
  used_kb: number
  free_kb: number
  usage_percent: number
  log_usage_kb: number
  log_limit_kb: number
  log_usage_percent: number
  timeseries: {
    movement_kb: number
    runout_kb: number
    connection_kb: number
    pause_attempts_kb: number
    total_kb: number
    limit_kb: number
    usage_percent: number
    movement_points: number
    runout_points: number
    connection_points: number
    pause_attempt_points: number
  }
}

interface SystemHealth {
  memory: {
    total_kb: number
    free_kb: number
    used_kb: number
    usage_percent: number
    largest_free_block_kb: number
  }
  cpu: {
    frequency_mhz: number
    cores: number
  }
  flash: {
    total_kb: number
    free_kb: number
    used_kb: number
    usage_percent: number
  }
  wifi: {
    ssid: string
    rssi: number
    signal_strength: string
    ip_address: string
    mac_address: string
  }
  uptime: {
    seconds: number
    formatted: string
  }
}

function SystemHealth() {
  const [storageInfo, setStorageInfo] = createSignal<StorageInfo | null>(null)
  const [systemHealth, setSystemHealth] = createSignal<SystemHealth | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const fetchStorageInfo = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/storage')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setStorageInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch storage info')
    } finally {
      setLoading(false)
    }
  }

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/system_health')
      if (response.ok) {
        const data = await response.json()
        setSystemHealth(data)
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err)
    }
  }

  const fetchAllData = async () => {
    await Promise.all([fetchStorageInfo(), fetchSystemHealth()])
  }

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/logs/clear', { method: 'POST' })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      alert('All logs cleared successfully')
      fetchAllData() // Refresh all data
    } catch (err) {
      alert(`Error clearing logs: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const clearAllStorage = async () => {
    if (!confirm('Are you sure you want to clear ALL storage (logs + timeseries data)? This will delete all historical data and cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/storage/clear_all', { method: 'POST' })
      if (!response.ok) {
        throw new Error('Failed to clear all storage')
      }
      
      // Refresh data after clearing
      await fetchAllData()
    } catch (err: any) {
      console.error('Error clearing all storage:', err)
    }
  }

  onMount(fetchAllData)

  return (
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">System Health</h2>
        <button
          class="btn btn-primary btn-sm"
          onClick={fetchAllData}
          disabled={loading()}
        >
          {loading() ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error() && (
        <div class="alert alert-error">
          <span>{error()}</span>
        </div>
      )}

      {loading() && !storageInfo() && (
        <div class="flex justify-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {systemHealth() && (
        <div>
          <h3 class="text-xl font-bold mb-4">🖥️ System Information</h3>
          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Memory */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">🧠 Memory</h3>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span>Total:</span>
                    <span>{systemHealth()!.memory.total_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Used:</span>
                    <span>{systemHealth()!.memory.used_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Free:</span>
                    <span>{systemHealth()!.memory.free_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      class="bg-blue-600 h-2.5 rounded-full"
                      style={`width: ${systemHealth()!.memory.usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-sm text-gray-600">
                    Usage: {systemHealth()!.memory.usage_percent}%
                  </div>
                </div>
              </div>
            </div>

            {/* CPU */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">⚡ CPU</h3>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span>Frequency:</span>
                    <span>{systemHealth()!.cpu.frequency_mhz} MHz</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Cores:</span>
                    <span>{systemHealth()!.cpu.cores}</span>
                  </div>
                  <div class="text-xs text-gray-500 mt-2">
                    Note: Real-time CPU usage monitoring not available on ESP32
                  </div>
                </div>
              </div>
            </div>

            {/* ESP32 Flash */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">💾 ESP32 Flash</h3>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span>Total:</span>
                    <span>{systemHealth()!.flash.total_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Used:</span>
                    <span>{systemHealth()!.flash.used_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Free:</span>
                    <span>{systemHealth()!.flash.free_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      class="bg-green-600 h-2.5 rounded-full"
                      style={`width: ${systemHealth()!.flash.usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-sm text-gray-600">
                    Usage: {systemHealth()!.flash.usage_percent}%
                  </div>
                </div>
                
                {/* Flash Layout Diagram */}
                <div class="mt-4 p-3 bg-base-200 rounded-lg">
                  <h4 class="text-sm font-semibold mb-2">📋 Flash Layout Reference</h4>
                  <div class="text-xs font-mono text-gray-700 space-y-1">
                    <div>ESP32 Flash ({Math.round(systemHealth()!.flash.total_kb / 1024)}MB total):</div>
                    <div>├── Bootloader (~32KB)</div>
                    <div>├── Partition Table (~4KB)</div>
                    <div>├── Firmware + WebUI (~{systemHealth()!.flash.used_kb}KB) ← Your compiled code</div>
                    <div>├── LittleFS Filesystem ({storageInfo()!.total_kb}KB) ← Your data storage</div>
                    <div>│   ├── Logs ({storageInfo()!.log_usage_kb}KB used)</div>
                    <div>│   ├── Settings (~1KB)</div>
                    <div>│   └── Timeseries data ({storageInfo()!.timeseries.total_kb}KB used)</div>
                    <div>└── Other partitions/reserved space</div>
                  </div>
                </div>
              </div>
            </div>

            {/* WiFi */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">📶 WiFi</h3>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span>SSID:</span>
                    <span class="font-mono text-sm">{systemHealth()!.wifi.ssid}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Signal:</span>
                    <span>{systemHealth()!.wifi.rssi} dBm ({systemHealth()!.wifi.signal_strength})</span>
                  </div>
                  <div class="flex justify-between">
                    <span>IP:</span>
                    <span class="font-mono text-sm">{systemHealth()!.wifi.ip_address}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>MAC:</span>
                    <span class="font-mono text-sm">{systemHealth()!.wifi.mac_address}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">⏱️ Uptime</h3>
                <div class="space-y-2">
                  <div class="text-lg font-mono">
                    {systemHealth()!.uptime.formatted}
                  </div>
                  <div class="text-sm text-gray-600">
                    {systemHealth()!.uptime.seconds} seconds
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {storageInfo() && (
        <div>
          <h3 class="text-xl font-bold mb-4">💾 Storage Architecture</h3>
          
          {/* Main Filesystem Storage Overview */}
          <div class="card bg-base-100 shadow-xl mb-6">
            <div class="card-body">
              <h3 class="card-title text-lg">💾 LittleFS Filesystem (Flash Memory)</h3>
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span>Total Capacity:</span>
                    <span class="font-bold">{storageInfo()!.total_kb} KB ({storageInfo()!.total_mb} MB)</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Used:</span>
                    <span>{storageInfo()!.used_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Free:</span>
                    <span>{storageInfo()!.free_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Usage:</span>
                    <span>{storageInfo()!.usage_percent}%</span>
                  </div>
                </div>
                <div class="space-y-2">
                  <div class="w-full bg-gray-200 rounded-full h-4">
                    <div
                      class="bg-blue-600 h-4 rounded-full flex items-center justify-center text-xs text-white"
                      style={`width: ${storageInfo()!.usage_percent}%`}
                    >
                      {storageInfo()!.usage_percent}%
                    </div>
                  </div>
                  <div class="text-xs text-gray-600 text-center">
                    Filesystem Usage
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown of Filesystem Contents */}
          <h4 class="text-lg font-semibold mb-4">📂 Filesystem Contents Breakdown</h4>
          <div class="grid gap-6 md:grid-cols-2">
            {/* Log Storage - Part of Filesystem */}
            <div class="card bg-base-200 shadow-md border-l-4 border-blue-500">
              <div class="card-body">
                <h3 class="card-title text-base">📝 Log Files</h3>
                <div class="text-xs text-gray-600 mb-2">Stored in: /system_logs.txt</div>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span>Used:</span>
                    <span>{storageInfo()!.log_usage_kb} KB</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span>Limit:</span>
                    <span>{storageInfo()!.log_limit_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-300 rounded-full h-2">
                    <div
                      class="bg-blue-500 h-2 rounded-full"
                      style={`width: ${storageInfo()!.log_usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-xs text-gray-600">
                    {storageInfo()!.log_usage_percent}% of log allocation
                  </div>
                </div>
              </div>
            </div>

            {/* Timeseries Storage - Part of Filesystem */}
            <div class="card bg-base-200 shadow-md border-l-4 border-green-500">
              <div class="card-body">
                <h3 class="card-title text-base">📊 Timeseries Data</h3>
                <div class="text-xs text-gray-600 mb-2">Stored in: /movement_data.json, /runout_data.json, etc.</div>
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span>Total Used:</span>
                    <span>{storageInfo()!.timeseries.total_kb} KB</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span>Limit:</span>
                    <span>{storageInfo()!.timeseries.limit_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-300 rounded-full h-2">
                    <div
                      class="bg-green-500 h-2 rounded-full"
                      style={`width: ${storageInfo()!.timeseries.usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-xs text-gray-600">
                    {storageInfo()!.timeseries.usage_percent}% of timeseries allocation
                  </div>
                  <div class="text-xs text-gray-500 mt-2 space-y-1">
                    <div>Movement: {storageInfo()!.timeseries.movement_kb} KB</div>
                    <div>Runout: {storageInfo()!.timeseries.runout_kb} KB</div>
                    <div>Connection: {storageInfo()!.timeseries.connection_kb} KB</div>
                    <div>Pause Attempts: {storageInfo()!.timeseries.pause_attempts_kb || 0} KB</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Architecture Explanation */}
          <div class="card bg-base-300 shadow-md mt-6">
            <div class="card-body">
              <h4 class="card-title text-base">🏗️ Storage Architecture</h4>
              <div class="text-sm text-gray-700 space-y-2">
                <p><strong>LittleFS Filesystem:</strong> All application data (logs, timeseries, settings) is stored in the LittleFS filesystem partition on flash memory.</p>
                <p><strong>WebUI Assets:</strong> The web interface is embedded directly in firmware (PROGMEM) and doesn't use filesystem space.</p>
                <p><strong>Flash Layout:</strong> ESP32 flash contains firmware, WebUI assets, and the LittleFS partition for data storage.</p>
              </div>
            </div>
          </div>

          {/* Storage Actions */}
          <div class="card bg-base-100 shadow-xl mt-6">
            <div class="card-body">
              <h3 class="card-title text-lg">🔧 Storage Actions</h3>
              <div class="flex gap-4 flex-wrap">
                <button
                  class="btn btn-error"
                  onClick={clearLogs}
                >
                  Clear All Logs
                </button>
                <button
                  class="btn btn-error btn-outline"
                  onClick={clearAllStorage}
                >
                  🗑️ Clear All Storage
                </button>
                <a
                  href="/logs/download"
                  class="btn btn-success"
                  download
                >
                  📥 Download Logs
                </a>
                <button
                  class="btn btn-primary"
                  onClick={fetchAllData}
                  disabled={loading()}
                >
                  {loading() ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
              <div class="text-sm text-gray-600 mt-2">
                <p>• Logs are automatically rotated when they exceed 1.5MB</p>
                <p>• Timeseries data is automatically rotated when it exceeds 450KB</p>
                <p>• WebUI assets are embedded in firmware and don't use filesystem space</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemHealth
