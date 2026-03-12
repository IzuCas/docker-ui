package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"

	"app/example/internal/domain/entity"
)

type NetworkClient struct {
	docker *client.Client
}

func NewNetworkClient(docker *client.Client) *NetworkClient {
	return &NetworkClient{docker: docker}
}

func (c *NetworkClient) List(ctx context.Context, filterArgs map[string]string) ([]entity.NetworkSummary, error) {
	args := filters.NewArgs()
	for k, v := range filterArgs {
		args.Add(k, v)
	}

	networks, err := c.docker.NetworkList(ctx, types.NetworkListOptions{Filters: args})
	if err != nil {
		return nil, err
	}

	result := make([]entity.NetworkSummary, len(networks))
	for i, net := range networks {
		result[i] = entity.NetworkSummary{
			ID:         net.ID,
			Name:       net.Name,
			Driver:     net.Driver,
			Scope:      net.Scope,
			Internal:   net.Internal,
			Attachable: net.Attachable,
			Ingress:    net.Ingress,
			Created:    net.Created,
		}
	}

	return result, nil
}

func (c *NetworkClient) Inspect(ctx context.Context, id string) (*entity.Network, error) {
	net, err := c.docker.NetworkInspect(ctx, id, types.NetworkInspectOptions{})
	if err != nil {
		return nil, err
	}

	ipamConfigs := make([]entity.IPAMConfig, len(net.IPAM.Config))
	for i, cfg := range net.IPAM.Config {
		ipamConfigs[i] = entity.IPAMConfig{
			Subnet:     cfg.Subnet,
			IPRange:    cfg.IPRange,
			Gateway:    cfg.Gateway,
			AuxAddress: nil,
		}
	}

	containers := make(map[string]entity.EndpointResource)
	for id, ep := range net.Containers {
		containers[id] = entity.EndpointResource{
			Name:        ep.Name,
			EndpointID:  ep.EndpointID,
			MacAddress:  ep.MacAddress,
			IPv4Address: ep.IPv4Address,
			IPv6Address: ep.IPv6Address,
		}
	}

	return &entity.Network{
		ID:         net.ID,
		Name:       net.Name,
		Created:    net.Created,
		Scope:      net.Scope,
		Driver:     net.Driver,
		EnableIPv6: net.EnableIPv6,
		Internal:   net.Internal,
		Attachable: net.Attachable,
		Ingress:    net.Ingress,
		IPAM: entity.IPAM{
			Driver:  net.IPAM.Driver,
			Config:  ipamConfigs,
			Options: net.IPAM.Options,
		},
		Options:    net.Options,
		Labels:     net.Labels,
		Containers: containers,
	}, nil
}

func (c *NetworkClient) Create(ctx context.Context, options entity.NetworkCreateOptions) (string, error) {
	ipamConfigs := make([]network.IPAMConfig, 0)
	if options.IPAM != nil {
		for _, cfg := range options.IPAM.Config {
			ipamConfigs = append(ipamConfigs, network.IPAMConfig{
				Subnet:  cfg.Subnet,
				IPRange: cfg.IPRange,
				Gateway: cfg.Gateway,
			})
		}
	}

	var ipam *network.IPAM
	if options.IPAM != nil {
		ipam = &network.IPAM{
			Driver:  options.IPAM.Driver,
			Config:  ipamConfigs,
			Options: options.IPAM.Options,
		}
	}

	resp, err := c.docker.NetworkCreate(ctx, options.Name, types.NetworkCreate{
		Driver:     options.Driver,
		Internal:   options.Internal,
		Attachable: options.Attachable,
		Ingress:    options.Ingress,
		EnableIPv6: options.EnableIPv6,
		IPAM:       ipam,
		Options:    options.Options,
		Labels:     options.Labels,
	})
	if err != nil {
		return "", err
	}

	return resp.ID, nil
}

func (c *NetworkClient) Remove(ctx context.Context, id string) error {
	return c.docker.NetworkRemove(ctx, id)
}

func (c *NetworkClient) Connect(ctx context.Context, networkID string, options entity.NetworkConnectOptions) error {
	var endpointConfig *network.EndpointSettings
	if options.EndpointConfig != nil {
		endpointConfig = &network.EndpointSettings{
			Links:     options.EndpointConfig.Links,
			Aliases:   options.EndpointConfig.Aliases,
			NetworkID: options.EndpointConfig.NetworkID,
		}
	}

	return c.docker.NetworkConnect(ctx, networkID, options.Container, endpointConfig)
}

func (c *NetworkClient) Disconnect(ctx context.Context, networkID string, containerID string, force bool) error {
	return c.docker.NetworkDisconnect(ctx, networkID, containerID, force)
}

func (c *NetworkClient) Prune(ctx context.Context) ([]string, error) {
	report, err := c.docker.NetworksPrune(ctx, filters.Args{})
	if err != nil {
		return nil, err
	}
	return report.NetworksDeleted, nil
}
