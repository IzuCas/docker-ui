package entity

import "time"

// Network represents a Docker network
type Network struct {
	ID         string
	Name       string
	Driver     string
	Scope      string
	EnableIPv6 bool
	IPAM       IPAM
	Internal   bool
	Attachable bool
	Ingress    bool
	Containers map[string]EndpointResource
	Options    map[string]string
	Labels     map[string]string
	Created    time.Time
}

// IPAM represents IP Address Management
type IPAM struct {
	Driver  string
	Config  []IPAMConfig
	Options map[string]string
}

// IPAMConfig represents IPAM configuration
type IPAMConfig struct {
	Subnet     string
	IPRange    string
	Gateway    string
	AuxAddress map[string]string
}

// EndpointResource represents a container endpoint in a network
type EndpointResource struct {
	Name        string
	EndpointID  string
	MacAddress  string
	IPv4Address string
	IPv6Address string
}

// NetworkCreateOptions represents options for creating a network
type NetworkCreateOptions struct {
	Name       string
	Driver     string
	Internal   bool
	Attachable bool
	Ingress    bool
	EnableIPv6 bool
	IPAM       *IPAM
	Options    map[string]string
	Labels     map[string]string
}

// NetworkConnectOptions represents options for connecting a container to a network
type NetworkConnectOptions struct {
	Container      string
	EndpointConfig *EndpointSettings
}

// EndpointSettings represents endpoint settings
type EndpointSettings struct {
	IPAMConfig          *EndpointIPAMConfig
	Links               []string
	Aliases             []string
	NetworkID           string
	EndpointID          string
	Gateway             string
	IPAddress           string
	IPPrefixLen         int
	IPv6Gateway         string
	GlobalIPv6Address   string
	GlobalIPv6PrefixLen int
	MacAddress          string
}

// EndpointIPAMConfig represents endpoint IPAM configuration
type EndpointIPAMConfig struct {
	IPv4Address  string
	IPv6Address  string
	LinkLocalIPs []string
}

// NetworkSummary represents a summary of a network
type NetworkSummary struct {
	ID             string
	Name           string
	Driver         string
	Scope          string
	EnableIPv6     bool
	Internal       bool
	Attachable     bool
	Ingress        bool
	Created        time.Time
	Labels         map[string]string
	ContainerCount int
	IPAM           IPAM
}
