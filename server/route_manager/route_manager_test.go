package route_manager

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis"
	"github.com/go-playground/assert/v2"
	"github.com/go-redis/redis"
	"github.com/google/go-cmp/cmp"
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
