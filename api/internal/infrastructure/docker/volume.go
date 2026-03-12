package docker

import (
	"context"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"

	"app/example/internal/domain/entity"
)

type VolumeClient struct {
	docker *client.Client
}

func NewVolumeClient(docker *client.Client) *VolumeClient {
	return &VolumeClient{docker: docker}
}

func (c *VolumeClient) List(ctx context.Context, filterArgs map[string]string) ([]entity.Volume, error) {
	args := filters.NewArgs()
	for k, v := range filterArgs {
		args.Add(k, v)
	}

	resp, err := c.docker.VolumeList(ctx, volume.ListOptions{Filters: args})
	if err != nil {
		return nil, err
	}

	result := make([]entity.Volume, len(resp.Volumes))
	for i, vol := range resp.Volumes {
		var usageData *entity.VolumeUsageData
		if vol.UsageData != nil {
			usageData = &entity.VolumeUsageData{
				Size:     vol.UsageData.Size,
				RefCount: vol.UsageData.RefCount,
			}
		}
		result[i] = entity.Volume{
			Name:       vol.Name,
			Driver:     vol.Driver,
			Mountpoint: vol.Mountpoint,
			CreatedAt:  vol.CreatedAt,
			Labels:     vol.Labels,
			Scope:      vol.Scope,
			Options:    vol.Options,
			UsageData:  usageData,
		}
	}

	return result, nil
}

func (c *VolumeClient) Inspect(ctx context.Context, name string) (*entity.Volume, error) {
	vol, err := c.docker.VolumeInspect(ctx, name)
	if err != nil {
		return nil, err
	}

	var usageData *entity.VolumeUsageData
	if vol.UsageData != nil {
		usageData = &entity.VolumeUsageData{
			Size:     vol.UsageData.Size,
			RefCount: vol.UsageData.RefCount,
		}
	}

	return &entity.Volume{
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		CreatedAt:  vol.CreatedAt,
		Labels:     vol.Labels,
		Scope:      vol.Scope,
		Options:    vol.Options,
		UsageData:  usageData,
	}, nil
}

func (c *VolumeClient) Create(ctx context.Context, options entity.VolumeCreateOptions) (*entity.Volume, error) {
	vol, err := c.docker.VolumeCreate(ctx, volume.CreateOptions{
		Name:       options.Name,
		Driver:     options.Driver,
		DriverOpts: options.DriverOpts,
		Labels:     options.Labels,
	})
	if err != nil {
		return nil, err
	}

	return &entity.Volume{
		Name:       vol.Name,
		Driver:     vol.Driver,
		Mountpoint: vol.Mountpoint,
		CreatedAt:  vol.CreatedAt,
		Labels:     vol.Labels,
		Scope:      vol.Scope,
		Options:    vol.Options,
	}, nil
}

func (c *VolumeClient) Remove(ctx context.Context, name string, force bool) error {
	return c.docker.VolumeRemove(ctx, name, force)
}

func (c *VolumeClient) Prune(ctx context.Context) (*entity.VolumePruneReport, error) {
	report, err := c.docker.VolumesPrune(ctx, filters.Args{})
	if err != nil {
		return nil, err
	}

	return &entity.VolumePruneReport{
		VolumesDeleted: report.VolumesDeleted,
		SpaceReclaimed: report.SpaceReclaimed,
	}, nil
}
