package http

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"

	"github.com/IzuCas/docker-ui/internal/interfaces/http/handler"
)

type Router struct {
	containerHandler *handler.ContainerHandler
	imageHandler     *handler.ImageHandler
	volumeHandler    *handler.VolumeHandler
	networkHandler   *handler.NetworkHandler
	systemHandler    *handler.SystemHandler
	registryHandler  *handler.RegistryHandler
	wsHandler        *handler.WebSocketHandler
	metricsHandler   *handler.MetricsHandler
	authHandler      *handler.AuthHandler
}

func NewRouter(
	containerHandler *handler.ContainerHandler,
	imageHandler *handler.ImageHandler,
	volumeHandler *handler.VolumeHandler,
	networkHandler *handler.NetworkHandler,
	systemHandler *handler.SystemHandler,
	registryHandler *handler.RegistryHandler,
	wsHandler *handler.WebSocketHandler,
	metricsHandler *handler.MetricsHandler,
	authHandler *handler.AuthHandler,
) *Router {
	return &Router{
		containerHandler: containerHandler,
		imageHandler:     imageHandler,
		volumeHandler:    volumeHandler,
		networkHandler:   networkHandler,
		systemHandler:    systemHandler,
		registryHandler:  registryHandler,
		wsHandler:        wsHandler,
		metricsHandler:   metricsHandler,
		authHandler:      authHandler,
	}
}

func (r *Router) RegisterPublicRoutes(api huma.API) {
	r.registerAuthRoutes(api)
}

func (r *Router) RegisterRoutes(api huma.API) {
	r.registerContainerRoutes(api)
	r.registerImageRoutes(api)
	r.registerVolumeRoutes(api)
	r.registerNetworkRoutes(api)
	r.registerSystemRoutes(api)
	r.registerRegistryRoutes(api)
	r.registerMetricsRoutes(api)
	r.registerProtectedAuthRoutes(api)
}

func (r *Router) registerAuthRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "login",
		Method:        "POST",
		Path:          "/auth/login",
		Summary:       "Login",
		Description:   "Authenticate and receive a JWT token",
		Tags:          []string{"Auth"},
		DefaultStatus: http.StatusOK,
	}, r.authHandler.Login)
}

func (r *Router) registerProtectedAuthRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID:   "change-password",
		Method:        "POST",
		Path:          "/auth/change-password",
		Summary:       "Change password",
		Description:   "Update the current user's password",
		Tags:          []string{"Auth"},
		DefaultStatus: http.StatusOK,
	}, r.authHandler.ChangePassword)

	huma.Register(api, huma.Operation{
		OperationID:   "verify-credentials",
		Method:        "POST",
		Path:          "/auth/verify",
		Summary:       "Verify credentials",
		Description:   "Validate username and password (used before sensitive operations)",
		Tags:          []string{"Auth"},
		DefaultStatus: http.StatusOK,
	}, r.authHandler.Verify)
}

// RegisterWebSocketRoutes registers WebSocket routes directly on chi router
func (r *Router) RegisterWebSocketRoutes(mux *chi.Mux) {
	mux.HandleFunc("/ws/events", r.wsHandler.ContainerEvents)
	mux.HandleFunc("/ws/containers", r.wsHandler.ContainersList)
	mux.HandleFunc("/ws/containers/stats", r.wsHandler.ContainerStats)
	mux.HandleFunc("/ws/containers/logs", r.wsHandler.ContainerLogs)
	mux.HandleFunc("/ws/system", r.wsHandler.SystemInfo)
	// SSE endpoint for image pull progress
	mux.HandleFunc("/images/pull/stream", r.imageHandler.PullStream)
}

// HealthCheck is a simple health check endpoint
func HealthCheck(w http.ResponseWriter, req *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func (r *Router) registerContainerRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-containers",
		Method:      "GET",
		Path:        "/containers",
		Summary:     "List containers",
		Description: "Returns a list of containers",
		Tags:        []string{"Containers"},
	}, r.containerHandler.List)

	huma.Register(api, huma.Operation{
		OperationID: "inspect-container",
		Method:      "GET",
		Path:        "/containers/{id}",
		Summary:     "Inspect container",
		Description: "Returns detailed information about a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Inspect)

	huma.Register(api, huma.Operation{
		OperationID: "create-container",
		Method:      "POST",
		Path:        "/containers",
		Summary:     "Create container",
		Description: "Creates a new container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Create)

	huma.Register(api, huma.Operation{
		OperationID: "start-container",
		Method:      "POST",
		Path:        "/containers/{id}/start",
		Summary:     "Start container",
		Description: "Starts a stopped container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Start)

	huma.Register(api, huma.Operation{
		OperationID: "stop-container",
		Method:      "POST",
		Path:        "/containers/{id}/stop",
		Summary:     "Stop container",
		Description: "Stops a running container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Stop)

	huma.Register(api, huma.Operation{
		OperationID: "restart-container",
		Method:      "POST",
		Path:        "/containers/{id}/restart",
		Summary:     "Restart container",
		Description: "Restarts a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Restart)

	huma.Register(api, huma.Operation{
		OperationID: "pause-container",
		Method:      "POST",
		Path:        "/containers/{id}/pause",
		Summary:     "Pause container",
		Description: "Pauses a running container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Pause)

	huma.Register(api, huma.Operation{
		OperationID: "unpause-container",
		Method:      "POST",
		Path:        "/containers/{id}/unpause",
		Summary:     "Unpause container",
		Description: "Unpauses a paused container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Unpause)

	huma.Register(api, huma.Operation{
		OperationID: "kill-container",
		Method:      "POST",
		Path:        "/containers/{id}/kill",
		Summary:     "Kill container",
		Description: "Kills a running container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Kill)

	huma.Register(api, huma.Operation{
		OperationID: "remove-container",
		Method:      "DELETE",
		Path:        "/containers/{id}",
		Summary:     "Remove container",
		Description: "Removes a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Remove)

	huma.Register(api, huma.Operation{
		OperationID: "rename-container",
		Method:      "POST",
		Path:        "/containers/{id}/rename",
		Summary:     "Rename container",
		Description: "Renames a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Rename)

	huma.Register(api, huma.Operation{
		OperationID: "container-logs",
		Method:      "GET",
		Path:        "/containers/{id}/logs",
		Summary:     "Get container logs",
		Description: "Returns the logs from a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Logs)

	huma.Register(api, huma.Operation{
		OperationID: "container-stats",
		Method:      "GET",
		Path:        "/containers/{id}/stats",
		Summary:     "Get container stats",
		Description: "Returns resource usage statistics for a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Stats)

	huma.Register(api, huma.Operation{
		OperationID: "container-exec",
		Method:      "POST",
		Path:        "/containers/{id}/exec",
		Summary:     "Execute command in container",
		Description: "Executes a command inside a running container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Exec)

	huma.Register(api, huma.Operation{
		OperationID: "container-top",
		Method:      "GET",
		Path:        "/containers/{id}/top",
		Summary:     "List container processes",
		Description: "Returns the running processes in a container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.Top)

	huma.Register(api, huma.Operation{
		OperationID: "update-container-env",
		Method:      "PUT",
		Path:        "/containers/{id}/env",
		Summary:     "Update container environment",
		Description: "Updates container environment variables by recreating the container",
		Tags:        []string{"Containers"},
	}, r.containerHandler.UpdateEnv)
}

func (r *Router) registerImageRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-images",
		Method:      "GET",
		Path:        "/images",
		Summary:     "List images",
		Description: "Returns a list of images",
		Tags:        []string{"Images"},
	}, r.imageHandler.List)

	huma.Register(api, huma.Operation{
		OperationID: "inspect-image",
		Method:      "GET",
		Path:        "/images/{id}",
		Summary:     "Inspect image",
		Description: "Returns detailed information about an image",
		Tags:        []string{"Images"},
	}, r.imageHandler.Inspect)

	huma.Register(api, huma.Operation{
		OperationID: "pull-image",
		Method:      "POST",
		Path:        "/images/pull",
		Summary:     "Pull image",
		Description: "Pulls an image from a registry",
		Tags:        []string{"Images"},
	}, r.imageHandler.Pull)

	huma.Register(api, huma.Operation{
		OperationID: "remove-image",
		Method:      "DELETE",
		Path:        "/images/{id}",
		Summary:     "Remove image",
		Description: "Removes an image",
		Tags:        []string{"Images"},
	}, r.imageHandler.Remove)

	huma.Register(api, huma.Operation{
		OperationID: "tag-image",
		Method:      "POST",
		Path:        "/images/{id}/tag",
		Summary:     "Tag image",
		Description: "Tags an image with a new name",
		Tags:        []string{"Images"},
	}, r.imageHandler.Tag)

	huma.Register(api, huma.Operation{
		OperationID: "image-history",
		Method:      "GET",
		Path:        "/images/{id}/history",
		Summary:     "Get image history",
		Description: "Returns the history of an image",
		Tags:        []string{"Images"},
	}, r.imageHandler.History)

	huma.Register(api, huma.Operation{
		OperationID: "search-images",
		Method:      "GET",
		Path:        "/images/search",
		Summary:     "Search images",
		Description: "Searches for images in Docker Hub",
		Tags:        []string{"Images"},
	}, r.imageHandler.Search)

	huma.Register(api, huma.Operation{
		OperationID: "prune-images",
		Method:      "POST",
		Path:        "/images/prune",
		Summary:     "Prune images",
		Description: "Removes unused images",
		Tags:        []string{"Images"},
	}, r.imageHandler.Prune)
}

func (r *Router) registerVolumeRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-volumes",
		Method:      "GET",
		Path:        "/volumes",
		Summary:     "List volumes",
		Description: "Returns a list of volumes",
		Tags:        []string{"Volumes"},
	}, r.volumeHandler.List)

	huma.Register(api, huma.Operation{
		OperationID: "inspect-volume",
		Method:      "GET",
		Path:        "/volumes/{name}",
		Summary:     "Inspect volume",
		Description: "Returns detailed information about a volume",
		Tags:        []string{"Volumes"},
	}, r.volumeHandler.Inspect)

	huma.Register(api, huma.Operation{
		OperationID: "create-volume",
		Method:      "POST",
		Path:        "/volumes",
		Summary:     "Create volume",
		Description: "Creates a new volume",
		Tags:        []string{"Volumes"},
	}, r.volumeHandler.Create)

	huma.Register(api, huma.Operation{
		OperationID: "remove-volume",
		Method:      "DELETE",
		Path:        "/volumes/{name}",
		Summary:     "Remove volume",
		Description: "Removes a volume",
		Tags:        []string{"Volumes"},
	}, r.volumeHandler.Remove)

	huma.Register(api, huma.Operation{
		OperationID: "prune-volumes",
		Method:      "POST",
		Path:        "/volumes/prune",
		Summary:     "Prune volumes",
		Description: "Removes unused volumes",
		Tags:        []string{"Volumes"},
	}, r.volumeHandler.Prune)
}

func (r *Router) registerNetworkRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-networks",
		Method:      "GET",
		Path:        "/networks",
		Summary:     "List networks",
		Description: "Returns a list of networks",
		Tags:        []string{"Networks"},
	}, r.networkHandler.List)

	huma.Register(api, huma.Operation{
		OperationID: "inspect-network",
		Method:      "GET",
		Path:        "/networks/{id}",
		Summary:     "Inspect network",
		Description: "Returns detailed information about a network",
		Tags:        []string{"Networks"},
	}, r.networkHandler.Inspect)

	huma.Register(api, huma.Operation{
		OperationID: "create-network",
		Method:      "POST",
		Path:        "/networks",
		Summary:     "Create network",
		Description: "Creates a new network",
		Tags:        []string{"Networks"},
	}, r.networkHandler.Create)

	huma.Register(api, huma.Operation{
		OperationID: "remove-network",
		Method:      "DELETE",
		Path:        "/networks/{id}",
		Summary:     "Remove network",
		Description: "Removes a network",
		Tags:        []string{"Networks"},
	}, r.networkHandler.Remove)

	huma.Register(api, huma.Operation{
		OperationID: "connect-network",
		Method:      "POST",
		Path:        "/networks/{id}/connect",
		Summary:     "Connect container to network",
		Description: "Connects a container to a network",
		Tags:        []string{"Networks"},
	}, r.networkHandler.Connect)

	huma.Register(api, huma.Operation{
		OperationID: "disconnect-network",
		Method:      "POST",
		Path:        "/networks/{id}/disconnect",
		Summary:     "Disconnect container from network",
		Description: "Disconnects a container from a network",
		Tags:        []string{"Networks"},
	}, r.networkHandler.Disconnect)

	huma.Register(api, huma.Operation{
		OperationID: "prune-networks",
		Method:      "POST",
		Path:        "/networks/prune",
		Summary:     "Prune networks",
		Description: "Removes unused networks",
		Tags:        []string{"Networks"},
	}, r.networkHandler.Prune)
}

func (r *Router) registerSystemRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "system-info",
		Method:      "GET",
		Path:        "/system/info",
		Summary:     "Get system info",
		Description: "Returns Docker system information",
		Tags:        []string{"System"},
	}, r.systemHandler.Info)

	huma.Register(api, huma.Operation{
		OperationID: "system-version",
		Method:      "GET",
		Path:        "/system/version",
		Summary:     "Get Docker version",
		Description: "Returns Docker version information",
		Tags:        []string{"System"},
	}, r.systemHandler.Version)

	huma.Register(api, huma.Operation{
		OperationID: "system-disk-usage",
		Method:      "GET",
		Path:        "/system/df",
		Summary:     "Get disk usage",
		Description: "Returns Docker disk usage information",
		Tags:        []string{"System"},
	}, r.systemHandler.DiskUsage)

	huma.Register(api, huma.Operation{
		OperationID: "system-ping",
		Method:      "GET",
		Path:        "/system/ping",
		Summary:     "Ping Docker",
		Description: "Pings the Docker daemon to check connectivity",
		Tags:        []string{"System"},
	}, r.systemHandler.Ping)
}

func (r *Router) registerRegistryRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "registry-login",
		Method:      "POST",
		Path:        "/registry/login",
		Summary:     "Login to registry",
		Description: "Authenticates with a Docker registry",
		Tags:        []string{"Registry"},
	}, r.registryHandler.Login)

	huma.Register(api, huma.Operation{
		OperationID: "registry-logout",
		Method:      "POST",
		Path:        "/registry/logout",
		Summary:     "Logout from registry",
		Description: "Logs out from a Docker registry",
		Tags:        []string{"Registry"},
	}, r.registryHandler.Logout)

	huma.Register(api, huma.Operation{
		OperationID: "get-proxy-config",
		Method:      "GET",
		Path:        "/settings/proxy",
		Summary:     "Get proxy configuration",
		Description: "Returns the current proxy configuration",
		Tags:        []string{"Settings"},
	}, r.registryHandler.GetProxy)

	huma.Register(api, huma.Operation{
		OperationID: "set-proxy-config",
		Method:      "PUT",
		Path:        "/settings/proxy",
		Summary:     "Set proxy configuration",
		Description: "Updates the proxy configuration",
		Tags:        []string{"Settings"},
	}, r.registryHandler.SetProxy)

	huma.Register(api, huma.Operation{
		OperationID: "get-settings",
		Method:      "GET",
		Path:        "/settings",
		Summary:     "Get settings",
		Description: "Returns all settings including registries and proxy",
		Tags:        []string{"Settings"},
	}, r.registryHandler.GetSettings)
}

func (r *Router) registerMetricsRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-container-metrics",
		Method:      "GET",
		Path:        "/metrics/containers/{container_id}",
		Summary:     "Get container metrics",
		Description: "Returns metrics for a specific container over time",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.GetContainerMetrics)

	huma.Register(api, huma.Operation{
		OperationID: "get-all-container-metrics",
		Method:      "GET",
		Path:        "/metrics/containers",
		Summary:     "Get all container metrics",
		Description: "Returns metrics for all containers over time",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.GetAllContainerMetrics)

	huma.Register(api, huma.Operation{
		OperationID: "get-latest-metrics",
		Method:      "GET",
		Path:        "/metrics/latest",
		Summary:     "Get latest metrics",
		Description: "Returns the most recent metrics for all containers and system",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.GetLatestMetrics)

	huma.Register(api, huma.Operation{
		OperationID: "get-system-metrics",
		Method:      "GET",
		Path:        "/metrics/system",
		Summary:     "Get system metrics",
		Description: "Returns system-level Docker metrics over time",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.GetSystemMetrics)

	huma.Register(api, huma.Operation{
		OperationID: "query-logs",
		Method:      "GET",
		Path:        "/metrics/logs",
		Summary:     "Query logs",
		Description: "Queries log entries with filters",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.QueryLogs)

	huma.Register(api, huma.Operation{
		OperationID: "aggregate-logs",
		Method:      "GET",
		Path:        "/metrics/logs/aggregate",
		Summary:     "Aggregate logs",
		Description: "Aggregates logs by time buckets for charting",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.AggregateLogs)

	huma.Register(api, huma.Operation{
		OperationID: "get-metrics-stats",
		Method:      "GET",
		Path:        "/metrics/stats",
		Summary:     "Get metrics store stats",
		Description: "Returns statistics about the metrics store",
		Tags:        []string{"Metrics"},
	}, r.metricsHandler.GetStats)
}
