package handler

import (
	"context"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
)

type ContainerHandler struct {
	service *service.ContainerService
}

func NewContainerHandler(service *service.ContainerService) *ContainerHandler {
	return &ContainerHandler{service: service}
}

func (h *ContainerHandler) List(ctx context.Context, input *dto.ContainerListInput) (*dto.ContainerListOutput, error) {
	containers, err := h.service.List(ctx, input.All)
	if err != nil {
		return nil, err
	}

	response := make([]dto.ContainerSummaryResponse, len(containers))
	for i, c := range containers {
		response[i] = dto.ContainerSummaryResponse{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			ImageID: c.ImageID,
			Command: c.Command,
			Created: c.Created.Format("2006-01-02T15:04:05Z"),
			State:   c.State,
			Status:  c.Status,
		}
	}

	return &dto.ContainerListOutput{Body: response}, nil
}

func (h *ContainerHandler) Inspect(ctx context.Context, input *dto.ContainerInspectInput) (*dto.ContainerInspectOutput, error) {
	container, err := h.service.Inspect(ctx, input.ID)
	if err != nil {
		return nil, err
	}

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
			},
			Mounts: mounts,
			Env:    container.Env,
			Labels: container.Labels,
		},
	}, nil
}

func (h *ContainerHandler) Create(ctx context.Context, input *dto.ContainerCreateInput) (*dto.ContainerCreateOutput, error) {
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
		return nil, err
	}

	return &dto.ContainerCreateOutput{
		Body: struct {
			ID string `json:"id"`
		}{ID: id},
	}, nil
}

func (h *ContainerHandler) Start(ctx context.Context, input *dto.ContainerActionInput) (*dto.ContainerActionOutput, error) {
	if err := h.service.Start(ctx, input.ID); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Stop(ctx context.Context, input *dto.ContainerStopInput) (*dto.ContainerActionOutput, error) {
	timeout := input.Timeout
	if timeout == 0 {
		timeout = 10
	}
	if err := h.service.Stop(ctx, input.ID, timeout); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Restart(ctx context.Context, input *dto.ContainerStopInput) (*dto.ContainerActionOutput, error) {
	timeout := input.Timeout
	if timeout == 0 {
		timeout = 10
	}
	if err := h.service.Restart(ctx, input.ID, timeout); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Pause(ctx context.Context, input *dto.ContainerActionInput) (*dto.ContainerActionOutput, error) {
	if err := h.service.Pause(ctx, input.ID); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Unpause(ctx context.Context, input *dto.ContainerActionInput) (*dto.ContainerActionOutput, error) {
	if err := h.service.Unpause(ctx, input.ID); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Kill(ctx context.Context, input *dto.ContainerKillInput) (*dto.ContainerActionOutput, error) {
	signal := input.Signal
	if signal == "" {
		signal = "SIGKILL"
	}
	if err := h.service.Kill(ctx, input.ID, signal); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Remove(ctx context.Context, input *dto.ContainerRemoveInput) (*dto.ContainerActionOutput, error) {
	if err := h.service.Remove(ctx, input.ID, input.Force, input.RemoveVolumes); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Rename(ctx context.Context, input *dto.ContainerRenameInput) (*dto.ContainerActionOutput, error) {
	if err := h.service.Rename(ctx, input.ID, input.Name); err != nil {
		return nil, err
	}
	return &dto.ContainerActionOutput{}, nil
}

func (h *ContainerHandler) Logs(ctx context.Context, input *dto.ContainerLogsInput) (*dto.ContainerLogsOutput, error) {
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
		return nil, err
	}

	return &dto.ContainerLogsOutput{
		Body: struct {
			Logs string `json:"logs"`
		}{Logs: logs},
	}, nil
}

func (h *ContainerHandler) Stats(ctx context.Context, input *dto.ContainerStatsInput) (*dto.ContainerStatsOutput, error) {
	stats, err := h.service.Stats(ctx, input.ID)
	if err != nil {
		return nil, err
	}

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
		return nil, err
	}

	return &dto.ContainerExecOutput{
		Body: dto.ExecResultResponse{
			ExitCode: result.ExitCode,
			Output:   result.Output,
		},
	}, nil
}

func (h *ContainerHandler) Top(ctx context.Context, input *dto.ContainerTopInput) (*dto.ContainerTopOutput, error) {
	psArgs := input.PsArgs
	if psArgs == "" {
		psArgs = "aux"
	}

	titles, processes, err := h.service.Top(ctx, input.ID, psArgs)
	if err != nil {
		return nil, err
	}

	return &dto.ContainerTopOutput{
		Body: dto.ContainerTopResponse{
			Titles:    titles,
			Processes: processes,
		},
	}, nil
}

func (h *ContainerHandler) UpdateEnv(ctx context.Context, input *dto.ContainerUpdateEnvInput) (*dto.ContainerUpdateEnvOutput, error) {
	newID, err := h.service.UpdateEnv(ctx, input.ID, input.Body.Env)
	if err != nil {
		return nil, err
	}

	return &dto.ContainerUpdateEnvOutput{
		Body: dto.ContainerUpdateEnvResponse{
			ID:      newID,
			Message: "Container recreated with updated environment variables",
		},
	}, nil
}
