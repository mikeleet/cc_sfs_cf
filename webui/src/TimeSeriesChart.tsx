import { createSignal, createEffect, onMount } from 'solid-js'

interface DataPoint {
  t: number
  v: number
}

interface TimeSeriesChartProps {
  title: string
  endpoint: string
  color?: string
  yLabel?: string
  height?: number
}

interface ChartState {
  zoomLevel: number
  timeRange: number // in minutes
  selectedPoint: DataPoint | null
}

export default function TimeSeriesChart(props: TimeSeriesChartProps) {
  const [data, setData] = createSignal<DataPoint[]>([])
  const [loading, setLoading] = createSignal(true)
  const [chartState, setChartState] = createSignal<ChartState>({
    zoomLevel: 1,
    timeRange: 60, // Default 60 minutes
    selectedPoint: null
  })
  let canvasRef: HTMLCanvasElement | undefined

  const fetchData = async () => {
    try {
      const response = await fetch(props.endpoint)
      const result = await response.json()
      if (result.data) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCanvasClick = (event: MouseEvent) => {
    if (!canvasRef || data().length === 0) return
    
    const rect = canvasRef.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Convert canvas coordinates to data coordinates
    const padding = 40
    const chartWidth = canvasRef.width - 2 * padding
    const chartHeight = canvasRef.height - 2 * padding
    
    if (x < padding || x > padding + chartWidth || y < padding || y > padding + chartHeight) return
    
    const points = data()
    const minTime = Math.min(...points.map(p => p.t))
    const maxTime = Math.max(...points.map(p => p.t))
    
    // Find closest point
    const relativeX = (x - padding) / chartWidth
    const targetTime = minTime + (maxTime - minTime) * relativeX
    
    let closestPoint = points[0]
    let minDistance = Math.abs(closestPoint.t - targetTime)
    
    points.forEach(point => {
      const distance = Math.abs(point.t - targetTime)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = point
      }
    })
    
    setChartState(prev => ({ ...prev, selectedPoint: closestPoint }))
  }

  const zoomIn = () => {
    setChartState(prev => ({ 
      ...prev, 
      timeRange: Math.max(10, prev.timeRange / 2),
      zoomLevel: prev.zoomLevel * 2 
    }))
  }

  const zoomOut = () => {
    setChartState(prev => ({ 
      ...prev, 
      timeRange: Math.min(1440, prev.timeRange * 2), // Max 24 hours
      zoomLevel: prev.zoomLevel / 2 
    }))
  }

  const resetZoom = () => {
    setChartState({ zoomLevel: 1, timeRange: 60, selectedPoint: null })
  }

  const drawChart = () => {
    if (!canvasRef || data().length === 0) return

    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    const width = canvasRef.width
    const height = canvasRef.height
    const padding = 40

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Set up chart area
    const chartWidth = width - 2 * padding
    const chartHeight = height - 2 * padding

    // Draw background
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(padding, padding, chartWidth, chartHeight)

    // Draw grid lines
    ctx.strokeStyle = '#e9ecef'
    ctx.lineWidth = 1

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i * chartWidth) / 10
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, padding + chartHeight)
      ctx.stroke()
    }

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * chartHeight) / 5
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + chartWidth, y)
      ctx.stroke()
    }

    const allPoints = data()
    if (allPoints.length < 2) return

    // Filter points based on time range
    const currentTime = Date.now() / 1000
    const cutoffTime = currentTime - (chartState().timeRange * 60)
    const points = allPoints.filter(p => p.t >= cutoffTime)
    
    if (points.length < 2) return

    // Find data range
    const minTime = Math.min(...points.map(p => p.t))
    const maxTime = Math.max(...points.map(p => p.t))
    const minValue = Math.min(...points.map(p => p.v))
    const maxValue = Math.max(...points.map(p => p.v))

    // Add some padding to value range
    const valueRange = maxValue - minValue || 1
    const paddedMin = minValue - valueRange * 0.1
    const paddedMax = maxValue + valueRange * 0.1

    // Draw data line
    ctx.strokeStyle = props.color || '#007bff'
    ctx.lineWidth = 2
    ctx.beginPath()

    points.forEach((point, index) => {
      const x = padding + ((point.t - minTime) / (maxTime - minTime)) * chartWidth
      const y = padding + chartHeight - ((point.v - paddedMin) / (paddedMax - paddedMin)) * chartHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // Draw data points
    ctx.fillStyle = props.color || '#007bff'
    points.forEach(point => {
      const x = padding + ((point.t - minTime) / (maxTime - minTime)) * chartWidth
      const y = padding + chartHeight - ((point.v - paddedMin) / (paddedMax - paddedMin)) * chartHeight

      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })

    // Highlight selected point
    const selectedPoint = chartState().selectedPoint
    if (selectedPoint && points.some(p => p.t === selectedPoint.t)) {
      const x = padding + ((selectedPoint.t - minTime) / (maxTime - minTime)) * chartWidth
      const y = padding + chartHeight - ((selectedPoint.v - paddedMin) / (paddedMax - paddedMin)) * chartHeight

      ctx.strokeStyle = '#ff0000'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, 2 * Math.PI)
      ctx.stroke()
      
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()
    }

    // Draw axes labels
    ctx.fillStyle = '#666'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'

    // Y-axis label
    if (props.yLabel) {
      ctx.save()
      ctx.translate(15, padding + chartHeight / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(props.yLabel, 0, 0)
      ctx.restore()
    }

    // Y-axis values
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const value = paddedMin + (paddedMax - paddedMin) * (1 - i / 5)
      const y = padding + (i * chartHeight) / 5
      ctx.fillText(value.toFixed(1), padding - 5, y + 4)
    }

    // X-axis (time) labels
    ctx.textAlign = 'center'
    const now = Date.now() / 1000
    for (let i = 0; i <= 5; i++) {
      const time = minTime + (maxTime - minTime) * (i / 5)
      const x = padding + (i * chartWidth) / 5
      const minutesAgo = Math.round((now - time) / 60)
      ctx.fillText(`${minutesAgo}m ago`, x, height - 5)
    }
  }

  onMount(() => {
    fetchData()
    // Refresh data every 2 seconds
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  })

  createEffect(() => {
    if (!loading()) {
      drawChart()
    }
  })

  return (
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-4">
        <div class="flex justify-between items-center mb-2">
          <h3 class="card-title text-lg">{props.title}</h3>
          <div class="flex gap-2">
            <button class="btn btn-xs btn-outline" onClick={zoomIn}>🔍+</button>
            <button class="btn btn-xs btn-outline" onClick={zoomOut}>🔍-</button>
            <button class="btn btn-xs btn-outline" onClick={resetZoom}>Reset</button>
          </div>
        </div>
        
        {loading() ? (
          <div class="flex justify-center items-center h-48">
            <span class="loading loading-spinner loading-md"></span>
          </div>
        ) : (
          <div>
            <canvas
              ref={canvasRef}
              width={600}
              height={props.height || 200}
              class="w-full border border-base-300 rounded cursor-crosshair"
              onClick={handleCanvasClick}
            />
            {chartState().selectedPoint && (
              <div class="mt-2 p-2 bg-base-200 rounded text-sm">
                <strong>Selected Point:</strong> Value: {chartState().selectedPoint!.v}, 
                Time: {new Date(chartState().selectedPoint!.t * 1000).toLocaleString()}
              </div>
            )}
          </div>
        )}
        
        <div class="text-xs text-base-content/60 mt-2">
          Data points collected every 2 seconds • Chart updates every 2 seconds • 
          Showing last {chartState().timeRange} minutes • Click to select points
        </div>
      </div>
    </div>
  )
}
