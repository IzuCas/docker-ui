package metrics

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"

	"github.com/IzuCas/docker-ui/internal/domain/entity"
	"github.com/IzuCas/docker-ui/pkg/logger"
)

const (
	// DefaultCollectionInterval is the default interval for collecting metrics
	DefaultCollectionInterval = 5 * time.Second

	// DefaultLogTailLines is the number of log lines to tail initially
	DefaultLogTailLines = "100"
)

// Collector collects metrics from Docker containers
type Collector struct {
	mu sync.RWMutex

	dockerClient *client.Client
	store        *Store

	// Collection interval
	interval time.Duration

	// Running state
	ctx        context.Context
	cancelFunc context.CancelFunc
	wg         sync.WaitGroup

	// Active log streams
	logStreams map[string]context.CancelFunc
}

// NewCollector creates a new metrics collector
func NewCollector(dockerClient *client.Client, store *Store) *Collector {
	return &Collector{
		dockerClient: dockerClient,
		store:        store,
		interval:     DefaultCollectionInterval,
		logStreams:   make(map[string]context.CancelFunc),
	}
}

// SetInterval sets the collection interval
func (c *Collector) SetInterval(interval time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.interval = interval
}

// Start starts the metrics collector
func (c *Collector) Start(ctx context.Context) {
	c.mu.Lock()
	c.ctx, c.cancelFunc = context.WithCancel(ctx)
	c.mu.Unlock()

	logger.Info("Starting metrics collector", logger.String("interval", c.interval.String()))

	// Start container metrics collection
	c.wg.Add(1)
	go c.collectContainerMetrics()

	// Start system metrics collection
	c.wg.Add(1)
	go c.collectSystemMetrics()

	// Start log streaming
	c.wg.Add(1)
	go c.manageLogStreams()
}

// Stop stops the metrics collector
func (c *Collector) Stop() {
	c.mu.Lock()
	if c.cancelFunc != nil {
		c.cancelFunc()
	}
	c.mu.Unlock()

	c.wg.Wait()
	logger.Info("Metrics collector stopped")
}

// collectContainerMetrics collects metrics from all running containers
func (c *Collector) collectContainerMetrics() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.doCollectContainerMetrics()
		}
	}
}

func (c *Collector) doCollectContainerMetrics() {
	containers, err := c.dockerClient.ContainerList(c.ctx, container.ListOptions{})
	if err != nil {
		logger.Error("Failed to list containers for metrics", logger.Err(err))
		return
	}

	for _, cont := range containers {
		go c.collectSingleContainerMetrics(cont.ID, cont.Names)
	}
}

func (c *Collector) collectSingleContainerMetrics(containerID string, names []string) {
	ctx, cancel := context.WithTimeout(c.ctx, 5*time.Second)
	defer cancel()

	stats, err := c.dockerClient.ContainerStatsOneShot(ctx, containerID)
	if err != nil {
		return
	}
	defer stats.Body.Close()

	var statsJSON types.StatsJSON
	decoder := json.NewDecoder(stats.Body)
	if err := decoder.Decode(&statsJSON); err != nil {
		return
	}

	// Calculate CPU percentage
	cpuPercent := calculateCPUPercent(&statsJSON)

	// Calculate memory percentage
	memPercent := 0.0
	if statsJSON.MemoryStats.Limit > 0 {
		memPercent = float64(statsJSON.MemoryStats.Usage) / float64(statsJSON.MemoryStats.Limit) * 100
	}

	// Calculate network I/O
	var rxBytes, txBytes, rxPackets, txPackets uint64
	for _, network := range statsJSON.Networks {
		rxBytes += network.RxBytes
		txBytes += network.TxBytes
		rxPackets += network.RxPackets
		txPackets += network.TxPackets
	}

	// Calculate block I/O
	var blockRead, blockWrite uint64
	for _, bio := range statsJSON.BlkioStats.IoServiceBytesRecursive {
		switch bio.Op {
		case "read", "Read":
			blockRead += bio.Value
		case "write", "Write":
			blockWrite += bio.Value
		}
	}

	containerName := ""
	if len(names) > 0 {
		containerName = strings.TrimPrefix(names[0], "/")
	}

	metrics := &entity.ContainerMetrics{
		ContainerID:      containerID,
		ContainerName:    containerName,
		Timestamp:        time.Now(),
		CPUPercent:       cpuPercent,
		CPUSystemUsage:   statsJSON.CPUStats.SystemUsage,
		MemoryUsage:      statsJSON.MemoryStats.Usage,
		MemoryLimit:      statsJSON.MemoryStats.Limit,
		MemoryPercent:    memPercent,
		MemoryCache:      statsJSON.MemoryStats.Stats["cache"],
		NetworkRxBytes:   rxBytes,
		NetworkTxBytes:   txBytes,
		NetworkRxPackets: rxPackets,
		NetworkTxPackets: txPackets,
		BlockRead:        blockRead,
		BlockWrite:       blockWrite,
		PIDs:             statsJSON.PidsStats.Current,
	}

	c.store.AddContainerMetrics(metrics)
}

// collectSystemMetrics collects overall system metrics
func (c *Collector) collectSystemMetrics() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.doCollectSystemMetrics()
		}
	}
}

func (c *Collector) doCollectSystemMetrics() {
	info, err := c.dockerClient.Info(c.ctx)
	if err != nil {
		logger.Error("Failed to get Docker info for metrics", logger.Err(err))
		return
	}

	// Get disk usage
	diskUsage, err := c.dockerClient.DiskUsage(c.ctx, types.DiskUsageOptions{})
	if err != nil {
		logger.Debug("Failed to get disk usage", logger.Err(err))
	}

	var imagesCount, volumesCount int
	if diskUsage.Images != nil {
		imagesCount = len(diskUsage.Images)
	}
	if diskUsage.Volumes != nil {
		volumesCount = len(diskUsage.Volumes)
	}

	metrics := &entity.SystemMetrics{
		Timestamp:         time.Now(),
		CPUCores:          info.NCPU,
		MemoryTotal:       uint64(info.MemTotal),
		ContainersRunning: info.ContainersRunning,
		ContainersPaused:  info.ContainersPaused,
		ContainersStopped: info.ContainersStopped,
		ImagesCount:       imagesCount,
		VolumesCount:      volumesCount,
		NetworksCount:     0, // Will be updated separately
	}

	// Get network count
	networks, err := c.dockerClient.NetworkList(c.ctx, types.NetworkListOptions{})
	if err == nil {
		metrics.NetworksCount = len(networks)
	}

	c.store.AddSystemMetrics(metrics)
}

// manageLogStreams manages log streaming for containers
func (c *Collector) manageLogStreams() {
	defer c.wg.Done()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			// Stop all log streams
			c.mu.Lock()
			for _, cancel := range c.logStreams {
				cancel()
			}
			c.logStreams = make(map[string]context.CancelFunc)
			c.mu.Unlock()
			return
		case <-ticker.C:
			c.updateLogStreams()
		}
	}
}

func (c *Collector) updateLogStreams() {
	containers, err := c.dockerClient.ContainerList(c.ctx, container.ListOptions{})
	if err != nil {
		return
	}

	activeContainers := make(map[string]bool)
	for _, cont := range containers {
		activeContainers[cont.ID] = true

		c.mu.RLock()
		_, exists := c.logStreams[cont.ID]
		c.mu.RUnlock()

		if !exists {
			// Start log stream for this container
			containerName := ""
			if len(cont.Names) > 0 {
				containerName = strings.TrimPrefix(cont.Names[0], "/")
			}
			c.startLogStream(cont.ID, containerName)
		}
	}

	// Stop log streams for removed containers
	c.mu.Lock()
	for containerID, cancel := range c.logStreams {
		if !activeContainers[containerID] {
			cancel()
			delete(c.logStreams, containerID)
		}
	}
	c.mu.Unlock()
}

func (c *Collector) startLogStream(containerID, containerName string) {
	ctx, cancel := context.WithCancel(c.ctx)

	c.mu.Lock()
	c.logStreams[containerID] = cancel
	c.mu.Unlock()

	go func() {
		options := container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Follow:     true,
			Timestamps: true,
			Tail:       DefaultLogTailLines,
		}

		reader, err := c.dockerClient.ContainerLogs(ctx, containerID, options)
		if err != nil {
			logger.Debug("Failed to start log stream",
				logger.String("container", containerID),
				logger.Err(err))
			return
		}
		defer reader.Close()

		c.processLogStream(ctx, containerID, containerName, reader)
	}()
}

func (c *Collector) processLogStream(ctx context.Context, containerID, containerName string, reader io.ReadCloser) {
	scanner := bufio.NewScanner(reader)
	// Increase buffer size for long log lines
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Bytes()
		if len(line) < 8 {
			continue
		}

		// Docker log format: [8]byte header + message
		// Header: [0] stream type (1=stdout, 2=stderr), [1-3] unused, [4-7] size (big-endian)
		stream := "stdout"
		if line[0] == 2 {
			stream = "stderr"
		}

		// Extract message (skip 8-byte header)
		message := string(line[8:])

		// Parse timestamp if present
		timestamp := time.Now()
		if len(message) > 30 && message[4] == '-' && message[7] == '-' {
			if ts, err := time.Parse(time.RFC3339Nano, message[:30]); err == nil {
				timestamp = ts
				message = strings.TrimSpace(message[31:])
			}
		}

		// Try to parse log level
		level := parseLogLevel(message)

		entry := &entity.MetricsLogEntry{
			Timestamp:     timestamp,
			ContainerID:   containerID,
			ContainerName: containerName,
			Stream:        stream,
			Message:       message,
			Level:         level,
		}

		c.store.AddLogEntry(entry)
	}
}

// Helper functions

func calculateCPUPercent(stats *types.StatsJSON) float64 {
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)

	if systemDelta > 0 && cpuDelta > 0 {
		cpuCount := float64(stats.CPUStats.OnlineCPUs)
		if cpuCount == 0 {
			cpuCount = float64(len(stats.CPUStats.CPUUsage.PercpuUsage))
		}
		if cpuCount == 0 {
			cpuCount = 1
		}
		return (cpuDelta / systemDelta) * cpuCount * 100.0
	}
	return 0
}

func parseLogLevel(message string) string {
	msg := strings.ToLower(message)

	// Check for common log level patterns
	levelPatterns := map[string][]string{
		"error": {"error", "err", "fatal", "panic", "critical", "crit"},
		"warn":  {"warn", "warning"},
		"info":  {"info"},
		"debug": {"debug", "trace"},
	}

	for level, patterns := range levelPatterns {
		for _, pattern := range patterns {
			// Check for pattern at start or after common prefixes
			if strings.HasPrefix(msg, pattern) ||
				strings.Contains(msg, "["+pattern+"]") ||
				strings.Contains(msg, " "+pattern+" ") ||
				strings.Contains(msg, "level="+pattern) ||
				strings.Contains(msg, "\"level\":\""+pattern) {
				return level
			}
		}
	}

	return ""
}
