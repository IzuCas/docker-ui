package entity

import "time"

// MetricType represents the type of metric
type MetricType string

const (
	MetricTypeCPU       MetricType = "cpu"
	MetricTypeMemory    MetricType = "memory"
	MetricTypeDisk      MetricType = "disk"
	MetricTypeNetwork   MetricType = "network"
	MetricTypeContainer MetricType = "container"
)

// MetricPoint represents a single metric data point
type MetricPoint struct {
	Timestamp time.Time              `json:"timestamp"`
	Value     float64                `json:"value"`
	Labels    map[string]string      `json:"labels,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Metric represents a metric series
type Metric struct {
	Name        string         `json:"name"`
	Type        MetricType     `json:"type"`
	Unit        string         `json:"unit"`
	Description string         `json:"description"`
	Points      []*MetricPoint `json:"points"`
}

// ContainerMetrics represents metrics for a specific container
type ContainerMetrics struct {
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name"`
	Timestamp     time.Time `json:"timestamp"`

	// CPU metrics
	CPUPercent     float64 `json:"cpu_percent"`
	CPUSystemUsage uint64  `json:"cpu_system_usage"`
	CPUUserUsage   uint64  `json:"cpu_user_usage"`

	// Memory metrics
	MemoryUsage   uint64  `json:"memory_usage"`
	MemoryLimit   uint64  `json:"memory_limit"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryCache   uint64  `json:"memory_cache"`

	// Network metrics
	NetworkRxBytes   uint64 `json:"network_rx_bytes"`
	NetworkTxBytes   uint64 `json:"network_tx_bytes"`
	NetworkRxPackets uint64 `json:"network_rx_packets"`
	NetworkTxPackets uint64 `json:"network_tx_packets"`

	// Block I/O metrics
	BlockRead  uint64 `json:"block_read"`
	BlockWrite uint64 `json:"block_write"`

	// Process count
	PIDs uint64 `json:"pids"`
}

// SystemMetrics represents overall system metrics
type SystemMetrics struct {
	Timestamp time.Time `json:"timestamp"`

	// CPU
	CPUPercent    float64   `json:"cpu_percent"`
	CPUPerCore    []float64 `json:"cpu_per_core"`
	CPUCores      int       `json:"cpu_cores"`
	LoadAverage1  float64   `json:"load_average_1"`
	LoadAverage5  float64   `json:"load_average_5"`
	LoadAverage15 float64   `json:"load_average_15"`

	// Memory
	MemoryTotal     uint64  `json:"memory_total"`
	MemoryUsed      uint64  `json:"memory_used"`
	MemoryFree      uint64  `json:"memory_free"`
	MemoryPercent   float64 `json:"memory_percent"`
	SwapTotal       uint64  `json:"swap_total"`
	SwapUsed        uint64  `json:"swap_used"`
	SwapFree        uint64  `json:"swap_free"`
	MemoryCached    uint64  `json:"memory_cached"`
	MemoryBuffers   uint64  `json:"memory_buffers"`
	MemoryAvailable uint64  `json:"memory_available"`

	// Disk
	DiskTotal   uint64  `json:"disk_total"`
	DiskUsed    uint64  `json:"disk_used"`
	DiskFree    uint64  `json:"disk_free"`
	DiskPercent float64 `json:"disk_percent"`

	// Docker specific
	ContainersRunning int `json:"containers_running"`
	ContainersPaused  int `json:"containers_paused"`
	ContainersStopped int `json:"containers_stopped"`
	ImagesCount       int `json:"images_count"`
	VolumesCount      int `json:"volumes_count"`
	NetworksCount     int `json:"networks_count"`
}

// MetricsLogEntry represents a parsed log entry for metrics
type MetricsLogEntry struct {
	Timestamp     time.Time              `json:"timestamp"`
	ContainerID   string                 `json:"container_id"`
	ContainerName string                 `json:"container_name"`
	Stream        string                 `json:"stream"` // stdout or stderr
	Message       string                 `json:"message"`
	Level         string                 `json:"level,omitempty"`
	Fields        map[string]interface{} `json:"fields,omitempty"`
}

// LogQuery represents a query for filtering logs
type LogQuery struct {
	ContainerIDs   []string          `json:"container_ids,omitempty"`
	ContainerNames []string          `json:"container_names,omitempty"`
	StartTime      time.Time         `json:"start_time"`
	EndTime        time.Time         `json:"end_time"`
	Search         string            `json:"search,omitempty"`
	Level          string            `json:"level,omitempty"`
	Regex          string            `json:"regex,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`
	Limit          int               `json:"limit,omitempty"`
	Offset         int               `json:"offset,omitempty"`
}

// LogQueryResult represents the result of a log query
type LogQueryResult struct {
	Query      *LogQuery          `json:"query"`
	Entries    []*MetricsLogEntry `json:"entries"`
	TotalCount int                `json:"total_count"`
	HasMore    bool               `json:"has_more"`
}

// LogAggregation represents aggregated log data for charts
type LogAggregation struct {
	Interval   string             `json:"interval"` // 1m, 5m, 1h, 1d
	Buckets    []*LogBucket       `json:"buckets"`
	GroupBy    string             `json:"group_by,omitempty"`
	GroupData  map[string][]int64 `json:"group_data,omitempty"`
	TotalCount int64              `json:"total_count"`
}

// LogBucket represents a time bucket for log aggregation
type LogBucket struct {
	Timestamp time.Time        `json:"timestamp"`
	Count     int64            `json:"count"`
	ByLevel   map[string]int64 `json:"by_level,omitempty"`
	ByStream  map[string]int64 `json:"by_stream,omitempty"`
	BySource  map[string]int64 `json:"by_source,omitempty"`
}

// MetricsQuery represents a query for metrics
type MetricsQuery struct {
	ContainerIDs []string  `json:"container_ids,omitempty"`
	MetricTypes  []string  `json:"metric_types,omitempty"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	Resolution   string    `json:"resolution,omitempty"`  // 1m, 5m, 1h
	Aggregation  string    `json:"aggregation,omitempty"` // avg, max, min, sum
}

// Dashboard represents a custom dashboard configuration
type Dashboard struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Panels      []*Panel  `json:"panels"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Panel represents a dashboard panel
type Panel struct {
	ID       string      `json:"id"`
	Title    string      `json:"title"`
	Type     string      `json:"type"` // line, bar, pie, gauge, table
	Position PanelPos    `json:"position"`
	Query    interface{} `json:"query"` // MetricsQuery or LogQuery
	Options  PanelOpts   `json:"options,omitempty"`
}

// PanelPos represents panel position in grid
type PanelPos struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// PanelOpts represents panel display options
type PanelOpts struct {
	ShowLegend   bool              `json:"show_legend,omitempty"`
	Stacked      bool              `json:"stacked,omitempty"`
	Colors       []string          `json:"colors,omitempty"`
	YAxisLabel   string            `json:"y_axis_label,omitempty"`
	YAxisMin     *float64          `json:"y_axis_min,omitempty"`
	YAxisMax     *float64          `json:"y_axis_max,omitempty"`
	Thresholds   []Threshold       `json:"thresholds,omitempty"`
	CustomLabels map[string]string `json:"custom_labels,omitempty"`
}

// Threshold represents a threshold for alerting/coloring
type Threshold struct {
	Value float64 `json:"value"`
	Color string  `json:"color"`
	Label string  `json:"label,omitempty"`
}
