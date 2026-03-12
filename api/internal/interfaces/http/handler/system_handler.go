package handler

import (
"context"

"app/example/internal/application/service"
"app/example/internal/interfaces/http/dto"
)

type SystemHandler struct {
	service *service.SystemService
}

func NewSystemHandler(service *service.SystemService) *SystemHandler {
	return &SystemHandler{service: service}
}

func (h *SystemHandler) Info(ctx context.Context, input *dto.SystemInfoInput) (*dto.SystemInfoOutput, error) {
	info, err := h.service.Info(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.SystemInfoOutput{
		Body: dto.SystemInfoResponse{
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
		},
	}, nil
}

func (h *SystemHandler) Version(ctx context.Context, input *dto.SystemVersionInput) (*dto.SystemVersionOutput, error) {
	version, err := h.service.Version(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.SystemVersionOutput{
		Body: dto.VersionResponse{
			Version:       version.Version,
			APIVersion:    version.APIVersion,
			MinAPIVersion: version.MinAPIVersion,
			GitCommit:     version.GitCommit,
			GoVersion:     version.GoVersion,
			Os:            version.Os,
			Arch:          version.Arch,
			KernelVersion: version.KernelVersion,
			BuildTime:     version.BuildTime,
		},
	}, nil
}

func (h *SystemHandler) DiskUsage(ctx context.Context, input *dto.SystemDiskUsageInput) (*dto.SystemDiskUsageOutput, error) {
	usage, err := h.service.DiskUsage(ctx)
	if err != nil {
		return nil, err
	}

	images := make([]dto.ImageDiskUsageResponse, len(usage.Images))
	for i, img := range usage.Images {
		images[i] = dto.ImageDiskUsageResponse{
			ID:         img.ID,
			RepoTags:   img.RepoTags,
			Created:    img.Created,
			Size:       img.Size,
			SharedSize: img.SharedSize,
			Containers: img.Containers,
		}
	}

	containers := make([]dto.ContainerDiskUsageResponse, len(usage.Containers))
	for i, c := range usage.Containers {
		containers[i] = dto.ContainerDiskUsageResponse{
			ID:         c.ID,
			Names:      c.Names,
			Image:      c.Image,
			SizeRw:     c.SizeRw,
			SizeRootFs: c.SizeRootFs,
			Created:    c.Created,
			State:      c.State,
		}
	}

	volumes := make([]dto.VolumeDiskUsageResponse, len(usage.Volumes))
	for i, v := range usage.Volumes {
		volumes[i] = dto.VolumeDiskUsageResponse{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			Size:       v.Size,
			RefCount:   v.RefCount,
		}
	}

	return &dto.SystemDiskUsageOutput{
		Body: dto.DiskUsageResponse{
			LayersSize: usage.LayersSize,
			Images:     images,
			Containers: containers,
			Volumes:    volumes,
		},
	}, nil
}

func (h *SystemHandler) Ping(ctx context.Context, input *dto.SystemPingInput) (*dto.SystemPingOutput, error) {
	if err := h.service.Ping(ctx); err != nil {
		return nil, err
	}

	return &dto.SystemPingOutput{
		Body: struct {
			Status string `json:"status"`
		}{Status: "OK"},
	}, nil
}
