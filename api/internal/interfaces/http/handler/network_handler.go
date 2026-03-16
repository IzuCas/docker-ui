package handler

import (
	"context"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
	"app/example/pkg/logger"
)

type NetworkHandler struct {
	service *service.NetworkService
}

func NewNetworkHandler(service *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{service: service}
}

func (h *NetworkHandler) List(ctx context.Context, input *dto.NetworkListInput) (*dto.NetworkListOutput, error) {
	logger.Info("Listing networks")

	networks, err := h.service.List(ctx, input.Filters)
	if err != nil {
		logger.Error("Failed to list networks", logger.Err(err))
		return nil, err
	}

	logger.Info("Listed networks successfully", logger.Int("count", len(networks)))

	response := make([]dto.NetworkSummaryResponse, len(networks))
	for i, n := range networks {
		ipamConfigs := make([]dto.IPAMConfigResponse, len(n.IPAM.Config))
		for j, c := range n.IPAM.Config {
			ipamConfigs[j] = dto.IPAMConfigResponse{
				Subnet:  c.Subnet,
				Gateway: c.Gateway,
			}
		}
		response[i] = dto.NetworkSummaryResponse{
			ID:             n.ID,
			Name:           n.Name,
			Driver:         n.Driver,
			Scope:          n.Scope,
			Internal:       n.Internal,
			Attachable:     n.Attachable,
			Ingress:        n.Ingress,
			Created:        n.Created.Format("2006-01-02T15:04:05.000000000Z07:00"),
			ContainerCount: n.ContainerCount,
			IPAM: dto.IPAMResponse{
				Driver:  n.IPAM.Driver,
				Config:  ipamConfigs,
				Options: n.IPAM.Options,
			},
		}
	}

	return &dto.NetworkListOutput{Body: response}, nil
}

func (h *NetworkHandler) Inspect(ctx context.Context, input *dto.NetworkInspectInput) (*dto.NetworkInspectOutput, error) {
	logger.Info("Inspecting network", logger.String("network_id", input.ID))

	network, err := h.service.Inspect(ctx, input.ID)
	if err != nil {
		logger.Error("Failed to inspect network", logger.String("network_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Debug("Network inspected successfully", logger.String("network_id", input.ID), logger.String("name", network.Name))

	ipamConfigs := make([]dto.IPAMConfigResponse, len(network.IPAM.Config))
	for i, c := range network.IPAM.Config {
		ipamConfigs[i] = dto.IPAMConfigResponse{
			Subnet:     c.Subnet,
			IPRange:    c.IPRange,
			Gateway:    c.Gateway,
			AuxAddress: c.AuxAddress,
		}
	}

	containers := make(map[string]dto.EndpointResponse)
	for k, v := range network.Containers {
		containers[k] = dto.EndpointResponse{
			Name:        v.Name,
			EndpointID:  v.EndpointID,
			MacAddress:  v.MacAddress,
			IPv4Address: v.IPv4Address,
			IPv6Address: v.IPv6Address,
		}
	}

	return &dto.NetworkInspectOutput{
		Body: dto.NetworkResponse{
			ID:         network.ID,
			Name:       network.Name,
			Created:    network.Created.Format("2006-01-02T15:04:05.000000000Z07:00"),
			Scope:      network.Scope,
			Driver:     network.Driver,
			EnableIPv6: network.EnableIPv6,
			IPAM: dto.IPAMResponse{
				Driver:  network.IPAM.Driver,
				Config:  ipamConfigs,
				Options: network.IPAM.Options,
			},
			Internal:   network.Internal,
			Attachable: network.Attachable,
			Ingress:    network.Ingress,
			Options:    network.Options,
			Labels:     network.Labels,
			Containers: containers,
		},
	}, nil
}

func (h *NetworkHandler) Create(ctx context.Context, input *dto.NetworkCreateInput) (*dto.NetworkCreateOutput, error) {
	logger.Info("Creating network", logger.String("name", input.Body.Name), logger.String("driver", input.Body.Driver))

	var ipamConfigs []entity.IPAMConfig
	if input.Body.IPAM != nil {
		ipamConfigs = make([]entity.IPAMConfig, len(input.Body.IPAM.Config))
		for i, c := range input.Body.IPAM.Config {
			ipamConfigs[i] = entity.IPAMConfig{
				Subnet:     c.Subnet,
				IPRange:    c.IPRange,
				Gateway:    c.Gateway,
				AuxAddress: c.AuxAddress,
			}
		}
	}

	var ipam *entity.IPAM
	if input.Body.IPAM != nil {
		ipam = &entity.IPAM{
			Driver:  input.Body.IPAM.Driver,
			Config:  ipamConfigs,
			Options: input.Body.IPAM.Options,
		}
	}

	opts := entity.NetworkCreateOptions{
		Name:       input.Body.Name,
		Driver:     input.Body.Driver,
		Internal:   input.Body.Internal,
		Attachable: input.Body.Attachable,
		Ingress:    input.Body.Ingress,
		EnableIPv6: input.Body.EnableIPv6,
		Options:    input.Body.Options,
		Labels:     input.Body.Labels,
		IPAM:       ipam,
	}

	id, err := h.service.Create(ctx, opts)
	if err != nil {
		logger.Error("Failed to create network", logger.String("name", input.Body.Name), logger.Err(err))
		return nil, err
	}

	logger.Info("Network created successfully", logger.String("network_id", id), logger.String("name", input.Body.Name))

	return &dto.NetworkCreateOutput{
		Body: struct {
			ID string `json:"id"`
		}{ID: id},
	}, nil
}

func (h *NetworkHandler) Remove(ctx context.Context, input *dto.NetworkRemoveInput) (*dto.NetworkRemoveOutput, error) {
	logger.Info("Removing network", logger.String("network_id", input.ID))

	if err := h.service.Remove(ctx, input.ID); err != nil {
		logger.Error("Failed to remove network", logger.String("network_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Network removed successfully", logger.String("network_id", input.ID))
	return &dto.NetworkRemoveOutput{}, nil
}

func (h *NetworkHandler) Connect(ctx context.Context, input *dto.NetworkConnectInput) (*dto.NetworkConnectOutput, error) {
	logger.Info("Connecting container to network", logger.String("network_id", input.ID), logger.String("container", input.Body.Container))

	var endpointConfig *entity.EndpointSettings
	if input.Body.EndpointConfig != nil {
		endpointConfig = &entity.EndpointSettings{
			IPAMConfig: nil,
			Links:      input.Body.EndpointConfig.Links,
			Aliases:    input.Body.EndpointConfig.Aliases,
			NetworkID:  input.Body.EndpointConfig.NetworkID,
		}
	}

	opts := entity.NetworkConnectOptions{
		Container:      input.Body.Container,
		EndpointConfig: endpointConfig,
	}

	if err := h.service.Connect(ctx, input.ID, opts); err != nil {
		logger.Error("Failed to connect container to network", logger.String("network_id", input.ID), logger.String("container", input.Body.Container), logger.Err(err))
		return nil, err
	}

	logger.Info("Container connected to network successfully", logger.String("network_id", input.ID), logger.String("container", input.Body.Container))
	return &dto.NetworkConnectOutput{}, nil
}

func (h *NetworkHandler) Disconnect(ctx context.Context, input *dto.NetworkDisconnectInput) (*dto.NetworkDisconnectOutput, error) {
	logger.Info("Disconnecting container from network", logger.String("network_id", input.ID), logger.String("container", input.Body.Container))

	if err := h.service.Disconnect(ctx, input.ID, input.Body.Container, input.Body.Force); err != nil {
		logger.Error("Failed to disconnect container from network", logger.String("network_id", input.ID), logger.Err(err))
		return nil, err
	}

	logger.Info("Container disconnected from network successfully", logger.String("network_id", input.ID))
	return &dto.NetworkDisconnectOutput{}, nil
}

func (h *NetworkHandler) Prune(ctx context.Context, input *dto.NetworkPruneInput) (*dto.NetworkPruneOutput, error) {
	logger.Info("Pruning unused networks")

	deleted, err := h.service.Prune(ctx)
	if err != nil {
		logger.Error("Failed to prune networks", logger.Err(err))
		return nil, err
	}

	logger.Info("Networks pruned successfully", logger.Int("deleted_count", len(deleted)))

	return &dto.NetworkPruneOutput{
		Body: dto.NetworkPruneResponse{
			NetworksDeleted: deleted,
		},
	}, nil
}
