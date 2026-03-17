package handler

import (
	"context"

	"github.com/IzuCas/docker-ui/internal/application/service"
	"github.com/IzuCas/docker-ui/internal/domain/entity"
	"github.com/IzuCas/docker-ui/internal/interfaces/http/dto"
	"github.com/IzuCas/docker-ui/pkg/logger"
)

type VolumeHandler struct {
	service *service.VolumeService
}

func NewVolumeHandler(service *service.VolumeService) *VolumeHandler {
	return &VolumeHandler{service: service}
}

func (h *VolumeHandler) List(ctx context.Context, input *dto.VolumeListInput) (*dto.VolumeListOutput, error) {
	logger.Info("Listing volumes")

	volumes, err := h.service.List(ctx, input.Filters)
	if err != nil {
		logger.Error("Failed to list volumes", logger.Err(err))
		return nil, err
	}

	logger.Info("Listed volumes successfully", logger.Int("count", len(volumes)))

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
	logger.Info("Inspecting volume", logger.String("name", input.Name))

	volume, err := h.service.Inspect(ctx, input.Name)
	if err != nil {
		logger.Error("Failed to inspect volume", logger.String("name", input.Name), logger.Err(err))
		return nil, err
	}

	logger.Debug("Volume inspected successfully", logger.String("name", input.Name))

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
	logger.Info("Creating volume", logger.String("name", input.Body.Name), logger.String("driver", input.Body.Driver))

	opts := entity.VolumeCreateOptions{
		Name:       input.Body.Name,
		Driver:     input.Body.Driver,
		DriverOpts: input.Body.DriverOpts,
		Labels:     input.Body.Labels,
	}

	volume, err := h.service.Create(ctx, opts)
	if err != nil {
		logger.Error("Failed to create volume", logger.String("name", input.Body.Name), logger.Err(err))
		return nil, err
	}

	logger.Info("Volume created successfully", logger.String("name", volume.Name))

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
	logger.Info("Removing volume", logger.String("name", input.Name), logger.Bool("force", input.Force))

	if err := h.service.Remove(ctx, input.Name, input.Force); err != nil {
		logger.Error("Failed to remove volume", logger.String("name", input.Name), logger.Err(err))
		return nil, err
	}

	logger.Info("Volume removed successfully", logger.String("name", input.Name))
	return &dto.VolumeRemoveOutput{}, nil
}

func (h *VolumeHandler) Prune(ctx context.Context, input *dto.VolumePruneInput) (*dto.VolumePruneOutput, error) {
	logger.Info("Pruning unused volumes")

	report, err := h.service.Prune(ctx)
	if err != nil {
		logger.Error("Failed to prune volumes", logger.Err(err))
		return nil, err
	}

	logger.Info("Volumes pruned successfully", logger.Int("deleted_count", len(report.VolumesDeleted)), logger.Int64("space_reclaimed", int64(report.SpaceReclaimed)))

	return &dto.VolumePruneOutput{
		Body: dto.VolumePruneResponse{
			VolumesDeleted: report.VolumesDeleted,
			SpaceReclaimed: report.SpaceReclaimed,
		},
	}, nil
}
