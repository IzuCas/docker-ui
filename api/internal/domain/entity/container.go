package entity

import "time"

// ContainerState represents the state of a container
type ContainerState struct {
	Status     string
	Running    bool
	Paused     bool
	Restarting bool
	Dead       bool
	Pid        int
	ExitCode   int
	StartedAt  time.Time
	FinishedAt time.Time
	Health     *HealthState
}

// HealthState represents container health check state
type HealthState struct {
	Status        string
	FailingStreak int
	Log           []HealthLog
}

// HealthLog represents a health check log entry
type HealthLog struct {
	Start    time.Time
	End      time.Time
	ExitCode int
	Output   string
}

// PortBinding represents a port binding configuration
type PortBinding struct {
	HostIP   string
	HostPort string
}

// PortMapping represents container port mapping
type PortMapping struct {
	IP          string
	PrivatePort uint16
	PublicPort  uint16
	Type        string
}

// Mount represents a container mount point
type Mount struct {
	Type        string
	Source      string
	Destination string
	Mode        string
	RW          bool
}

// NetworkSettings represents container network settings
type NetworkSettings struct {
	IPAddress   string
	Gateway     string
	MacAddress  string
	NetworkMode string
	Ports       []PortMapping
}

// Container represents a Docker container
type Container struct {
	ID              string
	Name            string
	Image           string
	ImageID         string
	Command         string
	Created         time.Time
	State           ContainerState
	Labels          map[string]string
	Env             []string
	Mounts          []Mount
	Ports           []PortMapping
	NetworkSettings NetworkSettings
}

// ContainerSummary represents a summary of a container (for listing)
type ContainerSummary struct {
	ID      string            `json:"id"`
	Names   []string          `json:"names"`
	Image   string            `json:"image"`
	ImageID string            `json:"imageId"`
	Command string            `json:"command"`
	Created time.Time         `json:"created"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Ports   []PortMapping     `json:"ports,omitempty"`
	Labels  map[string]string `json:"labels,omitempty"`
}

// ContainerCreateConfig represents configuration for creating a container
type ContainerCreateConfig struct {
	Name            string
	Image           string
	Cmd             []string
	Env             []string
	ExposedPorts    map[string]struct{}
	PortBindings    map[string][]PortBinding
	Volumes         map[string]struct{}
	Mounts          []Mount
	Labels          map[string]string
	WorkingDir      string
	User            string
	Hostname        string
	NetworkMode     string
	RestartPolicy   string
	Memory          int64
	MemorySwap      int64
	CPUShares       int64
	CPUPeriod       int64
	CPUQuota        int64
	Privileged      bool
	AutoRemove      bool
	PublishAllPorts bool
}

// ContainerLogsOptions represents container log options
type ContainerLogsOptions struct {
	ShowStdout bool
	ShowStderr bool
	Since      string
	Until      string
	Timestamps bool
	Follow     bool
	Tail       string
}

// ExecConfig represents exec configuration
type ExecConfig struct {
	Cmd          []string
	Env          []string
	WorkingDir   string
	User         string
	Privileged   bool
	Tty          bool
	AttachStdin  bool
	AttachStdout bool
	AttachStderr bool
}

// ExecResult represents exec result
type ExecResult struct {
	ExitCode int    `json:"exitCode"`
	Output   string `json:"output"`
}

// ContainerStats represents container statistics
type ContainerStats struct {
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsage   int64   `json:"memoryUsage"`
	MemoryLimit   int64   `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetworkRx     int64   `json:"networkRx"`
	NetworkTx     int64   `json:"networkTx"`
	BlockRead     int64   `json:"blockRead"`
	BlockWrite    int64   `json:"blockWrite"`
	PIDs          int64   `json:"pids"`
}

// Resources represents container resource configuration
type Resources struct {
	Memory        int64
	CPUShares     int64
	CPUPeriod     int64
	CPUQuota      int64
	RestartPolicy string
}

// ContainerChange represents a filesystem change in a container
type ContainerChange struct {
	Kind int
	Path string
}

// PathStat represents file/directory stat information
type PathStat struct {
	Name       string
	Size       int64
	Mode       uint32
	ModTime    time.Time
	LinkTarget string
}

// DockerEvent represents a Docker event
type DockerEvent struct {
	Type     string     `json:"type"`
	Action   string     `json:"action"`
	Actor    EventActor `json:"actor"`
	Time     int64      `json:"time"`
	TimeNano int64      `json:"timeNano"`
}

// EventActor represents the actor of an event
type EventActor struct {
	ID         string            `json:"id"`
	Attributes map[string]string `json:"attributes"`
}

// LogEntry represents a log entry
type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Stream    string `json:"stream"`
	Message   string `json:"message"`
}
