package metrics

import (
	"sync"
	"time"

	"app/example/internal/domain/entity"
)

const (
	// DefaultRetentionPeriod is the default retention period for metrics (3 days)
	DefaultRetentionPeriod = 72 * time.Hour

	// DefaultCleanupInterval is how often to run cleanup
	DefaultCleanupInterval = 1 * time.Hour

	// MaxPointsPerMetric limits memory usage per metric series
	MaxPointsPerMetric = 259200 // 3 days at 1 second resolution
)

// Store is an in-memory metrics store with retention policy
type Store struct {
	mu sync.RWMutex

	// Container metrics indexed by container ID
	containerMetrics map[string][]*entity.ContainerMetrics

	// System metrics
	systemMetrics []*entity.SystemMetrics

	// Log entries indexed by container ID
	logEntries map[string][]*entity.MetricsLogEntry

	// Retention period
	retentionPeriod time.Duration

	// Cleanup ticker
	cleanupTicker *time.Ticker
	stopCleanup   chan struct{}
}

// NewStore creates a new metrics store with default retention
func NewStore() *Store {
	return NewStoreWithRetention(DefaultRetentionPeriod)
}

// NewStoreWithRetention creates a new metrics store with custom retention
func NewStoreWithRetention(retention time.Duration) *Store {
	s := &Store{
		containerMetrics: make(map[string][]*entity.ContainerMetrics),
		systemMetrics:    make([]*entity.SystemMetrics, 0),
		logEntries:       make(map[string][]*entity.MetricsLogEntry),
		retentionPeriod:  retention,
		stopCleanup:      make(chan struct{}),
	}

	// Start cleanup goroutine
	s.startCleanup()

	return s
}

// startCleanup starts the background cleanup goroutine
func (s *Store) startCleanup() {
	s.cleanupTicker = time.NewTicker(DefaultCleanupInterval)

	go func() {
		for {
			select {
			case <-s.cleanupTicker.C:
				s.cleanup()
			case <-s.stopCleanup:
				s.cleanupTicker.Stop()
				return
			}
		}
	}()
}

// Stop stops the cleanup goroutine
func (s *Store) Stop() {
	close(s.stopCleanup)
}

// cleanup removes old data beyond retention period
func (s *Store) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().Add(-s.retentionPeriod)

	// Cleanup container metrics
	for containerID, metrics := range s.containerMetrics {
		filtered := make([]*entity.ContainerMetrics, 0)
		for _, m := range metrics {
			if m.Timestamp.After(cutoff) {
				filtered = append(filtered, m)
			}
		}
		if len(filtered) > 0 {
			s.containerMetrics[containerID] = filtered
		} else {
			delete(s.containerMetrics, containerID)
		}
	}

	// Cleanup system metrics
	filtered := make([]*entity.SystemMetrics, 0)
	for _, m := range s.systemMetrics {
		if m.Timestamp.After(cutoff) {
			filtered = append(filtered, m)
		}
	}
	s.systemMetrics = filtered

	// Cleanup log entries
	for containerID, entries := range s.logEntries {
		filteredEntries := make([]*entity.MetricsLogEntry, 0)
		for _, e := range entries {
			if e.Timestamp.After(cutoff) {
				filteredEntries = append(filteredEntries, e)
			}
		}
		if len(filteredEntries) > 0 {
			s.logEntries[containerID] = filteredEntries
		} else {
			delete(s.logEntries, containerID)
		}
	}
}

// AddContainerMetrics adds container metrics to the store
func (s *Store) AddContainerMetrics(metrics *entity.ContainerMetrics) {
	s.mu.Lock()
	defer s.mu.Unlock()

	containerID := metrics.ContainerID
	if _, exists := s.containerMetrics[containerID]; !exists {
		s.containerMetrics[containerID] = make([]*entity.ContainerMetrics, 0)
	}

	s.containerMetrics[containerID] = append(s.containerMetrics[containerID], metrics)

	// Trim if too many points
	if len(s.containerMetrics[containerID]) > MaxPointsPerMetric {
		s.containerMetrics[containerID] = s.containerMetrics[containerID][len(s.containerMetrics[containerID])-MaxPointsPerMetric:]
	}
}

// AddSystemMetrics adds system metrics to the store
func (s *Store) AddSystemMetrics(metrics *entity.SystemMetrics) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.systemMetrics = append(s.systemMetrics, metrics)

	// Trim if too many points
	if len(s.systemMetrics) > MaxPointsPerMetric {
		s.systemMetrics = s.systemMetrics[len(s.systemMetrics)-MaxPointsPerMetric:]
	}
}

// AddLogEntry adds a log entry to the store
func (s *Store) AddLogEntry(entry *entity.MetricsLogEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	containerID := entry.ContainerID
	if _, exists := s.logEntries[containerID]; !exists {
		s.logEntries[containerID] = make([]*entity.MetricsLogEntry, 0)
	}

	s.logEntries[containerID] = append(s.logEntries[containerID], entry)

	// Trim if too many entries
	if len(s.logEntries[containerID]) > MaxPointsPerMetric {
		s.logEntries[containerID] = s.logEntries[containerID][len(s.logEntries[containerID])-MaxPointsPerMetric:]
	}
}

// GetContainerMetrics returns metrics for a container within time range
func (s *Store) GetContainerMetrics(containerID string, start, end time.Time) []*entity.ContainerMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	metrics, exists := s.containerMetrics[containerID]
	if !exists {
		return []*entity.ContainerMetrics{}
	}

	result := make([]*entity.ContainerMetrics, 0)
	for _, m := range metrics {
		if (m.Timestamp.Equal(start) || m.Timestamp.After(start)) && (m.Timestamp.Equal(end) || m.Timestamp.Before(end)) {
			result = append(result, m)
		}
	}

	return result
}

// GetAllContainerMetrics returns metrics for all containers within time range
func (s *Store) GetAllContainerMetrics(start, end time.Time) map[string][]*entity.ContainerMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string][]*entity.ContainerMetrics)
	for containerID, metrics := range s.containerMetrics {
		filtered := make([]*entity.ContainerMetrics, 0)
		for _, m := range metrics {
			if (m.Timestamp.Equal(start) || m.Timestamp.After(start)) && (m.Timestamp.Equal(end) || m.Timestamp.Before(end)) {
				filtered = append(filtered, m)
			}
		}
		if len(filtered) > 0 {
			result[containerID] = filtered
		}
	}

	return result
}

// GetSystemMetrics returns system metrics within time range
func (s *Store) GetSystemMetrics(start, end time.Time) []*entity.SystemMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*entity.SystemMetrics, 0)
	for _, m := range s.systemMetrics {
		if (m.Timestamp.Equal(start) || m.Timestamp.After(start)) && (m.Timestamp.Equal(end) || m.Timestamp.Before(end)) {
			result = append(result, m)
		}
	}

	return result
}

// GetLatestSystemMetrics returns the most recent system metrics
func (s *Store) GetLatestSystemMetrics() *entity.SystemMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.systemMetrics) == 0 {
		return nil
	}

	return s.systemMetrics[len(s.systemMetrics)-1]
}

// GetLatestContainerMetrics returns the most recent metrics for each container
func (s *Store) GetLatestContainerMetrics() map[string]*entity.ContainerMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]*entity.ContainerMetrics)
	for containerID, metrics := range s.containerMetrics {
		if len(metrics) > 0 {
			result[containerID] = metrics[len(metrics)-1]
		}
	}

	return result
}

// QueryLogs queries logs based on the provided query
func (s *Store) QueryLogs(query *entity.LogQuery) *entity.LogQueryResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := &entity.LogQueryResult{
		Query:   query,
		Entries: make([]*entity.MetricsLogEntry, 0),
	}

	// Collect entries from relevant containers
	var allEntries []*entity.MetricsLogEntry

	if len(query.ContainerIDs) > 0 {
		for _, containerID := range query.ContainerIDs {
			if entries, exists := s.logEntries[containerID]; exists {
				allEntries = append(allEntries, entries...)
			}
		}
	} else {
		// All containers
		for _, entries := range s.logEntries {
			allEntries = append(allEntries, entries...)
		}
	}

	// Filter by time range
	for _, entry := range allEntries {
		if !query.StartTime.IsZero() && entry.Timestamp.Before(query.StartTime) {
			continue
		}
		if !query.EndTime.IsZero() && entry.Timestamp.After(query.EndTime) {
			continue
		}

		// Filter by level
		if query.Level != "" && entry.Level != query.Level {
			continue
		}

		// Filter by search term (simple contains)
		if query.Search != "" && !containsIgnoreCase(entry.Message, query.Search) {
			continue
		}

		result.Entries = append(result.Entries, entry)
	}

	result.TotalCount = len(result.Entries)

	// Apply limit and offset
	if query.Offset > 0 && query.Offset < len(result.Entries) {
		result.Entries = result.Entries[query.Offset:]
	}

	if query.Limit > 0 && query.Limit < len(result.Entries) {
		result.Entries = result.Entries[:query.Limit]
		result.HasMore = true
	}

	return result
}

// AggregateLogs aggregates logs by time buckets
func (s *Store) AggregateLogs(query *entity.LogQuery, interval string) *entity.LogAggregation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Parse interval
	duration := parseInterval(interval)
	if duration == 0 {
		duration = 5 * time.Minute
	}

	result := &entity.LogAggregation{
		Interval: interval,
		Buckets:  make([]*entity.LogBucket, 0),
	}

	// Get filtered entries
	queryResult := s.QueryLogs(query)
	if len(queryResult.Entries) == 0 {
		return result
	}

	// Create buckets
	bucketMap := make(map[time.Time]*entity.LogBucket)

	for _, entry := range queryResult.Entries {
		bucketTime := entry.Timestamp.Truncate(duration)
		bucket, exists := bucketMap[bucketTime]
		if !exists {
			bucket = &entity.LogBucket{
				Timestamp: bucketTime,
				Count:     0,
				ByLevel:   make(map[string]int64),
				ByStream:  make(map[string]int64),
				BySource:  make(map[string]int64),
			}
			bucketMap[bucketTime] = bucket
		}

		bucket.Count++
		result.TotalCount++

		if entry.Level != "" {
			bucket.ByLevel[entry.Level]++
		}
		if entry.Stream != "" {
			bucket.ByStream[entry.Stream]++
		}
		if entry.ContainerName != "" {
			bucket.BySource[entry.ContainerName]++
		}
	}

	// Convert map to sorted slice
	for _, bucket := range bucketMap {
		result.Buckets = append(result.Buckets, bucket)
	}

	// Sort buckets by timestamp
	sortBuckets(result.Buckets)

	return result
}

// GetStats returns store statistics
func (s *Store) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	containerCount := len(s.containerMetrics)
	totalContainerPoints := 0
	for _, metrics := range s.containerMetrics {
		totalContainerPoints += len(metrics)
	}

	totalLogEntries := 0
	for _, entries := range s.logEntries {
		totalLogEntries += len(entries)
	}

	return map[string]interface{}{
		"containers_tracked":      containerCount,
		"container_metric_points": totalContainerPoints,
		"system_metric_points":    len(s.systemMetrics),
		"log_entries":             totalLogEntries,
		"retention_period":        s.retentionPeriod.String(),
	}
}

// Helper functions

func containsIgnoreCase(s, substr string) bool {
	// Simple case-insensitive contains
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || findIgnoreCase(s, substr))
}

func findIgnoreCase(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if equalIgnoreCase(s[i:i+len(substr)], substr) {
			return true
		}
	}
	return false
}

func equalIgnoreCase(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 32
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}

func parseInterval(interval string) time.Duration {
	switch interval {
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
	case "12h":
		return 12 * time.Hour
	case "1d":
		return 24 * time.Hour
	default:
		return 5 * time.Minute
	}
}

func sortBuckets(buckets []*entity.LogBucket) {
	// Simple bubble sort for buckets (usually small number)
	n := len(buckets)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if buckets[j].Timestamp.After(buckets[j+1].Timestamp) {
				buckets[j], buckets[j+1] = buckets[j+1], buckets[j]
			}
		}
	}
}
