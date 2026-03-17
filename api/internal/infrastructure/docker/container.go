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

	"github.com/IzuCas/docker-ui/internal/domain/entity"
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
		ports := make([]entity.PortMapping, len(cont.Ports))
		for j, p := range cont.Ports {
			ports[j] = entity.PortMapping{
				IP:          p.IP,
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
			}
		}
		result[i] = entity.ContainerSummary{
			ID:      cont.ID,
			Names:   cont.Names,
			Image:   cont.Image,
			ImageID: cont.ImageID,
			Command: cont.Command,
			Created: time.Unix(cont.Created, 0),
			State:   cont.State,
			Status:  cont.Status,
			Ports:   ports,
			Labels:  cont.Labels,
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

	var health *entity.HealthState
	if cont.State.Health != nil {
		logs := make([]entity.HealthLog, len(cont.State.Health.Log))
		for i, l := range cont.State.Health.Log {
			start, _ := time.Parse(time.RFC3339Nano, l.Start.Format(time.RFC3339Nano))
			end, _ := time.Parse(time.RFC3339Nano, l.End.Format(time.RFC3339Nano))
			logs[i] = entity.HealthLog{
				Start:    start,
				End:      end,
				ExitCode: l.ExitCode,
				Output:   l.Output,
			}
		}
		health = &entity.HealthState{
			Status:        cont.State.Health.Status,
			FailingStreak: cont.State.Health.FailingStreak,
			Log:           logs,
		}
	}

	var healthcheck *entity.HealthcheckConfig
	if cont.Config.Healthcheck != nil && len(cont.Config.Healthcheck.Test) > 0 {
		healthcheck = &entity.HealthcheckConfig{
			Test:        cont.Config.Healthcheck.Test,
			Interval:    cont.Config.Healthcheck.Interval,
			Timeout:     cont.Config.Healthcheck.Timeout,
			StartPeriod: cont.Config.Healthcheck.StartPeriod,
			Retries:     cont.Config.Healthcheck.Retries,
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
			Health:     health,
		},
		Mounts:      mounts,
		Env:         cont.Config.Env,
		Labels:      cont.Config.Labels,
		Healthcheck: healthcheck,
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

// StreamEvents streams Docker events in real-time
func (c *ContainerClient) StreamEvents(ctx context.Context) (<-chan entity.DockerEvent, <-chan error) {
	eventsChan := make(chan entity.DockerEvent)
	errChan := make(chan error, 1)

	go func() {
		defer close(eventsChan)
		defer close(errChan)

		events, errs := c.docker.Events(ctx, types.EventsOptions{})

		for {
			select {
			case event, ok := <-events:
				if !ok {
					return
				}
				attributes := make(map[string]string)
				for k, v := range event.Actor.Attributes {
					attributes[k] = v
				}
				eventsChan <- entity.DockerEvent{
					Type:   string(event.Type),
					Action: string(event.Action),
					Actor: entity.EventActor{
						ID:         event.Actor.ID,
						Attributes: attributes,
					},
					Time:     event.Time,
					TimeNano: event.TimeNano,
				}
			case err := <-errs:
				if err != nil {
					errChan <- err
				}
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	return eventsChan, errChan
}

// StreamStats streams container stats in real-time
func (c *ContainerClient) StreamStats(ctx context.Context, id string) (<-chan *entity.ContainerStats, <-chan error) {
	statsChan := make(chan *entity.ContainerStats)
	errChan := make(chan error, 1)

	go func() {
		defer close(statsChan)
		defer close(errChan)

		resp, err := c.docker.ContainerStats(ctx, id, true) // true for streaming
		if err != nil {
			errChan <- err
			return
		}
		defer resp.Body.Close()

		decoder := json.NewDecoder(resp.Body)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				var stats types.StatsJSON
				if err := decoder.Decode(&stats); err != nil {
					if err != io.EOF {
						errChan <- err
					}
					return
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

				statsChan <- &entity.ContainerStats{
					CPUPercent:    cpuPercent,
					MemoryUsage:   int64(stats.MemoryStats.Usage),
					MemoryLimit:   int64(stats.MemoryStats.Limit),
					MemoryPercent: memPercent,
					NetworkRx:     int64(networkRx),
					NetworkTx:     int64(networkTx),
					BlockRead:     int64(blockRead),
					BlockWrite:    int64(blockWrite),
					PIDs:          int64(stats.PidsStats.Current),
				}
			}
		}
	}()

	return statsChan, errChan
}

// StreamLogs streams container logs in real-time
func (c *ContainerClient) StreamLogs(ctx context.Context, id string, tail string) (<-chan entity.LogEntry, <-chan error) {
	logsChan := make(chan entity.LogEntry)
	errChan := make(chan error, 1)

	go func() {
		defer close(logsChan)
		defer close(errChan)

		opts := container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Follow:     true,
			Tail:       tail,
			Timestamps: true,
		}

		reader, err := c.docker.ContainerLogs(ctx, id, opts)
		if err != nil {
			errChan <- err
			return
		}
		defer reader.Close()

		// Docker logs have an 8-byte header before each line
		// [stream type (1 byte)][0 0 0 (3 bytes)][size (4 bytes big-endian)][payload]
		header := make([]byte, 8)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				// Read header
				_, err := io.ReadFull(reader, header)
				if err != nil {
					if err != io.EOF {
						errChan <- err
					}
					return
				}

				// Determine stream type
				stream := "stdout"
				if header[0] == 2 {
					stream = "stderr"
				}

				// Get payload size
				size := int64(header[4])<<24 | int64(header[5])<<16 | int64(header[6])<<8 | int64(header[7])

				// Read payload
				payload := make([]byte, size)
				_, err = io.ReadFull(reader, payload)
				if err != nil {
					if err != io.EOF {
						errChan <- err
					}
					return
				}

				line := string(payload)
				timestamp := ""
				message := line

				// Parse timestamp if present (format: 2023-01-15T10:30:45.123456789Z message)
				if len(line) > 30 && line[29] == 'Z' {
					timestamp = line[:30]
					message = line[31:]
				}

				logsChan <- entity.LogEntry{
					Timestamp: timestamp,
					Stream:    stream,
					Message:   message,
				}
			}
		}
	}()

	return logsChan, errChan
}

// InspectRaw returns the raw Docker container inspect result
func (c *ContainerClient) InspectRaw(ctx context.Context, id string) (interface{}, error) {
	return c.docker.ContainerInspect(ctx, id)
}

// UpdateEnv updates container environment variables by recreating the container
func (c *ContainerClient) UpdateEnv(ctx context.Context, id string, env []string) (string, error) {
	// Get the current container configuration
	cont, err := c.docker.ContainerInspect(ctx, id)
	if err != nil {
		return "", err
	}

	// Check if container was running
	wasRunning := cont.State.Running

	// Stop the container if it's running
	if wasRunning {
		timeout := 10
		if err := c.docker.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeout}); err != nil {
			return "", err
		}
	}

	// Get the container name (remove leading slash)
	name := cont.Name
	if len(name) > 0 && name[0] == '/' {
		name = name[1:]
	}

	// Remove the old container
	if err := c.docker.ContainerRemove(ctx, id, container.RemoveOptions{Force: true}); err != nil {
		return "", err
	}

	// Clone the config with the new environment
	newConfig := *cont.Config
	newConfig.Env = env

	// Create the new container
	resp, err := c.docker.ContainerCreate(ctx, &newConfig, cont.HostConfig, nil, nil, name)
	if err != nil {
		return "", err
	}

	// Start the container if it was running before
	if wasRunning {
		if err := c.docker.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
			return "", err
		}
	}

	return resp.ID, nil
}
