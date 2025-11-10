import { createSignal, onMount } from 'solid-js'

interface StorageInfo {
  total_kb: number
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
    total_kb: number
    limit_kb: number
    usage_percent: number
    movement_points: number
    runout_points: number
    connection_points: number
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
                </div>
              </div>
            </div>

            {/* Flash */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">💾 Flash Memory</h3>
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
          <h3 class="text-xl font-bold mb-4">💾 Storage Information</h3>
          <div class="grid gap-6 md:grid-cols-3">
            {/* Filesystem Storage */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">💾 Filesystem Storage</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span>Total:</span>
                    <span>{storageInfo()!.total_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Used:</span>
                    <span>{storageInfo()!.used_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Free:</span>
                    <span>{storageInfo()!.free_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      class="bg-blue-600 h-2.5 rounded-full" 
                      style={`width: ${storageInfo()!.usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-sm text-gray-600">
                    Usage: {storageInfo()!.usage_percent}%
                  </div>
                </div>
              </div>
            </div>

            {/* Log Storage */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">📝 Log Storage</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span>Used:</span>
                    <span>{storageInfo()!.log_usage_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Limit:</span>
                    <span>{storageInfo()!.log_limit_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Available:</span>
                    <span>{storageInfo()!.log_limit_kb - storageInfo()!.log_usage_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      class="bg-yellow-600 h-2.5 rounded-full" 
                      style={`width: ${storageInfo()!.log_usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-sm text-gray-600">
                    Usage: {storageInfo()!.log_usage_percent}%
                  </div>
                </div>
              </div>
            </div>

            {/* Timeseries Storage */}
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <h3 class="card-title text-lg">📊 Timeseries Storage</h3>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span>Total Used:</span>
                    <span>{storageInfo()!.timeseries.total_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Limit:</span>
                    <span>{storageInfo()!.timeseries.limit_kb} KB</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Available:</span>
                    <span>{storageInfo()!.timeseries.limit_kb - storageInfo()!.timeseries.total_kb} KB</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      class="bg-green-600 h-2.5 rounded-full" 
                      style={`width: ${storageInfo()!.timeseries.usage_percent}%`}
                    ></div>
                  </div>
                  <div class="text-sm text-gray-600">
                    Usage: {storageInfo()!.timeseries.usage_percent}%
                  </div>
                  <div class="text-xs text-gray-500 mt-2">
                    Movement: {storageInfo()!.timeseries.movement_points} points ({storageInfo()!.timeseries.movement_kb} KB)<br/>
                    Runout: {storageInfo()!.timeseries.runout_points} points ({storageInfo()!.timeseries.runout_kb} KB)<br/>
                    Connection: {storageInfo()!.timeseries.connection_points} points ({storageInfo()!.timeseries.connection_kb} KB)
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Breakdown */}
            <div class="card bg-base-100 shadow-xl md:col-span-3">
              <div class="card-body">
                <h3 class="card-title text-lg">📁 Storage Breakdown</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div class="stat">
                    <div class="stat-title">Settings</div>
                    <div class="stat-value text-lg">~1 KB</div>
                    <div class="stat-desc">Configuration files</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">WebUI Assets</div>
                    <div class="stat-value text-lg">Embedded</div>
                    <div class="stat-desc">In firmware</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">Log Files</div>
                    <div class="stat-value text-lg">{storageInfo()!.log_usage_kb} KB</div>
                    <div class="stat-desc">Auto-rotated at 200KB</div>
                  </div>
                  <div class="stat">
                    <div class="stat-title">Timeseries Data</div>
                    <div class="stat-value text-lg">{storageInfo()!.timeseries.total_kb} KB</div>
                    <div class="stat-desc">Auto-rotated at 450KB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div class="card bg-base-100 shadow-xl md:col-span-3">
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
                    class="btn btn-primary" 
                    onClick={fetchAllData}
                    disabled={loading()}
                  >
                    {loading() ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                  <p>• Logs are automatically rotated when they exceed 200KB</p>
                  <p>• Timeseries data is automatically rotated when it exceeds 450KB</p>
                  <p>• WebUI assets are embedded in firmware and don't use filesystem space</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemHealth
