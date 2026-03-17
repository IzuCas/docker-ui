package service

import (
	"context"
	"time"

	"github.com/IzuCas/docker-ui/internal/domain/entity"
	"github.com/IzuCas/docker-ui/internal/infrastructure/metrics"
)

// MetricsService handles metrics operations
type MetricsService struct {
	store     *metrics.Store
	collector *metrics.Collector
}

// NewMetricsService creates a new metrics service
func NewMetricsService(store *metrics.Store, collector *metrics.Collector) *MetricsService {
	return &MetricsService{
		store:     store,
		collector: collector,
	}
}

// Start starts the metrics collection
func (s *MetricsService) Start(ctx context.Context) {
	s.collector.Start(ctx)
}

// Stop stops the metrics collection
func (s *MetricsService) Stop() {
	s.collector.Stop()
	s.store.Stop()
}

// GetContainerMetrics returns metrics for a specific container
func (s *MetricsService) GetContainerMetrics(containerID string, start, end time.Time) []*entity.ContainerMetrics {
	return s.store.GetContainerMetrics(containerID, start, end)
}

// GetAllContainerMetrics returns metrics for all containers
func (s *MetricsService) GetAllContainerMetrics(start, end time.Time) map[string][]*entity.ContainerMetrics {
	return s.store.GetAllContainerMetrics(start, end)
}

// GetSystemMetrics returns system metrics
func (s *MetricsService) GetSystemMetrics(start, end time.Time) []*entity.SystemMetrics {
	return s.store.GetSystemMetrics(start, end)
}

// GetLatestSystemMetrics returns the most recent system metrics
func (s *MetricsService) GetLatestSystemMetrics() *entity.SystemMetrics {
	return s.store.GetLatestSystemMetrics()
}

// GetLatestContainerMetrics returns the most recent metrics for each container
func (s *MetricsService) GetLatestContainerMetrics() map[string]*entity.ContainerMetrics {
	return s.store.GetLatestContainerMetrics()
}

// QueryLogs queries logs based on filters
func (s *MetricsService) QueryLogs(query *entity.LogQuery) *entity.LogQueryResult {
	return s.store.QueryLogs(query)
}

// AggregateLogs aggregates logs by time buckets
func (s *MetricsService) AggregateLogs(query *entity.LogQuery, interval string) *entity.LogAggregation {
	return s.store.AggregateLogs(query, interval)
}

// GetStoreStats returns store statistics
func (s *MetricsService) GetStoreStats() map[string]interface{} {
	return s.store.GetStats()
}

// AggregateContainerMetrics aggregates container metrics by resolution
func (s *MetricsService) AggregateContainerMetrics(containerID string, start, end time.Time, resolution string) []*entity.ContainerMetrics {
	rawMetrics := s.store.GetContainerMetrics(containerID, start, end)
	if len(rawMetrics) == 0 {
		return rawMetrics
	}

	// Parse resolution
	resolutionDuration := parseResolution(resolution)
	if resolutionDuration == 0 {
		return rawMetrics
	}

	// Aggregate by buckets
	buckets := make(map[time.Time][]*entity.ContainerMetrics)
	for _, m := range rawMetrics {
		bucketTime := m.Timestamp.Truncate(resolutionDuration)
		buckets[bucketTime] = append(buckets[bucketTime], m)
	}

	// Calculate averages for each bucket
	result := make([]*entity.ContainerMetrics, 0, len(buckets))
	for bucketTime, metricsInBucket := range buckets {
		if len(metricsInBucket) == 0 {
			continue
		}

		aggregated := &entity.ContainerMetrics{
			ContainerID:   containerID,
			ContainerName: metricsInBucket[0].ContainerName,
			Timestamp:     bucketTime,
		}

		var (
			cpuSum, memPercentSum       float64
			memUsageSum, memLimitSum    uint64
			networkRxSum, networkTxSum  uint64
			blockReadSum, blockWriteSum uint64
		)

		for _, m := range metricsInBucket {
			cpuSum += m.CPUPercent
			memPercentSum += m.MemoryPercent
			memUsageSum += m.MemoryUsage
			memLimitSum = m.MemoryLimit // Use last value
			networkRxSum += m.NetworkRxBytes
			networkTxSum += m.NetworkTxBytes
			blockReadSum += m.BlockRead
			blockWriteSum += m.BlockWrite
		}

		count := float64(len(metricsInBucket))
		aggregated.CPUPercent = cpuSum / count
		aggregated.MemoryPercent = memPercentSum / count
		aggregated.MemoryUsage = memUsageSum / uint64(count)
		aggregated.MemoryLimit = memLimitSum
		aggregated.NetworkRxBytes = networkRxSum
		aggregated.NetworkTxBytes = networkTxSum
		aggregated.BlockRead = blockReadSum
		aggregated.BlockWrite = blockWriteSum

		result = append(result, aggregated)
	}

	// Sort by timestamp
	sortMetricsByTime(result)

	return result
}

func parseResolution(resolution string) time.Duration {
	switch resolution {
	case "1m":
		return time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "30m":
		return 30 * time.Minute
	case "1h":
		return time.Hour
	case "6h":
		return 6 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 0
	}
}

func sortMetricsByTime(metrics []*entity.ContainerMetrics) {
	n := len(metrics)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if metrics[j].Timestamp.After(metrics[j+1].Timestamp) {
				metrics[j], metrics[j+1] = metrics[j+1], metrics[j]
			}
		}
	}
}
