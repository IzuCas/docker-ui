package handler

import (
	"context"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
)

type NetworkHandler struct {
	service *service.NetworkService
}

func NewNetworkHandler(service *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{service: service}
}

func (h *NetworkHandler) List(ctx context.Context, input *dto.NetworkListInput) (*dto.NetworkListOutput, error) {
	networks, err := h.service.List(ctx, input.Filters)
	if err != nil {
		return nil, err
	}

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
	network, err := h.service.Inspect(ctx, input.ID)
	if err != nil {
		return nil, err
	}

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
		return nil, err
	}

	return &dto.NetworkCreateOutput{
		Body: struct {
			ID string `json:"id"`
		}{ID: id},
	}, nil
}

func (h *NetworkHandler) Remove(ctx context.Context, input *dto.NetworkRemoveInput) (*dto.NetworkRemoveOutput, error) {
	if err := h.service.Remove(ctx, input.ID); err != nil {
		return nil, err
	}
	return &dto.NetworkRemoveOutput{}, nil
}

func (h *NetworkHandler) Connect(ctx context.Context, input *dto.NetworkConnectInput) (*dto.NetworkConnectOutput, error) {
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
		return nil, err
	}
	return &dto.NetworkConnectOutput{}, nil
}

func (h *NetworkHandler) Disconnect(ctx context.Context, input *dto.NetworkDisconnectInput) (*dto.NetworkDisconnectOutput, error) {
	if err := h.service.Disconnect(ctx, input.ID, input.Body.Container, input.Body.Force); err != nil {
		return nil, err
	}
	return &dto.NetworkDisconnectOutput{}, nil
}

func (h *NetworkHandler) Prune(ctx context.Context, input *dto.NetworkPruneInput) (*dto.NetworkPruneOutput, error) {
	deleted, err := h.service.Prune(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.NetworkPruneOutput{
		Body: dto.NetworkPruneResponse{
			NetworksDeleted: deleted,
		},
	}, nil
}
