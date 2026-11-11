package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

type Notification struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Source    string `json:"source"`
	Timestamp string `json:"timestamp"`
}

type Store struct {
	mu    sync.RWMutex
	items []Notification
	rdb   *redis.Client
}

func NewStore(redisURL string) *Store {
	s := &Store{
		items: make([]Notification, 0, 100),
	}
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err != nil {
			opt = &redis.Options{Addr: redisURL}
		}
		s.rdb = redis.NewClient(opt)
	}
	return s
}

func (s *Store) Add(n Notification) {
	if n.ID == "" {
		n.ID = fmt.Sprintf("notif-%d", time.Now().UnixNano())
	}
	if n.Timestamp == "" {
		n.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	if n.Type == "" {
		n.Type = "INFO"
	}

	s.mu.Lock()
	s.items = append([]Notification{n}, s.items...)
	if len(s.items) > 100 {
		s.items = s.items[:100]
	}
	s.mu.Unlock()

	if s.rdb != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if raw, err := json.Marshal(n); err == nil {
			_ = s.rdb.LPush(ctx, "notifications:list", raw).Err()
			_ = s.rdb.LTrim(ctx, "notifications:list", 0, 99).Err()
		}
	}
}

func (s *Store) List() []Notification {
	if s.rdb != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		vals, err := s.rdb.LRange(ctx, "notifications:list", 0, 99).Result()
		if err == nil && len(vals) > 0 {
			out := make([]Notification, 0, len(vals))
			for _, v := range vals {
				var n Notification
				if json.Unmarshal([]byte(v), &n) == nil {
					out = append(out, n)
				}
			}
			return out
		}
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := make([]Notification, len(s.items))
	copy(cp, s.items)
	return cp
}

func (s *Store) Clear() {
	s.mu.Lock()
	s.items = s.items[:0]
	s.mu.Unlock()

	if s.rdb != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.rdb.Del(ctx, "notifications:list").Err()
	}
}

func (s *Store) RedisStatus() string {
	if s.rdb == nil {
		return "MEMORY_FALLBACK"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	if err := s.rdb.Ping(ctx).Err(); err != nil {
		return "DISCONNECTED"
	}
	return "CONNECTED"
}

func (s *Store) SubscribeEvents(ctx context.Context) {
	if s.rdb == nil {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		pubsub := s.rdb.Subscribe(ctx, "taskflow:events")
		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				_ = pubsub.Close()
				return
			case msg, ok := <-ch:
				if !ok {
					goto reconnect
				}
				var n Notification
				if err := json.Unmarshal([]byte(msg.Payload), &n); err != nil {
					n = Notification{
						Type:    "EVENT",
						Title:   "TaskFlow Event",
						Message: msg.Payload,
						Source:  "redis-pubsub",
					}
				}
				s.Add(n)
			}
		}
	reconnect:
		_ = pubsub.Close()
		time.Sleep(3 * time.Second)
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func newMux(store *Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":    "UP",
			"service":   "notification-service",
			"language":  "Golang",
			"redis":     store.RedisStatus(),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/api/notifications", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			list := store.List()
			writeJSON(w, http.StatusOK, map[string]any{
				"count":         len(list),
				"notifications": list,
			})
		case http.MethodPost:
			var n Notification
			if err := json.NewDecoder(r.Body).Decode(&n); err != nil || n.Message == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
				return
			}
			if n.Title == "" {
				n.Title = "Notification"
			}
			if n.Source == "" {
				n.Source = "api"
			}
			store.Add(n)
			writeJSON(w, http.StatusCreated, n)
		case http.MethodDelete:
			store.Clear()
			writeJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	return mux
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	redisURL := os.Getenv("REDIS_URL")
	store := NewStore(redisURL)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	go store.SubscribeEvents(ctx)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: newMux(store),
	}

	go func() {
		log.Printf("notification-service (Go) listening on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelShutdown()
	_ = srv.Shutdown(shutdownCtx)
}
