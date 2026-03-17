package service

import (
	"context"

	"github.com/IzuCas/docker-ui/internal/domain/client"
	"github.com/IzuCas/docker-ui/internal/domain/entity"
)

type RegistryService struct {
	client client.RegistryClient
}

func NewRegistryService(client client.RegistryClient) *RegistryService {
	return &RegistryService{client: client}
}

func (s *RegistryService) Login(ctx context.Context, auth entity.RegistryAuth) (*entity.RegistryLoginResult, error) {
	return s.client.Login(ctx, auth)
}

func (s *RegistryService) Logout(ctx context.Context, serverAddress string) error {
	return s.client.Logout(ctx, serverAddress)
}

func (s *RegistryService) GetProxyConfig(ctx context.Context) (*entity.ProxyConfig, error) {
	return s.client.GetProxyConfig(ctx)
}

func (s *RegistryService) SetProxyConfig(ctx context.Context, config entity.ProxyConfig) error {
	return s.client.SetProxyConfig(ctx, config)
}

func (s *RegistryService) ListRegistries(ctx context.Context) ([]entity.RegistryInfo, error) {
	return s.client.ListRegistries(ctx)
}
