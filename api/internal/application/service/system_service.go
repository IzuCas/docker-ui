package service

import (
	"context"

	"github.com/IzuCas/docker-ui/internal/domain/client"
	"github.com/IzuCas/docker-ui/internal/domain/entity"
)

type SystemService struct {
	client client.SystemClient
}

func NewSystemService(client client.SystemClient) *SystemService {
	return &SystemService{client: client}
}

func (s *SystemService) Info(ctx context.Context) (*entity.SystemInfo, error) {
	return s.client.Info(ctx)
}

func (s *SystemService) Version(ctx context.Context) (*entity.Version, error) {
	return s.client.Version(ctx)
}

func (s *SystemService) DiskUsage(ctx context.Context) (*entity.DiskUsage, error) {
	return s.client.DiskUsage(ctx)
}

func (s *SystemService) Ping(ctx context.Context) error {
	return s.client.Ping(ctx)
}
