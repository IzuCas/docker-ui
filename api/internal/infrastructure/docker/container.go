package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"strconv"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"

	"app/example/internal/domain/entity"
)

type ContainerClient struct {
	docker *client.Client
}

func NewContainerClient(docker *client.Client) *ContainerClient {
	return &ContainerClient{docker: docker}
}

func (c *ContainerClient) List(ctx context.Context, all bool) ([]entity.ContainerSummary, error) {
	containers, err := c.docker.ContainerList(ctx, container.ListOptions{All: all})
	if err != nil {
		return nil, err
	}

	result := make([]entity.ContainerSummary, len(containers))
	for i, cont := range containers {
		result[i] = entity.ContainerSummary{
			ID:      cont.ID,
			Names:   cont.Names,
			Image:   cont.Image,
			ImageID: cont.ImageID,
			Command: cont.Command,
			Created: time.Unix(cont.Created, 0),
			State:   cont.State,
			Status:  cont.Status,
		}
	}

	return result, nil
}

func (c *ContainerClient) Inspect(ctx context.Context, id string) (*entity.Container, error) {
	cont, err := c.docker.ContainerInspect(ctx, id)
	if err != nil {
		return nil, err
	}

	created, _ := time.Parse(time.RFC3339Nano, cont.Created)
	startedAt, _ := time.Parse(time.RFC3339Nano, cont.State.StartedAt)
	finishedAt, _ := time.Parse(time.RFC3339Nano, cont.State.FinishedAt)

	mounts := make([]entity.Mount, len(cont.Mounts))
	for i, m := range cont.Mounts {
		mounts[i] = entity.Mount{
			Type:        string(m.Type),
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
			RW:          m.RW,
		}
	}

	return &entity.Container{
		ID:      cont.ID,
		Name:    cont.Name,
		Image:   cont.Config.Image,
		ImageID: cont.Image,
		Command: cont.Path,
		Created: created,
		State: entity.ContainerState{
			Status:     cont.State.Status,
			Running:    cont.State.Running,
			Paused:     cont.State.Paused,
			Restarting: cont.State.Restarting,
			Dead:       cont.State.Dead,
			Pid:        cont.State.Pid,
			ExitCode:   cont.State.ExitCode,
			StartedAt:  startedAt,
			FinishedAt: finishedAt,
		},
		Mounts: mounts,
		Env:    cont.Config.Env,
		Labels: cont.Config.Labels,
	}, nil
}

func (c *ContainerClient) Create(ctx context.Context, config entity.ContainerCreateConfig) (string, error) {
	exposedPorts := nat.PortSet{}
	for port := range config.ExposedPorts {
		exposedPorts[nat.Port(port)] = struct{}{}
	}

	portBindings := nat.PortMap{}
	for port, bindings := range config.PortBindings {
		natBindings := make([]nat.PortBinding, len(bindings))
		for i, b := range bindings {
			natBindings[i] = nat.PortBinding{
				HostIP:   b.HostIP,
				HostPort: b.HostPort,
			}
		}
		portBindings[nat.Port(port)] = natBindings
	}

	mounts := make([]mount.Mount, len(config.Mounts))
	for i, m := range config.Mounts {
		mounts[i] = mount.Mount{
			Type:   mount.Type(m.Type),
			Source: m.Source,
			Target: m.Destination,
		}
	}

	containerConfig := &container.Config{
		Image:        config.Image,
		Cmd:          config.Cmd,
		Env:          config.Env,
		Labels:       config.Labels,
		ExposedPorts: exposedPorts,
		WorkingDir:   config.WorkingDir,
		User:         config.User,
	}

	var restartPolicy container.RestartPolicy
	switch config.RestartPolicy {
	case "always":
		restartPolicy = container.RestartPolicy{Name: "always"}
	case "unless-stopped":
		restartPolicy = container.RestartPolicy{Name: "unless-stopped"}
	case "on-failure":
		restartPolicy = container.RestartPolicy{Name: "on-failure"}
	default:
		restartPolicy = container.RestartPolicy{Name: "no"}
	}

	hostConfig := &container.HostConfig{
		PortBindings:    portBindings,
		Mounts:          mounts,
		NetworkMode:     container.NetworkMode(config.NetworkMode),
		RestartPolicy:   restartPolicy,
		AutoRemove:      config.AutoRemove,
		PublishAllPorts: config.PublishAllPorts,
		Privileged:      config.Privileged,
		Resources: container.Resources{
			Memory:    config.Memory,
			CPUShares: config.CPUShares,
			CPUPeriod: config.CPUPeriod,
			CPUQuota:  config.CPUQuota,
		},
	}

	resp, err := c.docker.ContainerCreate(ctx, containerConfig, hostConfig, &network.NetworkingConfig{}, nil, config.Name)
	if err != nil {
		return "", err
	}

	return resp.ID, nil
}

func (c *ContainerClient) Start(ctx context.Context, id string) error {
	return c.docker.ContainerStart(ctx, id, container.StartOptions{})
}

func (c *ContainerClient) Stop(ctx context.Context, id string, timeout int) error {
	t := timeout
	return c.docker.ContainerStop(ctx, id, container.StopOptions{Timeout: &t})
}

func (c *ContainerClient) Restart(ctx context.Context, id string, timeout int) error {
	t := timeout
	return c.docker.ContainerRestart(ctx, id, container.StopOptions{Timeout: &t})
}

func (c *ContainerClient) Pause(ctx context.Context, id string) error {
	return c.docker.ContainerPause(ctx, id)
}

func (c *ContainerClient) Unpause(ctx context.Context, id string) error {
	return c.docker.ContainerUnpause(ctx, id)
}

func (c *ContainerClient) Kill(ctx context.Context, id string, signal string) error {
	return c.docker.ContainerKill(ctx, id, signal)
}

func (c *ContainerClient) Remove(ctx context.Context, id string, force bool, volumes bool) error {
	return c.docker.ContainerRemove(ctx, id, container.RemoveOptions{
		Force:         force,
		RemoveVolumes: volumes,
	})
}

func (c *ContainerClient) Rename(ctx context.Context, id string, name string) error {
	return c.docker.ContainerRename(ctx, id, name)
}

func (c *ContainerClient) Logs(ctx context.Context, id string, options entity.ContainerLogsOptions) (string, error) {
	opts := container.LogsOptions{
		ShowStdout: options.ShowStdout,
		ShowStderr: options.ShowStderr,
		Since:      options.Since,
		Until:      options.Until,
		Timestamps: options.Timestamps,
		Follow:     false,
		Tail:       options.Tail,
	}

	reader, err := c.docker.ContainerLogs(ctx, id, opts)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	var buf bytes.Buffer
	_, err = io.Copy(&buf, reader)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}

func (c *ContainerClient) Stats(ctx context.Context, id string) (*entity.ContainerStats, error) {
	resp, err := c.docker.ContainerStats(ctx, id, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var stats types.StatsJSON
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, err
	}

	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)
	cpuPercent := 0.0
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * float64(stats.CPUStats.OnlineCPUs) * 100.0
	}

	memPercent := 0.0
	if stats.MemoryStats.Limit > 0 {
		memPercent = float64(stats.MemoryStats.Usage) / float64(stats.MemoryStats.Limit) * 100.0
	}

	var networkRx, networkTx uint64
	for _, v := range stats.Networks {
		networkRx += v.RxBytes
		networkTx += v.TxBytes
	}

	var blockRead, blockWrite uint64
	for _, v := range stats.BlkioStats.IoServiceBytesRecursive {
		switch v.Op {
		case "Read":
			blockRead += v.Value
		case "Write":
			blockWrite += v.Value
		}
	}

	return &entity.ContainerStats{
		CPUPercent:    cpuPercent,
		MemoryUsage:   int64(stats.MemoryStats.Usage),
		MemoryLimit:   int64(stats.MemoryStats.Limit),
		MemoryPercent: memPercent,
		NetworkRx:     int64(networkRx),
		NetworkTx:     int64(networkTx),
		BlockRead:     int64(blockRead),
		BlockWrite:    int64(blockWrite),
		PIDs:          int64(stats.PidsStats.Current),
	}, nil
}

func (c *ContainerClient) Exec(ctx context.Context, id string, config entity.ExecConfig) (*entity.ExecResult, error) {
	execConfig := types.ExecConfig{
		Cmd:          config.Cmd,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          config.Tty,
		Env:          config.Env,
		WorkingDir:   config.WorkingDir,
		User:         config.User,
		Privileged:   config.Privileged,
	}

	execID, err := c.docker.ContainerExecCreate(ctx, id, execConfig)
	if err != nil {
		return nil, err
	}

	resp, err := c.docker.ContainerExecAttach(ctx, execID.ID, types.ExecStartCheck{})
	if err != nil {
		return nil, err
	}
	defer resp.Close()

	var buf bytes.Buffer
	_, err = io.Copy(&buf, resp.Reader)
	if err != nil {
		return nil, err
	}

	inspectResp, err := c.docker.ContainerExecInspect(ctx, execID.ID)
	if err != nil {
		return nil, err
	}

	return &entity.ExecResult{
		ExitCode: inspectResp.ExitCode,
		Output:   buf.String(),
	}, nil
}

func (c *ContainerClient) Top(ctx context.Context, id string, psArgs string) ([]string, [][]string, error) {
	resp, err := c.docker.ContainerTop(ctx, id, []string{psArgs})
	if err != nil {
		return nil, nil, err
	}
	return resp.Titles, resp.Processes, nil
}

func (c *ContainerClient) Prune(ctx context.Context) ([]string, int64, error) {
	report, err := c.docker.ContainersPrune(ctx, filters.Args{})
	if err != nil {
		return nil, 0, err
	}
	return report.ContainersDeleted, int64(report.SpaceReclaimed), nil
}

func (c *ContainerClient) Wait(ctx context.Context, id string, condition string) (int64, error) {
	waitC, errC := c.docker.ContainerWait(ctx, id, container.WaitCondition(condition))

	select {
	case result := <-waitC:
		return result.StatusCode, nil
	case err := <-errC:
		return 0, err
	}
}

func (c *ContainerClient) Update(ctx context.Context, id string, resources entity.Resources) error {
	var restartPolicy container.RestartPolicy
	if resources.RestartPolicy != "" {
		restartPolicy = container.RestartPolicy{Name: container.RestartPolicyMode(resources.RestartPolicy)}
	}

	_, err := c.docker.ContainerUpdate(ctx, id, container.UpdateConfig{
		Resources: container.Resources{
			Memory:    resources.Memory,
			CPUShares: resources.CPUShares,
			CPUPeriod: resources.CPUPeriod,
			CPUQuota:  resources.CPUQuota,
		},
		RestartPolicy: restartPolicy,
	})
	return err
}

func (c *ContainerClient) Export(ctx context.Context, id string) (io.ReadCloser, error) {
	return c.docker.ContainerExport(ctx, id)
}

func (c *ContainerClient) Diff(ctx context.Context, id string) ([]entity.ContainerChange, error) {
	changes, err := c.docker.ContainerDiff(ctx, id)
	if err != nil {
		return nil, err
	}

	result := make([]entity.ContainerChange, len(changes))
	for i, change := range changes {
		result[i] = entity.ContainerChange{
			Kind: int(change.Kind),
			Path: change.Path,
		}
	}

	return result, nil
}

func (c *ContainerClient) Resize(ctx context.Context, id string, height, width uint) error {
	return c.docker.ContainerResize(ctx, id, container.ResizeOptions{
		Height: height,
		Width:  width,
	})
}

func (c *ContainerClient) GetArchive(ctx context.Context, id string, path string) (io.ReadCloser, *entity.PathStat, error) {
	reader, stat, err := c.docker.CopyFromContainer(ctx, id, path)
	if err != nil {
		return nil, nil, err
	}

	return reader, &entity.PathStat{
		Name:       stat.Name,
		Size:       stat.Size,
		Mode:       uint32(stat.Mode),
		ModTime:    stat.Mtime,
		LinkTarget: stat.LinkTarget,
	}, nil
}

func (c *ContainerClient) PutArchive(ctx context.Context, id string, path string, content io.Reader) error {
	return c.docker.CopyToContainer(ctx, id, path, content, types.CopyToContainerOptions{})
}

func (c *ContainerClient) Attach(ctx context.Context, id string) (types.HijackedResponse, error) {
	return c.docker.ContainerAttach(ctx, id, container.AttachOptions{
		Stream: true,
		Stdin:  true,
		Stdout: true,
		Stderr: true,
	})
}

func (c *ContainerClient) CopyFrom(ctx context.Context, id string, srcPath string) (io.ReadCloser, error) {
	reader, _, err := c.docker.CopyFromContainer(ctx, id, srcPath)
	return reader, err
}

func (c *ContainerClient) CopyTo(ctx context.Context, id string, dstPath string, content io.Reader) error {
	return c.docker.CopyToContainer(ctx, id, dstPath, content, types.CopyToContainerOptions{})
}

func (c *ContainerClient) InspectChanges(ctx context.Context, id string) ([]container.FilesystemChange, error) {
	return c.docker.ContainerDiff(ctx, id)
}

func intToString(i int) string {
	return strconv.Itoa(i)
}
