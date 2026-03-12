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
	ID      string
	Names   []string
	Image   string
	ImageID string
	Command string
	Created time.Time
	State   string
	Status  string
	Ports   []PortMapping
	Labels  map[string]string
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
	ExitCode int
	Output   string
}

// ContainerStats represents container statistics
type ContainerStats struct {
	CPUPercent    float64
	MemoryUsage   int64
	MemoryLimit   int64
	MemoryPercent float64
	NetworkRx     int64
	NetworkTx     int64
	BlockRead     int64
	BlockWrite    int64
	PIDs          int64
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
