package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthAndNotifications(t *testing.T) {
	store := NewStore("")
	handler := newMux(store)

	// Test health endpoint
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Test POST notification
	body := bytes.NewBufferString(`{"type":"TASK_CREATED","title":"New Task","message":"Build CI","source":"test"}`)
	reqPost := httptest.NewRequest(http.MethodPost, "/api/notifications", body)
	recPost := httptest.NewRecorder()
	handler.ServeHTTP(recPost, reqPost)
	if recPost.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", recPost.Code)
	}

	// Test GET notifications
	reqGet := httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
	recGet := httptest.NewRecorder()
	handler.ServeHTTP(recGet, reqGet)
	var resp map[string]any
	if err := json.Unmarshal(recGet.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if resp["count"] != float64(1) {
		t.Fatalf("expected 1 notification, got %v", resp["count"])
	}
}
