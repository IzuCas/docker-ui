package handler

import (
	"context"

	"app/example/internal/application/service"
	"app/example/internal/domain/entity"
	"app/example/internal/interfaces/http/dto"
)

type RegistryHandler struct {
	service *service.RegistryService
}

func NewRegistryHandler(service *service.RegistryService) *RegistryHandler {
	return &RegistryHandler{service: service}
}

func (h *RegistryHandler) Login(ctx context.Context, input *dto.RegistryLoginInput) (*dto.RegistryLoginOutput, error) {
	auth := entity.RegistryAuth{
		Username:      input.Body.Username,
		Password:      input.Body.Password,
		ServerAddress: input.Body.ServerAddress,
	}

	result, err := h.service.Login(ctx, auth)
	if err != nil {
		return nil, err
	}

	return &dto.RegistryLoginOutput{
		Body: dto.RegistryLoginResponse{
			Status:        result.Status,
			IdentityToken: result.IdentityToken,
		},
	}, nil
}

func (h *RegistryHandler) Logout(ctx context.Context, input *dto.RegistryLogoutInput) (*dto.RegistryLogoutOutput, error) {
	if err := h.service.Logout(ctx, input.Body.ServerAddress); err != nil {
		return nil, err
	}

	return &dto.RegistryLogoutOutput{
		Body: dto.StatusResponse{Status: "logged out"},
	}, nil
}

func (h *RegistryHandler) GetProxy(ctx context.Context, input *dto.ProxyGetInput) (*dto.ProxyGetOutput, error) {
	config, err := h.service.GetProxyConfig(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.ProxyGetOutput{
		Body: dto.ProxyConfigResponse{
			HTTPProxy:  config.HTTPProxy,
			HTTPSProxy: config.HTTPSProxy,
			NoProxy:    config.NoProxy,
			FTPProxy:   config.FTPProxy,
		},
	}, nil
}

func (h *RegistryHandler) SetProxy(ctx context.Context, input *dto.ProxySetInput) (*dto.ProxySetOutput, error) {
	// Get current config first
	current, err := h.service.GetProxyConfig(ctx)
	if err != nil {
		current = &entity.ProxyConfig{}
	}

	// Update only provided fields
	if input.Body.HTTPProxy != nil {
		current.HTTPProxy = *input.Body.HTTPProxy
	}
	if input.Body.HTTPSProxy != nil {
		current.HTTPSProxy = *input.Body.HTTPSProxy
	}
	if input.Body.NoProxy != nil {
		current.NoProxy = *input.Body.NoProxy
	}
	if input.Body.FTPProxy != nil {
		current.FTPProxy = *input.Body.FTPProxy
	}

	if err := h.service.SetProxyConfig(ctx, *current); err != nil {
		return nil, err
	}

	return &dto.ProxySetOutput{
		Body: dto.StatusResponse{Status: "proxy configured"},
	}, nil
}

func (h *RegistryHandler) GetSettings(ctx context.Context, input *dto.SettingsInfoInput) (*dto.SettingsInfoOutput, error) {
	// Get registries
	registries, err := h.service.ListRegistries(ctx)
	if err != nil {
		registries = []entity.RegistryInfo{}
	}

	registryResponses := make([]dto.RegistryInfoResponse, len(registries))
	for i, r := range registries {
		registryResponses[i] = dto.RegistryInfoResponse{
			ServerAddress: r.ServerAddress,
			Username:      r.Username,
			IsLoggedIn:    r.IsLoggedIn,
		}
	}

	// Get proxy config
	proxy, err := h.service.GetProxyConfig(ctx)
	if err != nil {
		proxy = &entity.ProxyConfig{}
	}

	return &dto.SettingsInfoOutput{
		Body: dto.SettingsInfoResponse{
			Registries: registryResponses,
			Proxy: dto.ProxyConfigResponse{
				HTTPProxy:  proxy.HTTPProxy,
				HTTPSProxy: proxy.HTTPSProxy,
				NoProxy:    proxy.NoProxy,
				FTPProxy:   proxy.FTPProxy,
			},
		},
	}, nil
}
