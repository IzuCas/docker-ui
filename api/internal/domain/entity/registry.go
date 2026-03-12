package entity

// RegistryAuth represents authentication credentials for a Docker registry
type RegistryAuth struct {
	Username      string `json:"username"`
	Password      string `json:"password"`
	ServerAddress string `json:"serverAddress"`
}

// RegistryLoginResult represents the result of a registry login
type RegistryLoginResult struct {
	Status        string `json:"status"`
	IdentityToken string `json:"identityToken,omitempty"`
}

// ProxyConfig represents Docker daemon proxy configuration
type ProxyConfig struct {
	HTTPProxy  string `json:"httpProxy"`
	HTTPSProxy string `json:"httpsProxy"`
	NoProxy    string `json:"noProxy"`
	FTPProxy   string `json:"ftpProxy,omitempty"`
}

// RegistryInfo represents information about a configured registry
type RegistryInfo struct {
	ServerAddress string `json:"serverAddress"`
	Username      string `json:"username"`
	IsLoggedIn    bool   `json:"isLoggedIn"`
}
