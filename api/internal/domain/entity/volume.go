package entity

// Volume represents a Docker volume
type Volume struct {
	Name       string
	Driver     string
	Mountpoint string
	CreatedAt  string
	Labels     map[string]string
	Scope      string
	Options    map[string]string
	UsageData  *VolumeUsageData
}

// VolumeUsageData represents volume usage information
type VolumeUsageData struct {
	Size     int64
	RefCount int64
}

// VolumeCreateOptions represents options for creating a volume
type VolumeCreateOptions struct {
	Name       string
	Driver     string
	DriverOpts map[string]string
	Labels     map[string]string
}

// VolumePruneReport represents the result of pruning volumes
type VolumePruneReport struct {
	VolumesDeleted []string
	SpaceReclaimed uint64
}
