package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"app/example/internal/application/service"
	"app/example/internal/interfaces/http/dto"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

type WebSocketHandler struct {
	containerService *service.ContainerService
	systemService    *service.SystemService
	clients          map[*websocket.Conn]bool
	mu               sync.RWMutex
}

func NewWebSocketHandler(containerService *service.ContainerService, systemService *service.SystemService) *WebSocketHandler {
	return &WebSocketHandler{
		containerService: containerService,
		systemService:    systemService,
		clients:          make(map[*websocket.Conn]bool),
	}
}

// WebSocket message types
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// ContainerEvents handles Docker events stream
func (h *WebSocketHandler) ContainerEvents(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	h.mu.Lock()
	h.clients[conn] = true
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients, conn)
		h.mu.Unlock()
	}()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Handle incoming messages (for ping/pong and close)
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				cancel()
				return
			}
		}
	}()

	// Stream Docker events
	eventsChan, errChan := h.containerService.StreamEvents(ctx)

	for {
		select {
		case event, ok := <-eventsChan:
			if !ok {
				return
			}
			msg := WSMessage{
				Type:    "container_event",
				Payload: event,
			}
			if err := conn.WriteJSON(msg); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		case err := <-errChan:
			if err != nil {
				log.Printf("Docker events error: %v", err)
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

// ContainerStats handles container stats streaming
func (h *WebSocketHandler) ContainerStats(w http.ResponseWriter, r *http.Request) {
	containerID := r.URL.Query().Get("id")
	if containerID == "" {
		http.Error(w, "Container ID required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Handle incoming messages
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				cancel()
				return
			}
		}
	}()

	// Stream container stats
	statsChan, errChan := h.containerService.StreamStats(ctx, containerID)

	for {
		select {
		case stats, ok := <-statsChan:
			if !ok {
				return
			}
			msg := WSMessage{
				Type:    "container_stats",
				Payload: stats,
			}
			if err := conn.WriteJSON(msg); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		case err := <-errChan:
			if err != nil {
				log.Printf("Stats stream error: %v", err)
				errMsg := WSMessage{
					Type:    "error",
					Payload: err.Error(),
				}
				conn.WriteJSON(errMsg)
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

// ContainerLogs handles container logs streaming
func (h *WebSocketHandler) ContainerLogs(w http.ResponseWriter, r *http.Request) {
	containerID := r.URL.Query().Get("id")
	if containerID == "" {
		http.Error(w, "Container ID required", http.StatusBadRequest)
		return
	}

	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "100"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Handle incoming messages
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				cancel()
				return
			}
		}
	}()

	// Stream container logs
	logsChan, errChan := h.containerService.StreamLogs(ctx, containerID, tail)

	for {
		select {
		case logLine, ok := <-logsChan:
			if !ok {
				return
			}
			msg := WSMessage{
				Type:    "container_log",
				Payload: logLine,
			}
			if err := conn.WriteJSON(msg); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		case err := <-errChan:
			if err != nil {
				log.Printf("Logs stream error: %v", err)
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

// ContainersList handles real-time container list updates
func (h *WebSocketHandler) ContainersList(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Handle incoming messages
	go func() {
		for {
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				cancel()
				return
			}

			// Handle refresh request
			if messageType == websocket.TextMessage {
				var req map[string]interface{}
				if json.Unmarshal(message, &req) == nil {
					if req["action"] == "refresh" {
						h.sendContainerList(conn, true)
					}
				}
			}
		}
	}()

	// Send initial list
	h.sendContainerList(conn, true)

	// Stream Docker events and update container list
	eventsChan, errChan := h.containerService.StreamEvents(ctx)

	// Debounce to avoid too frequent updates
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	pendingUpdate := false

	for {
		select {
		case event, ok := <-eventsChan:
			if !ok {
				return
			}
			// Only update on container-related events
			if event.Type == "container" {
				pendingUpdate = true
				// Send event notification
				msg := WSMessage{
					Type:    "container_event",
					Payload: event,
				}
				conn.WriteJSON(msg)
			}
		case <-ticker.C:
			if pendingUpdate {
				h.sendContainerList(conn, true)
				pendingUpdate = false
			}
		case err := <-errChan:
			if err != nil {
				log.Printf("Events stream error: %v", err)
			}
			return
		case <-ctx.Done():
			return
		}
	}
}

func (h *WebSocketHandler) sendContainerList(conn *websocket.Conn, all bool) {
	containers, err := h.containerService.List(context.Background(), all)
	if err != nil {
		log.Printf("Error listing containers: %v", err)
		return
	}

	// Convert to DTO format for consistent JSON serialization
	response := make([]dto.ContainerSummaryResponse, len(containers))
	for i, c := range containers {
		response[i] = dto.ContainerSummaryResponse{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			ImageID: c.ImageID,
			Command: c.Command,
			Created: c.Created.Format("2006-01-02T15:04:05Z"),
			State:   c.State,
			Status:  c.Status,
		}
	}

	msg := WSMessage{
		Type:    "containers_list",
		Payload: response,
	}
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("WebSocket write error: %v", err)
	}
}

// SystemInfo handles system info streaming
func (h *WebSocketHandler) SystemInfo(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Handle incoming messages
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				cancel()
				return
			}
		}
	}()

	// Send system info every 5 seconds
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Send initial info
	h.sendSystemInfo(conn)

	for {
		select {
		case <-ticker.C:
			h.sendSystemInfo(conn)
		case <-ctx.Done():
			return
		}
	}
}

func (h *WebSocketHandler) sendSystemInfo(conn *websocket.Conn) {
	info, err := h.systemService.Info(context.Background())
	if err != nil {
		log.Printf("Error getting system info: %v", err)
		return
	}

	msg := WSMessage{
		Type:    "system_info",
		Payload: info,
	}
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("WebSocket write error: %v", err)
	}
}
