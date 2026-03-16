package service

import (
	"context"
	"io"

	"github.com/docker/docker/api/types/registry"

	"app/example/internal/domain/client"
	"app/example/internal/domain/entity"
)

type ImageService struct {
	client client.ImageClient
}

func NewImageService(client client.ImageClient) *ImageService {
	return &ImageService{client: client}
}

func (s *ImageService) List(ctx context.Context, all bool, filters map[string]string) ([]entity.ImageSummary, error) {
	return s.client.List(ctx, all)
}

func (s *ImageService) Inspect(ctx context.Context, id string) (*entity.ImageInspect, error) {
	return s.client.Inspect(ctx, id)
}

func (s *ImageService) Pull(ctx context.Context, image string, opts entity.ImagePullOptions) error {
	return s.client.Pull(ctx, image, opts)
}

func (s *ImageService) PullWithProgress(ctx context.Context, image string, opts entity.ImagePullOptions) (io.ReadCloser, error) {
	return s.client.PullWithProgress(ctx, image, opts)
}

func (s *ImageService) Remove(ctx context.Context, id string, force bool, pruneChildren bool) ([]string, []string, error) {
	return s.client.Remove(ctx, id, force, pruneChildren)
}

func (s *ImageService) Tag(ctx context.Context, source string, repo string, tag string) error {
	return s.client.Tag(ctx, source, repo, tag)
}

func (s *ImageService) History(ctx context.Context, id string) ([]entity.ImageHistory, error) {
	return s.client.History(ctx, id)
}

func (s *ImageService) Search(ctx context.Context, term string, limit int) ([]registry.SearchResult, error) {
	return s.client.Search(ctx, term, limit)
}

func (s *ImageService) Prune(ctx context.Context, all bool) ([]string, int64, error) {
	return s.client.Prune(ctx, all)
}
