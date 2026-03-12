package handler

import (
	"context"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
)

type VolumeHandler struct {
	service *service.VolumeService
}

func NewVolumeHandler(service *service.VolumeService) *VolumeHandler {
	return &VolumeHandler{service: service}
}

func (h *VolumeHandler) List(ctx context.Context, input *dto.VolumeListInput) (*dto.VolumeListOutput, error) {
	volumes, err := h.service.List(ctx, input.Filters)
	if err != nil {
		return nil, err
	}

	response := make([]dto.VolumeResponse, len(volumes))
	for i, v := range volumes {
		var usage *dto.VolumeUsageResponse
		if v.UsageData != nil {
			usage = &dto.VolumeUsageResponse{
				Size:     v.UsageData.Size,
				RefCount: v.UsageData.RefCount,
			}
		}
		response[i] = dto.VolumeResponse{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			CreatedAt:  v.CreatedAt,
			Labels:     v.Labels,
			Scope:      v.Scope,
			Options:    v.Options,
			UsageData:  usage,
		}
	}

	return &dto.VolumeListOutput{Body: response}, nil
}

func (h *VolumeHandler) Inspect(ctx context.Context, input *dto.VolumeInspectInput) (*dto.VolumeInspectOutput, error) {
	volume, err := h.service.Inspect(ctx, input.Name)
	if err != nil {
		return nil, err
	}

	var usage *dto.VolumeUsageResponse
	if volume.UsageData != nil {
		usage = &dto.VolumeUsageResponse{
			Size:     volume.UsageData.Size,
			RefCount: volume.UsageData.RefCount,
		}
	}

	return &dto.VolumeInspectOutput{
		Body: dto.VolumeResponse{
			Name:       volume.Name,
			Driver:     volume.Driver,
			Mountpoint: volume.Mountpoint,
			CreatedAt:  volume.CreatedAt,
			Labels:     volume.Labels,
			Scope:      volume.Scope,
			Options:    volume.Options,
			UsageData:  usage,
		},
	}, nil
}

func (h *VolumeHandler) Create(ctx context.Context, input *dto.VolumeCreateInput) (*dto.VolumeCreateOutput, error) {
	opts := entity.VolumeCreateOptions{
		Name:       input.Body.Name,
		Driver:     input.Body.Driver,
		DriverOpts: input.Body.DriverOpts,
		Labels:     input.Body.Labels,
	}

	volume, err := h.service.Create(ctx, opts)
	if err != nil {
		return nil, err
	}

	return &dto.VolumeCreateOutput{
		Body: dto.VolumeResponse{
			Name:       volume.Name,
			Driver:     volume.Driver,
			Mountpoint: volume.Mountpoint,
			CreatedAt:  volume.CreatedAt,
			Labels:     volume.Labels,
			Scope:      volume.Scope,
			Options:    volume.Options,
		},
	}, nil
}

func (h *VolumeHandler) Remove(ctx context.Context, input *dto.VolumeRemoveInput) (*dto.VolumeRemoveOutput, error) {
	if err := h.service.Remove(ctx, input.Name, input.Force); err != nil {
		return nil, err
	}
	return &dto.VolumeRemoveOutput{}, nil
}

func (h *VolumeHandler) Prune(ctx context.Context, input *dto.VolumePruneInput) (*dto.VolumePruneOutput, error) {
	report, err := h.service.Prune(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.VolumePruneOutput{
		Body: dto.VolumePruneResponse{
			VolumesDeleted: report.VolumesDeleted,
			SpaceReclaimed: report.SpaceReclaimed,
		},
	}, nil
}
