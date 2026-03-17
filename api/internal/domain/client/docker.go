package client

import (
	"context"
	"io"

	"github.com/docker/docker/api/types/registry"

	"github.com/IzuCas/docker-ui/internal/domain/entity"
)

// ContainerClient defines the interface for container operations
type ContainerClient interface {
	List(ctx context.Context, all bool) ([]entity.ContainerSummary, error)
	Inspect(ctx context.Context, id string) (*entity.Container, error)
	InspectRaw(ctx context.Context, id string) (interface{}, error)
	Create(ctx context.Context, config entity.ContainerCreateConfig) (string, error)
	Start(ctx context.Context, id string) error
	Stop(ctx context.Context, id string, timeout int) error
	Restart(ctx context.Context, id string, timeout int) error
	Pause(ctx context.Context, id string) error
	Unpause(ctx context.Context, id string) error
	Kill(ctx context.Context, id string, signal string) error
	Remove(ctx context.Context, id string, force bool, volumes bool) error
	Rename(ctx context.Context, id string, name string) error
	Logs(ctx context.Context, id string, options entity.ContainerLogsOptions) (string, error)
	Stats(ctx context.Context, id string) (*entity.ContainerStats, error)
	Exec(ctx context.Context, id string, config entity.ExecConfig) (*entity.ExecResult, error)
	Top(ctx context.Context, id string, psArgs string) ([]string, [][]string, error)
	UpdateEnv(ctx context.Context, id string, env []string) (string, error)
	// Streaming methods
	StreamEvents(ctx context.Context) (<-chan entity.DockerEvent, <-chan error)
	StreamStats(ctx context.Context, id string) (<-chan *entity.ContainerStats, <-chan error)
	StreamLogs(ctx context.Context, id string, tail string) (<-chan entity.LogEntry, <-chan error)
}

// ImageClient defines the interface for image operations
type ImageClient interface {
	List(ctx context.Context, all bool) ([]entity.ImageSummary, error)
	Inspect(ctx context.Context, id string) (*entity.ImageInspect, error)
	Pull(ctx context.Context, image string, options entity.ImagePullOptions) error
	PullWithProgress(ctx context.Context, image string, options entity.ImagePullOptions) (io.ReadCloser, error)
	Remove(ctx context.Context, id string, force bool, pruneChildren bool) ([]string, []string, error)
	Tag(ctx context.Context, source string, repo string, tag string) error
	History(ctx context.Context, id string) ([]entity.ImageHistory, error)
	Search(ctx context.Context, term string, limit int) ([]registry.SearchResult, error)
	Prune(ctx context.Context, all bool) ([]string, int64, error)
}

// VolumeClient defines the interface for volume operations
type VolumeClient interface {
	List(ctx context.Context, filters map[string]string) ([]entity.Volume, error)
	Inspect(ctx context.Context, name string) (*entity.Volume, error)
	Create(ctx context.Context, options entity.VolumeCreateOptions) (*entity.Volume, error)
	Remove(ctx context.Context, name string, force bool) error
	Prune(ctx context.Context) (*entity.VolumePruneReport, error)
}

// NetworkClient defines the interface for network operations
type NetworkClient interface {
	List(ctx context.Context, filters map[string]string) ([]entity.NetworkSummary, error)
	Inspect(ctx context.Context, id string) (*entity.Network, error)
	Create(ctx context.Context, options entity.NetworkCreateOptions) (string, error)
	Remove(ctx context.Context, id string) error
	Connect(ctx context.Context, networkID string, options entity.NetworkConnectOptions) error
	Disconnect(ctx context.Context, networkID string, containerID string, force bool) error
	Prune(ctx context.Context) ([]string, error)
}

// SystemClient defines the interface for system operations
type SystemClient interface {
	Info(ctx context.Context) (*entity.SystemInfo, error)
	Version(ctx context.Context) (*entity.Version, error)
	DiskUsage(ctx context.Context) (*entity.DiskUsage, error)
	Ping(ctx context.Context) error
}

// RegistryClient defines the interface for registry operations
type RegistryClient interface {
	Login(ctx context.Context, auth entity.RegistryAuth) (*entity.RegistryLoginResult, error)
	Logout(ctx context.Context, serverAddress string) error
	GetProxyConfig(ctx context.Context) (*entity.ProxyConfig, error)
	SetProxyConfig(ctx context.Context, config entity.ProxyConfig) error
	ListRegistries(ctx context.Context) ([]entity.RegistryInfo, error)
}
