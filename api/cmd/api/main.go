package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"app/example/internal/application/service"
	"app/example/internal/infrastructure/docker"
	httpRouter "app/example/internal/interfaces/http"
	"app/example/internal/interfaces/http/handler"
)

func main() {
	// Initialize Docker client
	dockerClient, err := docker.NewClient()
	if err != nil {
		log.Fatalf("Failed to create Docker client: %v", err)
	}

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

	// Initialize handlers
	containerHandler := handler.NewContainerHandler(containerService)
	imageHandler := handler.NewImageHandler(imageService)
	volumeHandler := handler.NewVolumeHandler(volumeService)
	networkHandler := handler.NewNetworkHandler(networkService)
	systemHandler := handler.NewSystemHandler(systemService)
	registryHandler := handler.NewRegistryHandler(registryService)

	// Initialize router
	router := httpRouter.NewRouter(
		containerHandler,
		imageHandler,
		volumeHandler,
		networkHandler,
		systemHandler,
		registryHandler,
	)

	// Create Chi router
	r := chi.NewMux()

	// Add middlewares
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Create Huma API with OpenAPI documentation
	api := humachi.New(r, huma.DefaultConfig("Docker Management API", "1.0.0"))

	// Register routes
	router.RegisterRoutes(api)

	// Start server
	fmt.Println("Starting Docker Management API server on :8001")
	fmt.Println("API Documentation available at http://localhost:8001/docs")
	if err := http.ListenAndServe(":8001", r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
