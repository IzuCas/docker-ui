package handler

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/danielgtaylor/huma/v2"

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
	imageID, _ := url.QueryUnescape(input.ID)
	if imageID == "" {
		imageID = input.ID
	}
	image, err := h.service.Inspect(ctx, imageID)
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
	// URL decode the image ID to handle encoded characters like %3A for :
	imageID, _ := url.QueryUnescape(input.ID)
	if imageID == "" {
		imageID = input.ID
	}
	deleted, untagged, err := h.service.Remove(ctx, imageID, input.Force, input.PruneChildren)
	if err != nil {
		errMsg := err.Error()
		// Check for common Docker error patterns
		if strings.Contains(errMsg, "image is being used by") || strings.Contains(errMsg, "is using") {
			return nil, huma.Error409Conflict("Cannot remove image: it is being used by one or more containers. Stop and remove the containers first, or use force delete.")
		}
		if strings.Contains(errMsg, "No such image") {
			return nil, huma.Error404NotFound("Image not found")
		}
		if strings.Contains(errMsg, "image has dependent child images") {
			return nil, huma.Error409Conflict("Cannot remove image: it has dependent child images. Remove child images first.")
		}
		return nil, huma.Error500InternalServerError(errMsg)
	}

	return &dto.ImageRemoveOutput{
		Body: dto.ImageRemoveResponse{
			Deleted:  deleted,
			Untagged: untagged,
		},
	}, nil
}

func (h *ImageHandler) Tag(ctx context.Context, input *dto.ImageTagInput) (*dto.ImageTagOutput, error) {
	imageID, _ := url.QueryUnescape(input.ID)
	if imageID == "" {
		imageID = input.ID
	}
	if err := h.service.Tag(ctx, imageID, input.Body.Repo, input.Body.Tag); err != nil {
		return nil, err
	}
	return &dto.ImageTagOutput{}, nil
}

func (h *ImageHandler) History(ctx context.Context, input *dto.ImageHistoryInput) (*dto.ImageHistoryOutput, error) {
	imageID, _ := url.QueryUnescape(input.ID)
	if imageID == "" {
		imageID = input.ID
	}
	history, err := h.service.History(ctx, imageID)
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

// PullProgress represents a single progress update from Docker pull
type PullProgress struct {
	Status         string `json:"status"`
	ID             string `json:"id,omitempty"`
	Progress       string `json:"progress,omitempty"`
	ProgressDetail struct {
		Current int64 `json:"current,omitempty"`
		Total   int64 `json:"total,omitempty"`
	} `json:"progressDetail,omitempty"`
	Error string `json:"error,omitempty"`
}

// PullStream handles SSE streaming for image pull progress
func (h *ImageHandler) PullStream(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	imageName := r.URL.Query().Get("image")
	tag := r.URL.Query().Get("tag")
	platform := r.URL.Query().Get("platform")

	if imageName == "" {
		http.Error(w, "image parameter is required", http.StatusBadRequest)
		return
	}

	if tag == "" {
		tag = "latest"
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Build pull options
	opts := entity.ImagePullOptions{
		Tag:      tag,
		Platform: platform,
	}

	// Start the pull with progress
	reader, err := h.service.PullWithProgress(r.Context(), imageName, opts)
	if err != nil {
		errData, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(w, "data: %s\n\n", errData)
		flusher.Flush()
		return
	}
	defer reader.Close()

	// Stream progress updates
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		// Parse the progress JSON
		var progress PullProgress
		if err := json.Unmarshal([]byte(line), &progress); err != nil {
			continue
		}

		// Send as SSE event
		fmt.Fprintf(w, "data: %s\n\n", line)
		flusher.Flush()

		// Check if there's an error
		if progress.Error != "" {
			return
		}
	}

	// Send completion message
	completeData, _ := json.Marshal(map[string]string{"status": "complete", "message": fmt.Sprintf("Successfully pulled %s:%s", imageName, tag)})
	fmt.Fprintf(w, "data: %s\n\n", completeData)
	flusher.Flush()
}
