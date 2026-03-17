package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"

	"github.com/IzuCas/docker-ui/internal/domain/entity"
)

type SystemClient struct {
	docker *client.Client
}

func NewSystemClient(docker *client.Client) *SystemClient {
	return &SystemClient{docker: docker}
}

func (c *SystemClient) Info(ctx context.Context) (*entity.SystemInfo, error) {
	info, err := c.docker.Info(ctx)
	if err != nil {
		return nil, err
	}

	return &entity.SystemInfo{
		ID:                info.ID,
		Containers:        info.Containers,
		ContainersRunning: info.ContainersRunning,
		ContainersPaused:  info.ContainersPaused,
		ContainersStopped: info.ContainersStopped,
		Images:            info.Images,
		Driver:            info.Driver,
		MemoryLimit:       info.MemoryLimit,
		SwapLimit:         info.SwapLimit,
		KernelVersion:     info.KernelVersion,
		OperatingSystem:   info.OperatingSystem,
		OSType:            info.OSType,
		Architecture:      info.Architecture,
		NCPU:              info.NCPU,
		MemTotal:          info.MemTotal,
		DockerRootDir:     info.DockerRootDir,
		Name:              info.Name,
		ServerVersion:     info.ServerVersion,
	}, nil
}

func (c *SystemClient) Version(ctx context.Context) (*entity.Version, error) {
	version, err := c.docker.ServerVersion(ctx)
	if err != nil {
		return nil, err
	}

	return &entity.Version{
		Version:       version.Version,
		APIVersion:    version.APIVersion,
		MinAPIVersion: version.MinAPIVersion,
		GitCommit:     version.GitCommit,
		GoVersion:     version.GoVersion,
		Os:            version.Os,
		Arch:          version.Arch,
		KernelVersion: version.KernelVersion,
		BuildTime:     version.BuildTime,
	}, nil
}

func (c *SystemClient) DiskUsage(ctx context.Context) (*entity.DiskUsage, error) {
	usage, err := c.docker.DiskUsage(ctx, types.DiskUsageOptions{})
	if err != nil {
		return nil, err
	}

	images := make([]entity.ImageDiskUsage, len(usage.Images))
	for i, img := range usage.Images {
		images[i] = entity.ImageDiskUsage{
			ID:         img.ID,
			RepoTags:   img.RepoTags,
			Created:    img.Created,
			Size:       img.Size,
			SharedSize: img.SharedSize,
			Containers: img.Containers,
		}
	}

	containers := make([]entity.ContainerDiskUsage, len(usage.Containers))
	for i, cont := range usage.Containers {
		containers[i] = entity.ContainerDiskUsage{
			ID:         cont.ID,
			Names:      cont.Names,
			Image:      cont.Image,
			SizeRw:     cont.SizeRw,
			SizeRootFs: cont.SizeRootFs,
			Created:    cont.Created,
			State:      cont.State,
		}
	}

	volumes := make([]entity.VolumeDiskUsage, 0)
	if usage.Volumes != nil {
		for _, vol := range usage.Volumes {
			volumes = append(volumes, entity.VolumeDiskUsage{
				Name:       vol.Name,
				Driver:     vol.Driver,
				Mountpoint: vol.Mountpoint,
				Size:       vol.UsageData.Size,
				RefCount:   vol.UsageData.RefCount,
			})
		}
	}

	return &entity.DiskUsage{
		LayersSize: usage.LayersSize,
		Images:     images,
		Containers: containers,
		Volumes:    volumes,
	}, nil
}

func (c *SystemClient) Ping(ctx context.Context) error {
	_, err := c.docker.Ping(ctx)
	return err
}
