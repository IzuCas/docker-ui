package handler

import (
	"context"
	"strings"
	"time"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
	"app/example/pkg/logger"
)

// MetricsHandler handles metrics-related requests
type MetricsHandler struct {
	service *service.MetricsService
}

// NewMetricsHandler creates a new metrics handler
func NewMetricsHandler(service *service.MetricsService) *MetricsHandler {
	return &MetricsHandler{service: service}
}

// GetContainerMetrics returns metrics for a specific container
func (h *MetricsHandler) GetContainerMetrics(ctx context.Context, input *dto.MetricsQueryInput) (*dto.ContainerMetricsOutput, error) {
	logger.Debug("Getting container metrics",
		logger.String("container_id", input.ContainerID),
		logger.String("start", input.StartTime),
		logger.String("end", input.EndTime))

	start, end := parseTimeRange(input.StartTime, input.EndTime)

	var metrics []*entity.ContainerMetrics
	if input.Resolution != "" {
		metrics = h.service.AggregateContainerMetrics(input.ContainerID, start, end, input.Resolution)
	} else {
		metrics = h.service.GetContainerMetrics(input.ContainerID, start, end)
	}

	// Convert to DTOs
	points := make([]dto.ContainerMetricPoint, 0, len(metrics))
	containerName := ""
	for _, m := range metrics {
		if containerName == "" {
			containerName = m.ContainerName
		}
		points = append(points, dto.ContainerMetricPoint{
			Timestamp:      m.Timestamp,
			CPUPercent:     m.CPUPercent,
			MemoryUsage:    m.MemoryUsage,
			MemoryLimit:    m.MemoryLimit,
			MemoryPercent:  m.MemoryPercent,
			NetworkRxBytes: m.NetworkRxBytes,
			NetworkTxBytes: m.NetworkTxBytes,
			BlockRead:      m.BlockRead,
			BlockWrite:     m.BlockWrite,
			PIDs:           m.PIDs,
		})
	}

	logger.Info("Container metrics retrieved",
		logger.String("container_id", input.ContainerID),
		logger.Int("data_points", len(points)))

	return &dto.ContainerMetricsOutput{
		Body: dto.ContainerMetricsResponse{
			ContainerID:   input.ContainerID,
			ContainerName: containerName,
			StartTime:     start,
			EndTime:       end,
			Resolution:    input.Resolution,
			DataPoints:    len(points),
			Metrics:       points,
		},
	}, nil
}

// GetAllContainerMetrics returns metrics for all containers
func (h *MetricsHandler) GetAllContainerMetrics(ctx context.Context, input *dto.AllContainerMetricsInput) (*dto.AllContainerMetricsOutput, error) {
	logger.Debug("Getting all container metrics",
		logger.String("start", input.StartTime),
		logger.String("end", input.EndTime))

	start, end := parseTimeRange(input.StartTime, input.EndTime)

	allMetrics := h.service.GetAllContainerMetrics(start, end)

	// Convert to DTOs
	containers := make(map[string]dto.ContainerMetricsResponse)
	for containerID, metrics := range allMetrics {
		points := make([]dto.ContainerMetricPoint, 0, len(metrics))
		containerName := ""
		for _, m := range metrics {
			if containerName == "" {
				containerName = m.ContainerName
			}
			points = append(points, dto.ContainerMetricPoint{
				Timestamp:      m.Timestamp,
				CPUPercent:     m.CPUPercent,
				MemoryUsage:    m.MemoryUsage,
				MemoryLimit:    m.MemoryLimit,
				MemoryPercent:  m.MemoryPercent,
				NetworkRxBytes: m.NetworkRxBytes,
				NetworkTxBytes: m.NetworkTxBytes,
				BlockRead:      m.BlockRead,
				BlockWrite:     m.BlockWrite,
				PIDs:           m.PIDs,
			})
		}
		containers[containerID] = dto.ContainerMetricsResponse{
			ContainerID:   containerID,
			ContainerName: containerName,
			StartTime:     start,
			EndTime:       end,
			Resolution:    input.Resolution,
			DataPoints:    len(points),
			Metrics:       points,
		}
	}

	logger.Info("All container metrics retrieved", logger.Int("containers", len(containers)))

	return &dto.AllContainerMetricsOutput{
		Body: dto.AllContainerMetricsResponse{
			StartTime:  start,
			EndTime:    end,
			Resolution: input.Resolution,
			Containers: containers,
		},
	}, nil
}

// GetLatestMetrics returns the most recent metrics
func (h *MetricsHandler) GetLatestMetrics(ctx context.Context, input *dto.LatestMetricsInput) (*dto.LatestMetricsOutput, error) {
	logger.Debug("Getting latest metrics")

	systemMetrics := h.service.GetLatestSystemMetrics()
	containerMetrics := h.service.GetLatestContainerMetrics()

	// Convert to DTOs
	var systemSummary *dto.SystemMetricsSummary
	if systemMetrics != nil {
		systemSummary = &dto.SystemMetricsSummary{
			CPUCores:          systemMetrics.CPUCores,
			MemoryTotal:       systemMetrics.MemoryTotal,
			ContainersRunning: systemMetrics.ContainersRunning,
			ContainersPaused:  systemMetrics.ContainersPaused,
			ContainersStopped: systemMetrics.ContainersStopped,
			ImagesCount:       systemMetrics.ImagesCount,
			VolumesCount:      systemMetrics.VolumesCount,
			NetworksCount:     systemMetrics.NetworksCount,
		}
	}

	containers := make(map[string]dto.ContainerMetricPoint)
	for containerID, m := range containerMetrics {
		containers[containerID] = dto.ContainerMetricPoint{
			Timestamp:      m.Timestamp,
			CPUPercent:     m.CPUPercent,
			MemoryUsage:    m.MemoryUsage,
			MemoryLimit:    m.MemoryLimit,
			MemoryPercent:  m.MemoryPercent,
			NetworkRxBytes: m.NetworkRxBytes,
			NetworkTxBytes: m.NetworkTxBytes,
			BlockRead:      m.BlockRead,
			BlockWrite:     m.BlockWrite,
			PIDs:           m.PIDs,
		}
	}

	logger.Info("Latest metrics retrieved", logger.Int("containers", len(containers)))

	return &dto.LatestMetricsOutput{
		Body: dto.LatestMetricsResponse{
			Timestamp:  time.Now(),
			System:     systemSummary,
			Containers: containers,
		},
	}, nil
}

// GetSystemMetrics returns system metrics
func (h *MetricsHandler) GetSystemMetrics(ctx context.Context, input *dto.SystemMetricsInput) (*dto.SystemMetricsOutput, error) {
	logger.Debug("Getting system metrics",
		logger.String("start", input.StartTime),
		logger.String("end", input.EndTime))

	start, end := parseTimeRange(input.StartTime, input.EndTime)

	metrics := h.service.GetSystemMetrics(start, end)

	// Convert to DTOs
	points := make([]dto.SystemMetricPoint, 0, len(metrics))
	for _, m := range metrics {
		points = append(points, dto.SystemMetricPoint{
			Timestamp:         m.Timestamp,
			CPUCores:          m.CPUCores,
			MemoryTotal:       m.MemoryTotal,
			MemoryUsed:        m.MemoryUsed,
			MemoryPercent:     m.MemoryPercent,
			ContainersRunning: m.ContainersRunning,
			ContainersPaused:  m.ContainersPaused,
			ContainersStopped: m.ContainersStopped,
			ImagesCount:       m.ImagesCount,
			VolumesCount:      m.VolumesCount,
			NetworksCount:     m.NetworksCount,
		})
	}

	logger.Info("System metrics retrieved", logger.Int("data_points", len(points)))

	return &dto.SystemMetricsOutput{
		Body: dto.SystemMetricsResponse{
			StartTime:  start,
			EndTime:    end,
			DataPoints: len(points),
			Metrics:    points,
		},
	}, nil
}

// QueryLogs queries logs based on filters
func (h *MetricsHandler) QueryLogs(ctx context.Context, input *dto.LogQueryInput) (*dto.LogQueryOutput, error) {
	logger.Debug("Querying logs",
		logger.String("containers", input.ContainerIDs),
		logger.String("search", input.Search),
		logger.String("level", input.Level))

	start, end := parseTimeRange(input.StartTime, input.EndTime)

	// Parse container IDs
	var containerIDs []string
	if input.ContainerIDs != "" {
		containerIDs = strings.Split(input.ContainerIDs, ",")
		for i, id := range containerIDs {
			containerIDs[i] = strings.TrimSpace(id)
		}
	}

	query := &entity.LogQuery{
		ContainerIDs: containerIDs,
		StartTime:    start,
		EndTime:      end,
		Search:       input.Search,
		Level:        input.Level,
		Limit:        input.Limit,
		Offset:       input.Offset,
	}

	result := h.service.QueryLogs(query)

	// Convert to DTOs
	entries := make([]dto.LogEntryDTO, 0, len(result.Entries))
	for _, e := range result.Entries {
		entries = append(entries, dto.LogEntryDTO{
			Timestamp:     e.Timestamp,
			ContainerID:   e.ContainerID,
			ContainerName: e.ContainerName,
			Stream:        e.Stream,
			Message:       e.Message,
			Level:         e.Level,
			Fields:        e.Fields,
		})
	}

	logger.Info("Logs queried",
		logger.Int("total_count", result.TotalCount),
		logger.Int("returned", len(entries)))

	return &dto.LogQueryOutput{
		Body: dto.LogQueryResponse{
			Query: dto.LogQueryParams{
				ContainerIDs: containerIDs,
				StartTime:    start,
				EndTime:      end,
				Search:       input.Search,
				Level:        input.Level,
				Limit:        input.Limit,
				Offset:       input.Offset,
			},
			Entries:    entries,
			TotalCount: result.TotalCount,
			HasMore:    result.HasMore,
		},
	}, nil
}

// AggregateLogs aggregates logs by time buckets
func (h *MetricsHandler) AggregateLogs(ctx context.Context, input *dto.LogAggregationInput) (*dto.LogAggregationOutput, error) {
	logger.Debug("Aggregating logs",
		logger.String("containers", input.ContainerIDs),
		logger.String("interval", input.Interval))

	start, end := parseTimeRange(input.StartTime, input.EndTime)

	// Parse container IDs
	var containerIDs []string
	if input.ContainerIDs != "" {
		containerIDs = strings.Split(input.ContainerIDs, ",")
		for i, id := range containerIDs {
			containerIDs[i] = strings.TrimSpace(id)
		}
	}

	query := &entity.LogQuery{
		ContainerIDs: containerIDs,
		StartTime:    start,
		EndTime:      end,
		Search:       input.Search,
		Level:        input.Level,
	}

	interval := input.Interval
	if interval == "" {
		interval = "5m"
	}

	result := h.service.AggregateLogs(query, interval)

	// Convert to DTOs
	buckets := make([]dto.LogBucketDTO, 0, len(result.Buckets))
	for _, b := range result.Buckets {
		buckets = append(buckets, dto.LogBucketDTO{
			Timestamp: b.Timestamp,
			Count:     b.Count,
			ByLevel:   b.ByLevel,
			ByStream:  b.ByStream,
			BySource:  b.BySource,
		})
	}

	logger.Info("Logs aggregated",
		logger.Int64("total_count", result.TotalCount),
		logger.Int("buckets", len(buckets)))

	return &dto.LogAggregationOutput{
		Body: dto.LogAggregationResponse{
			Query: dto.LogQueryParams{
				ContainerIDs: containerIDs,
				StartTime:    start,
				EndTime:      end,
				Search:       input.Search,
				Level:        input.Level,
			},
			Interval:   interval,
			TotalCount: result.TotalCount,
			Buckets:    buckets,
			GroupData:  result.GroupData,
		},
	}, nil
}

// GetStats returns store statistics
func (h *MetricsHandler) GetStats(ctx context.Context, input *dto.MetricsStatsInput) (*dto.MetricsStatsOutput, error) {
	logger.Debug("Getting metrics store stats")

	stats := h.service.GetStoreStats()

	return &dto.MetricsStatsOutput{
		Body: dto.MetricsStatsResponse{
			ContainersTracked:     stats["containers_tracked"].(int),
			ContainerMetricPoints: stats["container_metric_points"].(int),
			SystemMetricPoints:    stats["system_metric_points"].(int),
			LogEntries:            stats["log_entries"].(int),
			RetentionPeriod:       stats["retention_period"].(string),
		},
	}, nil
}

// Helper functions

func parseTimeRange(startStr, endStr string) (time.Time, time.Time) {
	now := time.Now()
	end := now

	// Parse end time
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			end = t
		} else if dur := parseRelativeTime(endStr); dur != 0 {
			end = now.Add(dur)
		}
	}

	// Parse start time (default to 1 hour ago)
	start := end.Add(-1 * time.Hour)
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			start = t
		} else if dur := parseRelativeTime(startStr); dur != 0 {
			start = now.Add(dur)
		}
	}

	return start, end
}

func parseRelativeTime(s string) time.Duration {
	if len(s) < 2 {
		return 0
	}

	// Handle negative relative times like -1h, -24h, -3d
	negative := false
	if s[0] == '-' {
		negative = true
		s = s[1:]
	}

	var multiplier time.Duration
	var numStr string

	switch {
	case strings.HasSuffix(s, "d"):
		multiplier = 24 * time.Hour
		numStr = s[:len(s)-1]
	case strings.HasSuffix(s, "h"):
		multiplier = time.Hour
		numStr = s[:len(s)-1]
	case strings.HasSuffix(s, "m"):
		multiplier = time.Minute
		numStr = s[:len(s)-1]
	case strings.HasSuffix(s, "s"):
		multiplier = time.Second
		numStr = s[:len(s)-1]
	default:
		return 0
	}

	var num int
	for _, c := range numStr {
		if c >= '0' && c <= '9' {
			num = num*10 + int(c-'0')
		} else {
			return 0
		}
	}

	dur := time.Duration(num) * multiplier
	if negative {
		dur = -dur
	}

	return dur
}
