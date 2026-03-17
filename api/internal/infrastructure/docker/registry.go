package docker

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"

	"github.com/IzuCas/docker-ui/internal/domain/entity"
)

const (
	dockerHubAddress = "https://index.docker.io/v1/"
	proxyConfigFile  = ".docker-proxy-config.json"
)

type RegistryClient struct {
	docker *client.Client
}

func NewRegistryClient(docker *client.Client) *RegistryClient {
	return &RegistryClient{docker: docker}
}

func (c *RegistryClient) Login(ctx context.Context, auth entity.RegistryAuth) (*entity.RegistryLoginResult, error) {
	serverAddress := auth.ServerAddress
	if serverAddress == "" {
		serverAddress = dockerHubAddress
	}

	authConfig := registry.AuthConfig{
		Username:      auth.Username,
		Password:      auth.Password,
		ServerAddress: serverAddress,
	}

	response, err := c.docker.RegistryLogin(ctx, authConfig)
	if err != nil {
		return nil, err
	}

	// Save credentials to Docker config
	if err := saveCredentials(serverAddress, auth.Username); err != nil {
		// Log but don't fail - login was successful
	}

	return &entity.RegistryLoginResult{
		Status:        response.Status,
		IdentityToken: response.IdentityToken,
	}, nil
}

func (c *RegistryClient) Logout(ctx context.Context, serverAddress string) error {
	if serverAddress == "" {
		serverAddress = dockerHubAddress
	}

	return removeCredentials(serverAddress)
}

func (c *RegistryClient) GetProxyConfig(ctx context.Context) (*entity.ProxyConfig, error) {
	config := &entity.ProxyConfig{}

	// Try to read from config file first
	configPath := getProxyConfigPath()
	data, err := os.ReadFile(configPath)
	if err == nil {
		if err := json.Unmarshal(data, config); err == nil {
			return config, nil
		}
	}

	// Fall back to environment variables
	config.HTTPProxy = os.Getenv("HTTP_PROXY")
	if config.HTTPProxy == "" {
		config.HTTPProxy = os.Getenv("http_proxy")
	}
	config.HTTPSProxy = os.Getenv("HTTPS_PROXY")
	if config.HTTPSProxy == "" {
		config.HTTPSProxy = os.Getenv("https_proxy")
	}
	config.NoProxy = os.Getenv("NO_PROXY")
	if config.NoProxy == "" {
		config.NoProxy = os.Getenv("no_proxy")
	}
	config.FTPProxy = os.Getenv("FTP_PROXY")
	if config.FTPProxy == "" {
		config.FTPProxy = os.Getenv("ftp_proxy")
	}

	return config, nil
}

func (c *RegistryClient) SetProxyConfig(ctx context.Context, config entity.ProxyConfig) error {
	// Save to config file
	configPath := getProxyConfigPath()
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func (c *RegistryClient) ListRegistries(ctx context.Context) ([]entity.RegistryInfo, error) {
	registries := []entity.RegistryInfo{}

	// Read from saved registries
	savedRegistries := getSavedRegistries()
	for addr, username := range savedRegistries {
		registries = append(registries, entity.RegistryInfo{
			ServerAddress: addr,
			Username:      username,
			IsLoggedIn:    true,
		})
	}

	// Always include Docker Hub
	hasDockerHub := false
	for _, r := range registries {
		if r.ServerAddress == dockerHubAddress || r.ServerAddress == "docker.io" {
			hasDockerHub = true
			break
		}
	}
	if !hasDockerHub {
		registries = append(registries, entity.RegistryInfo{
			ServerAddress: "docker.io",
			Username:      "",
			IsLoggedIn:    false,
		})
	}

	return registries, nil
}

// Helper functions for credential management
func getRegistryConfigPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ".docker-registries.json"
	}
	return filepath.Join(homeDir, ".docker-manager", "registries.json")
}

func getProxyConfigPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return proxyConfigFile
	}
	return filepath.Join(homeDir, ".docker-manager", "proxy.json")
}

type registryConfig struct {
	Registries map[string]string `json:"registries"`
}

func saveCredentials(serverAddress, username string) error {
	configPath := getRegistryConfigPath()

	// Read existing config
	config := registryConfig{Registries: make(map[string]string)}
	data, err := os.ReadFile(configPath)
	if err == nil {
		json.Unmarshal(data, &config)
	}

	// Add new registry
	config.Registries[serverAddress] = username

	// Write back
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err = json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0600)
}

func removeCredentials(serverAddress string) error {
	configPath := getRegistryConfigPath()

	config := registryConfig{Registries: make(map[string]string)}
	data, err := os.ReadFile(configPath)
	if err == nil {
		json.Unmarshal(data, &config)
	}

	delete(config.Registries, serverAddress)

	data, err = json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0600)
}

func getSavedRegistries() map[string]string {
	configPath := getRegistryConfigPath()

	config := registryConfig{Registries: make(map[string]string)}
	data, err := os.ReadFile(configPath)
	if err == nil {
		json.Unmarshal(data, &config)
	}

	return config.Registries
}
