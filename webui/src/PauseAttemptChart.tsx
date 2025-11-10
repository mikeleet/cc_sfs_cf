import { createSignal, onMount, onCleanup } from 'solid-js'

interface PauseAttemptPoint {
  timestamp: number
  type: number
  retryCount: number
  printStatus: number
}

interface PauseAttemptStats {
  totalAttempts: number
  initialAttempts: number
  retryAttempts: number
  successfulPauses: number
  maxExceeded: number
  alreadyPaused: number
  dataSize: number
  maxDataSize: number
}

const PAUSE_ATTEMPT_TYPES = {
  0: 'Initial',
  1: 'Retry',
  2: 'Success',
  3: 'Max Exceeded',
  4: 'Already Paused'
}

const PAUSE_ATTEMPT_COLORS = {
  0: '#3b82f6', // blue - initial
  1: '#f59e0b', // amber - retry
  2: '#10b981', // green - success
  3: '#ef4444', // red - max exceeded
  4: '#6b7280'  // gray - already paused
}

interface Props {
  title: string
  endpoint: string
  statsEndpoint: string
}

function PauseAttemptChart(props: Props) {
  const [data, setData] = createSignal<PauseAttemptPoint[]>([])
  const [stats, setStats] = createSignal<PauseAttemptStats | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const fetchData = async () => {
    try {
      setError(null)

      // Fetch chart data
      const dataResponse = await fetch(props.endpoint)
      if (dataResponse.ok) {
        const result = await dataResponse.json()
        setData(result.data || [])
      }

      // Fetch statistics
      const statsResponse = await fetch(props.statsEndpoint)
      if (statsResponse.ok) {
        const statsResult = await statsResponse.json()
        setStats(statsResult)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString()
  }

  return (
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h3 class="card-title text-lg">{props.title}</h3>

        {loading() && (
          <div class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {error() && (
          <div class="alert alert-error">
            <span>Error: {error()}</span>
          </div>
        )}

        {!loading() && !error() && (
          <div>
            {/* Statistics Summary */}
            {stats() && (
              <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 text-sm">
                <div class="stat stat-compact">
                  <div class="stat-title text-xs">Total</div>
                  <div class="stat-value text-sm">{stats()!.totalAttempts}</div>
                </div>
                <div class="stat stat-compact">
                  <div class="stat-title text-xs">Success</div>
                  <div class="stat-value text-sm text-success">{stats()!.successfulPauses}</div>
                </div>
                <div class="stat stat-compact">
                  <div class="stat-title text-xs">Retries</div>
                  <div class="stat-value text-sm text-warning">{stats()!.retryAttempts}</div>
                </div>
                <div class="stat stat-compact">
                  <div class="stat-title text-xs">Max Exceeded</div>
                  <div class="stat-value text-sm text-error">{stats()!.maxExceeded}</div>
                </div>
                <div class="stat stat-compact">
                  <div class="stat-title text-xs">Storage</div>
                  <div class="stat-value text-sm">{Math.round((stats()!.dataSize / stats()!.maxDataSize) * 100)}%</div>
                </div>
                <div class="stat stat-compact">
                  <div class="stat-title text-xs">Size</div>
                  <div class="stat-value text-sm">{Math.round(stats()!.dataSize / 1024)}KB</div>
                </div>
              </div>
            )}

            {/* Recent Events */}
            <div class="max-h-48 overflow-y-auto">
              <h4 class="font-semibold mb-2">Recent Pause Attempts</h4>
              {data().length === 0 ? (
                <p class="text-gray-500 text-sm">No pause attempts recorded</p>
              ) : (
                <div class="space-y-1">
                  {data().slice(-10).reverse().map((point) => (
                    <div
                      class="flex items-center justify-between p-2 rounded text-xs"
                      style={`background-color: ${PAUSE_ATTEMPT_COLORS[point.type as keyof typeof PAUSE_ATTEMPT_COLORS]}20`}
                    >
                      <div class="flex items-center gap-2">
                        <div
                          class="w-2 h-2 rounded-full"
                          style={`background-color: ${PAUSE_ATTEMPT_COLORS[point.type as keyof typeof PAUSE_ATTEMPT_COLORS]}`}
                        ></div>
                        <span class="font-medium">
                          {PAUSE_ATTEMPT_TYPES[point.type as keyof typeof PAUSE_ATTEMPT_TYPES]}
                        </span>
                        {point.retryCount > 0 && (
                          <span class="badge badge-xs">Retry #{point.retryCount}</span>
                        )}
                      </div>
                      <span class="text-gray-600">
                        {formatTimestamp(point.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div class="mt-4 pt-2 border-t">
              <div class="flex flex-wrap gap-2 text-xs">
                {Object.entries(PAUSE_ATTEMPT_TYPES).map(([type, label]) => (
                  <div class="flex items-center gap-1">
                    <div
                      class="w-2 h-2 rounded-full"
                      style={`background-color: ${PAUSE_ATTEMPT_COLORS[parseInt(type) as keyof typeof PAUSE_ATTEMPT_COLORS]}`}
                    ></div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PauseAttemptChart
