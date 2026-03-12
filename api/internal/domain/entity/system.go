package entity

// SystemInfo represents Docker system information
type SystemInfo struct {
	ID                string
	Containers        int
	ContainersRunning int
	ContainersPaused  int
	ContainersStopped int
	Images            int
	Driver            string
	MemoryLimit       bool
	SwapLimit         bool
	KernelVersion     string
	OperatingSystem   string
	OSType            string
	Architecture      string
	NCPU              int
	MemTotal          int64
	DockerRootDir     string
	Name              string
	ServerVersion     string
}

// DiskUsage represents Docker disk usage
type DiskUsage struct {
	LayersSize  int64
	Images      []ImageDiskUsage
	Containers  []ContainerDiskUsage
	Volumes     []VolumeDiskUsage
	BuildCache  []BuildCacheDiskUsage
}

// ImageDiskUsage represents image disk usage
type ImageDiskUsage struct {
	ID          string
	RepoTags    []string
	Created     int64
	Size        int64
	SharedSize  int64
	Containers  int64
}

// ContainerDiskUsage represents container disk usage
type ContainerDiskUsage struct {
	ID         string
	Names      []string
	Image      string
	SizeRw     int64
	SizeRootFs int64
	Created    int64
	State      string
}

// VolumeDiskUsage represents volume disk usage
type VolumeDiskUsage struct {
	Name       string
	Driver     string
	Mountpoint string
	Size       int64
	RefCount   int64
}

// BuildCacheDiskUsage represents build cache disk usage
type BuildCacheDiskUsage struct {
	ID          string
	Parent      string
	Type        string
	Description string
	InUse       bool
	Shared      bool
	Size        int64
	CreatedAt   int64
	LastUsedAt  int64
	UsageCount  int
}

// PruneReport represents the result of a prune operation
type PruneReport struct {
	ContainersDeleted []string
	ImagesDeleted     []string
	VolumesDeleted    []string
	NetworksDeleted   []string
	SpaceReclaimed    uint64
}

// Version represents Docker version information
type Version struct {
	Version       string
	APIVersion    string
	MinAPIVersion string
	GitCommit     string
	GoVersion     string
	Os            string
	Arch          string
	KernelVersion string
	BuildTime     string
}
