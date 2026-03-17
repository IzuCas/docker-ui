package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"app/example/internal/application/service"
	"app/example/internal/infrastructure/docker"
	"app/example/internal/infrastructure/metrics"
	httpRouter "app/example/internal/interfaces/http"
	"app/example/internal/interfaces/http/handler"
	"app/example/pkg/logger"
	"app/example/pkg/middleware"
)

func main() {
	// Initialize logger
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}
	if err := logger.Init(env); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	logger.Info("Starting Docker Management API",
		logger.String("env", env),
		logger.String("version", "1.0.0"),
	)

	// Initialize Docker client
	dockerClient, err := docker.NewClient()
	if err != nil {
		logger.Fatal("Failed to create Docker client", logger.Err(err))
	}
	logger.Info("Docker client initialized")

	// Initialize infrastructure clients
	containerClient := docker.NewContainerClient(dockerClient)
	imageClient := docker.NewImageClient(dockerClient)
	volumeClient := docker.NewVolumeClient(dockerClient)
	networkClient := docker.NewNetworkClient(dockerClient)
	systemClient := docker.NewSystemClient(dockerClient)
	registryClient := docker.NewRegistryClient(dockerClient)

	// Initialize services
	containerService := service.NewContainerService(containerClient)
	imageService := service.NewImageService(imageClient)
	volumeService := service.NewVolumeService(volumeClient)
	networkService := service.NewNetworkService(networkClient)
	systemService := service.NewSystemService(systemClient)
	registryService := service.NewRegistryService(registryClient)

	// Initialize metrics store and collector (3-day retention)
	metricsStore := metrics.NewStore()
	metricsCollector := metrics.NewCollector(dockerClient, metricsStore)
	metricsService := service.NewMetricsService(metricsStore, metricsCollector)

	// Start metrics collector
	ctx, cancel := context.WithCancel(context.Background())
	metricsService.Start(ctx)
	logger.Info("Metrics collector started",
		logger.String("retention", "72h"),
		logger.String("interval", "5s"))

	// Initialize handlers
	containerHandler := handler.NewContainerHandler(containerService)
	imageHandler := handler.NewImageHandler(imageService)
	volumeHandler := handler.NewVolumeHandler(volumeService)
	networkHandler := handler.NewNetworkHandler(networkService)
	systemHandler := handler.NewSystemHandler(systemService)
	registryHandler := handler.NewRegistryHandler(registryService)
	wsHandler := handler.NewWebSocketHandler(containerService, systemService)
	metricsHandler := handler.NewMetricsHandler(metricsService)
	authHandler := handler.NewAuthHandler()

	// Initialize router
	router := httpRouter.NewRouter(
		containerHandler,
		imageHandler,
		volumeHandler,
		networkHandler,
		systemHandler,
		registryHandler,
		wsHandler,
		metricsHandler,
		authHandler,
	)

	// Create Chi router
	r := chi.NewMux()

	// Add middlewares
	r.Use(chiMiddleware.RequestID)
	r.Use(middleware.ZapLogger())
	r.Use(chiMiddleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	// Global rate limit: 300 requests/min per IP across all endpoints
	r.Use(middleware.RateLimit(300))

	// Register WebSocket routes (before Huma API to avoid conflicts)
	router.RegisterWebSocketRoutes(r)

	// Create Huma API with OpenAPI documentation
	api := humachi.New(r, huma.DefaultConfig("Docker Management API", "1.0.0"))
	_ = api // docs registered at /docs

	// Public auth routes: max 3 failed login attempts, then block for 1 minute
	r.Group(func(r chi.Router) {
		r.Use(middleware.LoginRateLimit(3, time.Minute))
		publicAPI := humachi.New(r, huma.DefaultConfig("Docker Management API", "1.0.0"))
		router.RegisterPublicRoutes(publicAPI)
	})

	// Protected routes require JWT
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth)
		protectedAPI := humachi.New(r, huma.DefaultConfig("Docker Management API", "1.0.0"))
		router.RegisterRoutes(protectedAPI)
	})

	// Start server
	logger.Info("Server configuration",
		logger.String("address", ":8001"),
		logger.String("docs", "http://localhost:8001/docs"),
	)
	logger.Info("WebSocket endpoints available",
		logger.String("events", "ws://localhost:8001/ws/events"),
		logger.String("containers", "ws://localhost:8001/ws/containers"),
		logger.String("stats", "ws://localhost:8001/ws/containers/stats?id=<id>"),
		logger.String("logs", "ws://localhost:8001/ws/containers/logs?id=<id>"),
		logger.String("system", "ws://localhost:8001/ws/system"),
	)
	logger.Info("Metrics endpoints available",
		logger.String("latest", "http://localhost:8001/metrics/latest"),
		logger.String("containers", "http://localhost:8001/metrics/containers"),
		logger.String("system", "http://localhost:8001/metrics/system"),
		logger.String("logs", "http://localhost:8001/metrics/logs"),
	)

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		logger.Info("Shutting down...")
		cancel()
		metricsService.Stop()
		logger.Info("Metrics collector stopped")
	}()

	logger.Info("Starting HTTP server on :8001")
	if err := http.ListenAndServe(":8001", r); err != nil {
		logger.Fatal("Failed to start server", logger.Err(err))
	}
}
