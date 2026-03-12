package service

import (
"context"

"app/example/internal/domain/client"
"app/example/internal/domain/entity"
)

type VolumeService struct {
	client client.VolumeClient
}

func NewVolumeService(client client.VolumeClient) *VolumeService {
	return &VolumeService{client: client}
}

func (s *VolumeService) List(ctx context.Context, filters map[string]string) ([]entity.Volume, error) {
	return s.client.List(ctx, filters)
}

func (s *VolumeService) Inspect(ctx context.Context, name string) (*entity.Volume, error) {
	return s.client.Inspect(ctx, name)
}

func (s *VolumeService) Create(ctx context.Context, options entity.VolumeCreateOptions) (*entity.Volume, error) {
	return s.client.Create(ctx, options)
}

func (s *VolumeService) Remove(ctx context.Context, name string, force bool) error {
	return s.client.Remove(ctx, name, force)
}

func (s *VolumeService) Prune(ctx context.Context) (*entity.VolumePruneReport, error) {
	return s.client.Prune(ctx)
}
