package handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"github.com/IzuCas/docker-ui/internal/application/service"
	"github.com/IzuCas/docker-ui/internal/domain/entity"
	"github.com/IzuCas/docker-ui/internal/interfaces/http/dto"
	"github.com/IzuCas/docker-ui/pkg/auth"
	"github.com/IzuCas/docker-ui/pkg/logger"
)

type ContainerHandler struct {
	service *service.ContainerService
}

func NewContainerHandler(service *service.ContainerService) *ContainerHandler {
	return &ContainerHandler{service: service}
}

func (h *ContainerHandler) List(ctx context.Context, input *dto.ContainerListInput) (*dto.ContainerListOutput, error) {
	logger.Info("Listing containers", logger.Bool("all", input.All))

	containers, err := h.service.List(ctx, input.All)
	if err != nil {
		logger.Error("Failed to list containers", logger.Err(err))
		return nil, err
	}

	logger.Info("Listed containers successfully", logger.Int("count", len(containers)))

	response := make([]dto.ContainerSummaryResponse, len(containers))
	for i, c := range containers {
		ports := make([]dto.PortResponse, len(c.Ports))
		for j, p := range c.Ports {
			ports[j] = dto.PortResponse{
				IP:          p.IP,
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
			}
		}
		response[i] = dto.ContainerSummaryResponse{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			ImageID: c.ImageID,
			Command: c.Command,
			Created: c.Created.Format("2006-01-02T15:04:05Z"),
			State:   c.State,
			Status:  c.Status,
			Ports:   ports,
			Labels:  c.Labels,
		}
	}

	return &dto.ContainerListOutput{Body: response}, nil
}

func (h *ContainerHandler) Inspect(ctx context.Context, input *dto.ContainerInspectInput) (*dto.ContainerInspectOutput, error) {
	logger.Info("Inspecting container", logger.String("container_id", input.ID))

	container, err := h.service.Inspect(ctx, input.ID)
	if err != nil {
		logger.Error("Failed to inspect container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Debug("Container inspected successfully", logger.String("container_id", input.ID), logger.String("name", container.Name))

	mounts := make([]dto.MountResponse, len(container.Mounts))
	for i, m := range container.Mounts {
		mounts[i] = dto.MountResponse{
			Type:        m.Type,
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		}
	}

	var health *dto.HealthResponse
	if container.State.Health != nil {
		logs := make([]dto.HealthLogResponse, len(container.State.Health.Log))
		for i, l := range container.State.Health.Log {
			logs[i] = dto.HealthLogResponse{
				Start:    l.Start.Format("2006-01-02T15:04:05Z"),
				End:      l.End.Format("2006-01-02T15:04:05Z"),
				ExitCode: l.ExitCode,
				Output:   l.Output,
			}
		}
		health = &dto.HealthResponse{
			Status:        container.State.Health.Status,
			FailingStreak: container.State.Health.FailingStreak,
			Log:           logs,
		}
	}

	var healthcheck *dto.HealthcheckConfigResponse
	if container.Healthcheck != nil {
		healthcheck = &dto.HealthcheckConfigResponse{
			Test:        container.Healthcheck.Test,
			Interval:    container.Healthcheck.Interval.String(),
			Timeout:     container.Healthcheck.Timeout.String(),
			StartPeriod: container.Healthcheck.StartPeriod.String(),
			Retries:     container.Healthcheck.Retries,
		}
	}

	return &dto.ContainerInspectOutput{
		Body: dto.ContainerResponse{
			ID:      container.ID,
			Name:    container.Name,
			Image:   container.Image,
			ImageID: container.ImageID,
			Command: container.Command,
			Created: container.Created.Format("2006-01-02T15:04:05Z"),
			State: dto.ContainerStateResponse{
				Status:     container.State.Status,
				Running:    container.State.Running,
				Paused:     container.State.Paused,
				Restarting: container.State.Restarting,
				Dead:       container.State.Dead,
				Pid:        container.State.Pid,
				ExitCode:   container.State.ExitCode,
				StartedAt:  container.State.StartedAt.Format("2006-01-02T15:04:05Z"),
				FinishedAt: container.State.FinishedAt.Format("2006-01-02T15:04:05Z"),
				Health:     health,
			},
			Mounts:      mounts,
			Env:         container.Env,
			Labels:      container.Labels,
			Healthcheck: healthcheck,
		},
	}, nil
}

func (h *ContainerHandler) Create(ctx context.Context, input *dto.ContainerCreateInput) (*dto.ContainerCreateOutput, error) {
	logger.Info("Creating container", logger.String("name", input.Body.Name), logger.String("image", input.Body.Image))

	portBindings := make(map[string][]entity.PortBinding)
	for k, v := range input.Body.PortBindings {
		bindings := make([]entity.PortBinding, len(v))
		for i, pb := range v {
			bindings[i] = entity.PortBinding{
				HostIP:   pb.HostIP,
				HostPort: pb.HostPort,
			}
		}
		portBindings[k] = bindings
	}

	mounts := make([]entity.Mount, len(input.Body.Mounts))
	for i, m := range input.Body.Mounts {
		mounts[i] = entity.Mount{
			Type:        m.Type,
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		}
	}

	config := entity.ContainerCreateConfig{
		Name:            input.Body.Name,
		Image:           input.Body.Image,
		Cmd:             input.Body.Cmd,
		Env:             input.Body.Env,
		Labels:          input.Body.Labels,
		ExposedPorts:    input.Body.ExposedPorts,
		PortBindings:    portBindings,
		Mounts:          mounts,
		WorkingDir:      input.Body.WorkingDir,
		User:            input.Body.User,
		NetworkMode:     input.Body.NetworkMode,
		RestartPolicy:   input.Body.RestartPolicy,
		AutoRemove:      input.Body.AutoRemove,
		Memory:          input.Body.Memory,
		MemorySwap:      input.Body.MemorySwap,
		CPUShares:       input.Body.CPUShares,
		CPUPeriod:       input.Body.CPUPeriod,
		CPUQuota:        input.Body.CPUQuota,
		Privileged:      input.Body.Privileged,
		PublishAllPorts: input.Body.PublishAllPorts,
	}

	id, err := h.service.Create(ctx, config)
	if err != nil {
		logger.Error("Failed to create container", logger.String("name", input.Body.Name), logger.Err(err))
		return nil, err
	}

	logger.Info("Container created successfully", logger.String("container_id", id), logger.String("name", input.Body.Name))

	return &dto.ContainerCreateOutput{
		Body: struct {
			ID string `json:"id"`
		}{ID: id},
	}, nil
}

func (h *ContainerHandler) Start(ctx context.Context, input *dto.ContainerActionInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Starting container", logger.String("container_id", input.ID))

	if err := h.service.Start(ctx, input.ID); err != nil {
		logger.Error("Failed to start container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container started successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Stop(ctx context.Context, input *dto.ContainerStopInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Stopping container", logger.String("container_id", input.ID), logger.Int("timeout", input.Timeout))

	timeout := input.Timeout
	if timeout == 0 {
		timeout = 10
	}
	if err := h.service.Stop(ctx, input.ID, timeout); err != nil {
		logger.Error("Failed to stop container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container stopped successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Restart(ctx context.Context, input *dto.ContainerStopInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Restarting container", logger.String("container_id", input.ID), logger.Int("timeout", input.Timeout))

	timeout := input.Timeout
	if timeout == 0 {
		timeout = 10
	}
	if err := h.service.Restart(ctx, input.ID, timeout); err != nil {
		logger.Error("Failed to restart container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container restarted successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Pause(ctx context.Context, input *dto.ContainerActionInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Pausing container", logger.String("container_id", input.ID))

	if err := h.service.Pause(ctx, input.ID); err != nil {
		logger.Error("Failed to pause container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container paused successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Unpause(ctx context.Context, input *dto.ContainerActionInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Unpausing container", logger.String("container_id", input.ID))

	if err := h.service.Unpause(ctx, input.ID); err != nil {
		logger.Error("Failed to unpause container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container unpaused successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Kill(ctx context.Context, input *dto.ContainerKillInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Killing container", logger.String("container_id", input.ID), logger.String("signal", input.Signal))

	signal := input.Signal
	if signal == "" {
		signal = "SIGKILL"
	}
	if err := h.service.Kill(ctx, input.ID, signal); err != nil {
		logger.Error("Failed to kill container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container killed successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Remove(ctx context.Context, input *dto.ContainerRemoveInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Removing container", logger.String("container_id", input.ID), logger.Bool("force", input.Force), logger.Bool("remove_volumes", input.RemoveVolumes))

	if err := h.service.Remove(ctx, input.ID, input.Force, input.RemoveVolumes); err != nil {
		logger.Error("Failed to remove container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container removed successfully", logger.String("container_id", input.ID))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Rename(ctx context.Context, input *dto.ContainerRenameInput) (*dto.ContainerActionOutput, error) {
	logger.Info("Renaming container", logger.String("container_id", input.ID), logger.String("new_name", input.Name))

	if err := h.service.Rename(ctx, input.ID, input.Name); err != nil {
		logger.Error("Failed to rename container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container renamed successfully", logger.String("container_id", input.ID), logger.String("new_name", input.Name))
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Logs(ctx context.Context, input *dto.ContainerLogsInput) (*dto.ContainerLogsOutput, error) {
	logger.Debug("Fetching container logs", logger.String("container_id", input.ID), logger.String("tail", input.Tail))

	opts := entity.ContainerLogsOptions{
		ShowStdout: input.Stdout,
		ShowStderr: input.Stderr,
		Since:      input.Since,
		Until:      input.Until,
		Timestamps: input.Timestamps,
		Follow:     false,
		Tail:       input.Tail,
	}

	logs, err := h.service.Logs(ctx, input.ID, opts)
	if err != nil {
		logger.Error("Failed to fetch container logs", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Debug("Container logs fetched", logger.String("container_id", input.ID), logger.Int("length", len(logs)))

	return &dto.ContainerLogsOutput{
		Body: struct {
			Logs string `json:"logs"`
		}{Logs: logs},
	}, nil
}

func (h *ContainerHandler) Stats(ctx context.Context, input *dto.ContainerStatsInput) (*dto.ContainerStatsOutput, error) {
	logger.Debug("Fetching container stats", logger.String("container_id", input.ID))

	stats, err := h.service.Stats(ctx, input.ID)
	if err != nil {
		logger.Error("Failed to fetch container stats", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Debug("Container stats fetched", logger.String("container_id", input.ID), logger.Float64("cpu_percent", stats.CPUPercent))

	return &dto.ContainerStatsOutput{
		Body: dto.ContainerStatsResponse{
			CPUPercent:    stats.CPUPercent,
			MemoryUsage:   stats.MemoryUsage,
			MemoryLimit:   stats.MemoryLimit,
			MemoryPercent: stats.MemoryPercent,
			NetworkRx:     stats.NetworkRx,
			NetworkTx:     stats.NetworkTx,
			BlockRead:     stats.BlockRead,
			BlockWrite:    stats.BlockWrite,
			PIDs:          stats.PIDs,
		},
	}, nil
}

func (h *ContainerHandler) Exec(ctx context.Context, input *dto.ContainerExecInput) (*dto.ContainerExecOutput, error) {
	logger.Info("Executing command in container", logger.String("container_id", input.ID), logger.Any("cmd", input.Body.Cmd))

	// Privileged execution requires credential confirmation
	if input.Body.Privileged {
		creds := auth.LoadCredentials()
		if !creds.Verify(input.Body.ConfirmPassword) {
			return nil, huma.Error401Unauthorized("Password confirmation required for privileged execution")
		}
	}

	config := entity.ExecConfig{
		Cmd:          input.Body.Cmd,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          input.Body.Tty,
		Env:          input.Body.Env,
		WorkingDir:   input.Body.WorkingDir,
		User:         input.Body.User,
		Privileged:   input.Body.Privileged,
	}

	result, err := h.service.Exec(ctx, input.ID, config)
	if err != nil {
		logger.Error("Failed to execute command in container", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Command executed in container", logger.String("container_id", input.ID), logger.Int("exit_code", result.ExitCode))

	return &dto.ContainerExecOutput{
		Body: dto.ExecResultResponse{
			ExitCode: result.ExitCode,
			Output:   result.Output,
		},
	}, nil
}

func (h *ContainerHandler) Top(ctx context.Context, input *dto.ContainerTopInput) (*dto.ContainerTopOutput, error) {
	logger.Debug("Fetching container processes", logger.String("container_id", input.ID))

	psArgs := input.PsArgs
	if psArgs == "" {
		psArgs = "aux"
	}

	titles, processes, err := h.service.Top(ctx, input.ID, psArgs)
	if err != nil {
		logger.Error("Failed to fetch container processes", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Debug("Container processes fetched", logger.String("container_id", input.ID), logger.Int("processes_count", len(processes)))

	return &dto.ContainerTopOutput{
		Body: dto.ContainerTopResponse{
			Titles:    titles,
			Processes: processes,
		},
	}, nil
}

func (h *ContainerHandler) UpdateEnv(ctx context.Context, input *dto.ContainerUpdateEnvInput) (*dto.ContainerUpdateEnvOutput, error) {
	logger.Info("Updating container environment", logger.String("container_id", input.ID), logger.Int("env_count", len(input.Body.Env)))

	// Require credential confirmation to modify environment variables
	creds := auth.LoadCredentials()
	if !creds.Verify(input.Body.ConfirmPassword) {
		return nil, huma.Error401Unauthorized("Password confirmation required to update environment variables")
	}

	newID, err := h.service.UpdateEnv(ctx, input.ID, input.Body.Env)
	if err != nil {
		logger.Error("Failed to update container environment", logger.String("container_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container environment updated", logger.String("old_id", input.ID), logger.String("new_id", newID))

	return &dto.ContainerUpdateEnvOutput{
		Body: dto.ContainerUpdateEnvResponse{
			ID:      newID,
			Message: "Container recreated with updated environment variables",
		},
	}, nil
}
