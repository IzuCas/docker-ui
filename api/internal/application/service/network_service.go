package service

import (
"context"

"app/example/internal/domain/client"
"app/example/internal/domain/entity"
)

type NetworkService struct {
	client client.NetworkClient
}

func NewNetworkService(client client.NetworkClient) *NetworkService {
	return &NetworkService{client: client}
}

func (s *NetworkService) List(ctx context.Context, filters map[string]string) ([]entity.NetworkSummary, error) {
	return s.client.List(ctx, filters)
}

func (s *NetworkService) Inspect(ctx context.Context, id string) (*entity.Network, error) {
	return s.client.Inspect(ctx, id)
}

func (s *NetworkService) Create(ctx context.Context, options entity.NetworkCreateOptions) (string, error) {
	return s.client.Create(ctx, options)
}

func (s *NetworkService) Remove(ctx context.Context, id string) error {
	return s.client.Remove(ctx, id)
}

func (s *NetworkService) Connect(ctx context.Context, networkID string, options entity.NetworkConnectOptions) error {
	return s.client.Connect(ctx, networkID, options)
}

func (s *NetworkService) Disconnect(ctx context.Context, networkID string, containerID string, force bool) error {
	return s.client.Disconnect(ctx, networkID, containerID, force)
}

func (s *NetworkService) Prune(ctx context.Context) ([]string, error) {
	return s.client.Prune(ctx)
}
