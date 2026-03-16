package service

import (
	"context"

	"app/example/internal/domain/client"
	"app/example/internal/domain/entity"
)

type ContainerService struct {
	client client.ContainerClient
}

func NewContainerService(client client.ContainerClient) *ContainerService {
	return &ContainerService{client: client}
}

func (s *ContainerService) List(ctx context.Context, all bool) ([]entity.ContainerSummary, error) {
	return s.client.List(ctx, all)
}

func (s *ContainerService) Inspect(ctx context.Context, id string) (*entity.Container, error) {
	return s.client.Inspect(ctx, id)
}

func (s *ContainerService) Create(ctx context.Context, config entity.ContainerCreateConfig) (string, error) {
	return s.client.Create(ctx, config)
}

func (s *ContainerService) Start(ctx context.Context, id string) error {
	return s.client.Start(ctx, id)
}

func (s *ContainerService) Stop(ctx context.Context, id string, timeout int) error {
	return s.client.Stop(ctx, id, timeout)
}

func (s *ContainerService) Restart(ctx context.Context, id string, timeout int) error {
	return s.client.Restart(ctx, id, timeout)
}

func (s *ContainerService) Pause(ctx context.Context, id string) error {
	return s.client.Pause(ctx, id)
}

func (s *ContainerService) Unpause(ctx context.Context, id string) error {
	return s.client.Unpause(ctx, id)
}

func (s *ContainerService) Kill(ctx context.Context, id string, signal string) error {
	return s.client.Kill(ctx, id, signal)
}

func (s *ContainerService) Remove(ctx context.Context, id string, force bool, volumes bool) error {
	return s.client.Remove(ctx, id, force, volumes)
}

func (s *ContainerService) Rename(ctx context.Context, id string, name string) error {
	return s.client.Rename(ctx, id, name)
}

func (s *ContainerService) Logs(ctx context.Context, id string, options entity.ContainerLogsOptions) (string, error) {
	return s.client.Logs(ctx, id, options)
}

func (s *ContainerService) Stats(ctx context.Context, id string) (*entity.ContainerStats, error) {
	return s.client.Stats(ctx, id)
}

func (s *ContainerService) Exec(ctx context.Context, id string, config entity.ExecConfig) (*entity.ExecResult, error) {
	return s.client.Exec(ctx, id, config)
}

func (s *ContainerService) Top(ctx context.Context, id string, psArgs string) ([]string, [][]string, error) {
	return s.client.Top(ctx, id, psArgs)
}

// Streaming methods

func (s *ContainerService) StreamEvents(ctx context.Context) (<-chan entity.DockerEvent, <-chan error) {
	return s.client.StreamEvents(ctx)
}

func (s *ContainerService) StreamStats(ctx context.Context, id string) (<-chan *entity.ContainerStats, <-chan error) {
	return s.client.StreamStats(ctx, id)
}

func (s *ContainerService) StreamLogs(ctx context.Context, id string, tail string) (<-chan entity.LogEntry, <-chan error) {
	return s.client.StreamLogs(ctx, id, tail)
}

func (s *ContainerService) UpdateEnv(ctx context.Context, id string, env []string) (string, error) {
	return s.client.UpdateEnv(ctx, id, env)
}
