package handler

import (
	"context"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
)

type ImageHandler struct {
	service *service.ImageService
}

func NewImageHandler(service *service.ImageService) *ImageHandler {
	return &ImageHandler{service: service}
}

func (h *ImageHandler) List(ctx context.Context, input *dto.ImageListInput) (*dto.ImageListOutput, error) {
	images, err := h.service.List(ctx, input.All, input.Filters)
	if err != nil {
		return nil, err
	}

	response := make([]dto.ImageSummaryResponse, len(images))
	for i, img := range images {
		response[i] = dto.ImageSummaryResponse{
			ID:          img.ID,
			RepoTags:    img.RepoTags,
			RepoDigests: img.RepoDigests,
			Created:     img.Created.Format("2006-01-02T15:04:05Z"),
			Size:        img.Size,
			Labels:      img.Labels,
		}
	}

	return &dto.ImageListOutput{Body: response}, nil
}

func (h *ImageHandler) Inspect(ctx context.Context, input *dto.ImageInspectInput) (*dto.ImageInspectOutput, error) {
	image, err := h.service.Inspect(ctx, input.ID)
	if err != nil {
		return nil, err
	}

	return &dto.ImageInspectOutput{
		Body: dto.ImageInspectResponse{
			ID:          image.ID,
			RepoTags:    image.RepoTags,
			RepoDigests: image.RepoDigests,
			Created:     image.Created.Format("2006-01-02T15:04:05Z"),
			Size:        image.Size,
			VirtualSize: image.VirtualSize,
			Author:      image.Author,
			Config: dto.ImageConfigResponse{
				Hostname:     image.Config.Hostname,
				User:         image.Config.User,
				Env:          image.Config.Env,
				Cmd:          image.Config.Cmd,
				WorkingDir:   image.Config.WorkingDir,
				Entrypoint:   image.Config.Entrypoint,
				Labels:       image.Config.Labels,
				ExposedPorts: image.Config.ExposedPorts,
			},
			Architecture:  image.Architecture,
			Os:            image.Os,
			DockerVersion: image.DockerVersion,
		},
	}, nil
}

func (h *ImageHandler) Pull(ctx context.Context, input *dto.ImagePullInput) (*dto.ImagePullOutput, error) {
	opts := entity.ImagePullOptions{}
	if input.Body.Tag != nil {
		opts.Tag = *input.Body.Tag
	}
	if input.Body.Platform != nil {
		opts.Platform = *input.Body.Platform
	}

	if err := h.service.Pull(ctx, input.Body.Image, opts); err != nil {
		return nil, err
	}

	return &dto.ImagePullOutput{
		Body: struct {
			Status string `json:"status"`
		}{Status: "pulled"},
	}, nil
}

func (h *ImageHandler) Remove(ctx context.Context, input *dto.ImageRemoveInput) (*dto.ImageRemoveOutput, error) {
	deleted, untagged, err := h.service.Remove(ctx, input.ID, input.Force, input.PruneChildren)
	if err != nil {
		return nil, err
	}

	return &dto.ImageRemoveOutput{
		Body: dto.ImageRemoveResponse{
			Deleted:  deleted,
			Untagged: untagged,
		},
	}, nil
}

func (h *ImageHandler) Tag(ctx context.Context, input *dto.ImageTagInput) (*dto.ImageTagOutput, error) {
	if err := h.service.Tag(ctx, input.ID, input.Body.Repo, input.Body.Tag); err != nil {
		return nil, err
	}
	return &dto.ImageTagOutput{}, nil
}

func (h *ImageHandler) History(ctx context.Context, input *dto.ImageHistoryInput) (*dto.ImageHistoryOutput, error) {
	history, err := h.service.History(ctx, input.ID)
	if err != nil {
		return nil, err
	}

	response := make([]dto.ImageHistoryItem, len(history))
	for i, h := range history {
		response[i] = dto.ImageHistoryItem{
			ID:        h.ID,
			Created:   h.Created.Format("2006-01-02T15:04:05Z"),
			CreatedBy: h.CreatedBy,
			Size:      h.Size,
			Comment:   h.Comment,
			Tags:      h.Tags,
		}
	}

	return &dto.ImageHistoryOutput{Body: response}, nil
}

func (h *ImageHandler) Search(ctx context.Context, input *dto.ImageSearchInput) (*dto.ImageSearchOutput, error) {
	results, err := h.service.Search(ctx, input.Term, input.Limit)
	if err != nil {
		return nil, err
	}

	response := make([]dto.ImageSearchResult, len(results))
	for i, r := range results {
		response[i] = dto.ImageSearchResult{
			Name:        r.Name,
			Description: r.Description,
			StarCount:   r.StarCount,
			IsOfficial:  r.IsOfficial,
			IsAutomated: r.IsAutomated,
		}
	}

	return &dto.ImageSearchOutput{Body: response}, nil
}

func (h *ImageHandler) Prune(ctx context.Context, input *dto.ImagePruneInput) (*dto.ImagePruneOutput, error) {
	deleted, spaceReclaimed, err := h.service.Prune(ctx, input.All)
	if err != nil {
		return nil, err
	}

	return &dto.ImagePruneOutput{
		Body: dto.ImagePruneResponse{
			ImagesDeleted:  deleted,
			SpaceReclaimed: spaceReclaimed,
		},
	}, nil
}
