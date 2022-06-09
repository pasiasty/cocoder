package route_manager

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis"
	"github.com/go-playground/assert/v2"
	"github.com/go-redis/redis"
	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/websocket"
	"github.com/pasiasty/cocoder/server/common"
	"github.com/pasiasty/cocoder/server/session_manager"
)

func prepareRouteManager(ctx context.Context) *RouteManager {
	mr, err := miniredis.Run()
	if err != nil {
		log.Fatalf("Failed to setup miniredis: %v", err)
	}
	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return NewRouterManager(ctx, redisClient)
}

func createSession(t *testing.T, rm *RouteManager) string {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/new_session", nil)
	rm.Router().ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)
	assert.NotEqual(t, "", w.Body.String())
	txt := w.Body.String()

	// Skipping " characters from the beginning and the end of the response
	return txt[1 : len(txt)-1]
}

func loadSession(t *testing.T, rm *RouteManager, sID string) *session_manager.Session {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/"+sID, nil)
	rm.Router().ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code)

	res := &session_manager.Session{}

	assert.Equal(t, nil, json.Unmarshal(w.Body.Bytes(), res))
	res.LastEdit = time.Time{}
	return res
}

func compareSessions(s1, s2 *session_manager.Session) string {
	b1, err := json.MarshalIndent(s1, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal session: %v", err)
	}

	b2, err := json.MarshalIndent(s2, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal session: %v", err)
	}

	return cmp.Diff(string(b1), string(b2))
}

func TestLoadExistingSession(t *testing.T) {
	ctx := context.Background()

	rm := prepareRouteManager(ctx)

	sID := createSession(t, rm)
	s := loadSession(t, rm, sID)

	if diff := compareSessions(&session_manager.Session{
		Users:    make(map[string]*common.User),
		Language: "plaintext",
	}, s); diff != "" {
		t.Errorf("Received session was wrong, -want +got:\n%v", diff)
	}
}

func TestLoadNonExistingSession(t *testing.T) {
	ctx := context.Background()

	rm := prepareRouteManager(ctx)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/abc", nil)
	rm.Router().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestInteractWithTheWebsocket(t *testing.T) {
	ctx := context.Background()

	rm := prepareRouteManager(ctx)

	sID := createSession(t, rm)

	srv := httptest.NewServer(rm.Router())
	defer srv.Close()

	u := url.URL{
		Scheme: "ws",
		Host:   strings.Replace(srv.URL, "http://", "", 1),
		Path:   fmt.Sprintf("/api/%s/u1/session_ws", sID),
	}

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("Failed to dial to the websocket: %v", err)
	}
	defer conn.Close()

	conn.WriteJSON(&common.UpdateSessionRequest{
		NewText: "abc",
	})

	conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	_, respBytes, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read message from socket: %v", err)
	}

	resp := &common.UpdateSessionResponse{}
	if err := json.Unmarshal(respBytes, resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}
	resp.Users = nil

	if diff := cmp.Diff(&common.UpdateSessionResponse{
		NewText:  "abc",
		Language: "plaintext",
	}, resp); diff != "" {
		t.Errorf("Obtained wrong response, -want +got:\n%v", diff)
	}
}
