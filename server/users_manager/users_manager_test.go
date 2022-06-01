package users_manager

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis"
	"github.com/go-redis/redis"
	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/websocket"
	"github.com/pasiasty/cocoder/server/common"
	"github.com/pasiasty/cocoder/server/session_manager"
)

var upgrader = websocket.Upgrader{}

type testMessage struct {
	mt   int
	body []byte
}

func (m testMessage) toUpdateSessionResponse() *common.UpdateSessionResponse {
	resp := &common.UpdateSessionResponse{}
	if m.mt != websocket.TextMessage {
		log.Fatalf("Wrong message type: %v want: %v", m.mt, websocket.TextMessage)
	}
	if err := json.Unmarshal(m.body, resp); err != nil {
		log.Fatalf("Failed to unmarshal message: %v", err)
	}
	resp.Users = nil
	return resp
}

type testServer struct {
	http.Handler

	connections []*websocket.Conn
	gotMessage  chan testMessage

	server *httptest.Server
}

func (s *testServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close()

	s.connections = append(s.connections, c)
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			break
		}
		s.gotMessage <- testMessage{mt: mt, body: message}
	}
}

func (s *testServer) connect() *websocket.Conn {
	// Convert http://127.0.0.1 to ws://127.0.0.
	u := "ws" + strings.TrimPrefix(s.server.URL, "http")

	// Connect to the server
	ws, _, err := websocket.DefaultDialer.Dial(u, nil)
	if err != nil {
		log.Fatalf("Failed to dial to the websocket: %v", err)
	}

	return ws
}

func (s *testServer) Close() {
	for _, c := range s.connections {
		c.Close()
	}
	s.server.Close()
	close(s.gotMessage)
}

func prepareTestServer() *testServer {
	res := &testServer{
		gotMessage: make(chan testMessage),
	}
	res.server = httptest.NewServer(res)

	return res
}

func prepareSessionmanager() *session_manager.SessionManager {
	mr, err := miniredis.Run()
	if err != nil {
		log.Fatalf("Failed to setup miniredis: %v", err)
	}
	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return session_manager.NewSessionManager(redisClient)
}

func assertChannelGotMessage(t *testing.T, ch <-chan testMessage, wantResp *common.UpdateSessionResponse) {
	select {
	case tm := <-ch:
		if diff := cmp.Diff(wantResp, tm.toUpdateSessionResponse()); diff != "" {
			t.Errorf("Received wrong message, -want +got:\n%v", diff)
		}
	case <-time.After(time.Second):
		t.Fatalf("Response did not come within the given deadline.")
	}
}

func TestUserSend(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws := ts.connect()
	defer ws.Close()

	u := NewConnectedUser(ctx, "abc", ws, func(ctx context.Context, req *common.UpdateSessionRequest) {})
	defer u.Cancel()

	resp := &common.UpdateSessionResponse{
		NewText: "abc",
	}

	u.send(resp)
	assertChannelGotMessage(t, ts.gotMessage, resp)
}

func TestUserRead(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws := ts.connect()
	defer ws.Close()

	receivedRequests := make(chan *common.UpdateSessionRequest)

	u := NewConnectedUser(ctx, "abc", ws, func(ctx context.Context, req *common.UpdateSessionRequest) {
		receivedRequests <- req
	})
	defer u.Cancel()

	req := &common.UpdateSessionRequest{
		NewText: "abc",
	}

	if err := ts.connections[0].WriteJSON(req); err != nil {
		t.Fatalf("Failed to write: %v", err)
	}

	select {
	case gotReq := <-receivedRequests:
		if diff := cmp.Diff(req, gotReq); diff != "" {
			t.Errorf("Received wrong message, -want +got:\n%v", diff)
		}
	case <-time.After(time.Second):
		t.Fatalf("Response did not come within the given deadline.")
	}
}

func TestUserPing(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws := ts.connect()
	defer ws.Close()

	u := NewConnectedUser(ctx, "abc", ws, func(ctx context.Context, req *common.UpdateSessionRequest) {})
	defer u.Cancel()

	req := &common.UpdateSessionRequest{
		Ping: true,
	}

	if err := ts.connections[0].WriteJSON(req); err != nil {
		t.Fatalf("Failed to write: %v", err)
	}

	assertChannelGotMessage(t, ts.gotMessage, &common.UpdateSessionResponse{Ping: true})
}

func TestSessionBroadcast(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws1 := ts.connect()
	defer ws1.Close()

	ws2 := ts.connect()
	defer ws2.Close()

	sm := prepareSessionmanager()
	sID := sm.NewSession()

	ms := NewManagedSession(ctx, sID, sm)
	defer ms.Cancel()
	ms.AddUser(ctx, "u1", ws1)
	ms.AddUser(ctx, "u2", ws2)

	req := &common.UpdateSessionRequest{
		NewText: "abc",
	}

	if err := ts.connections[0].WriteJSON(req); err != nil {
		t.Fatalf("Failed to write: %v", err)
	}

	assertChannelGotMessage(t, ts.gotMessage, &common.UpdateSessionResponse{
		NewText:  "abc",
		Language: "plaintext",
	})
	assertChannelGotMessage(t, ts.gotMessage, &common.UpdateSessionResponse{
		NewText:  "abc",
		Language: "plaintext",
	})
}

func TestSessionCleanupInactiveUsers(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws1 := ts.connect()
	defer ws1.Close()

	sm := prepareSessionmanager()
	sID := sm.NewSession()

	cleanupTrigger := make(chan time.Time)
	inactiveUserCleanupIntervalChannelSource = func() <-chan time.Time { return cleanupTrigger }

	ms := NewManagedSession(ctx, sID, sm)
	defer ms.Cancel()
	ms.AddUser(ctx, "u1", ws1)
	ms.Users["u1"].Cancel()

	cleanupTrigger <- time.Now()

	time.Sleep(10 * time.Millisecond)

	if diff := cmp.Diff(map[UserID]*ConnectedUser{}, ms.Users); diff != "" {
		t.Errorf("Cleanup was not performed correctly:\n%v", diff)
	}
}

func TestUsersManagerPeriodicResponse(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws1 := ts.connect()
	defer ws1.Close()

	sm := prepareSessionmanager()
	sID := sm.NewSession()
	sm.UpdateSession(ctx, sID, &common.UpdateSessionRequest{
		NewText: "some text",
	})

	umTrigger := make(chan time.Time)

	inactiveSessionCleanupIntervalChannelSource = func() <-chan time.Time { return umTrigger }

	um := NewUsersManager(ctx, sm)
	um.RegisterUser(ctx, sID, "u1", ws1)

	umTrigger <- time.Now()

	assertChannelGotMessage(t, ts.gotMessage, &common.UpdateSessionResponse{
		NewText:  "some text",
		Language: "plaintext",
	})
}

func TestUsersManagerInactiveSessionCleanup(t *testing.T) {
	ctx := context.Background()
	ts := prepareTestServer()
	defer ts.Close()

	ws1 := ts.connect()
	defer ws1.Close()

	sm := prepareSessionmanager()
	sID := sm.NewSession()

	umTrigger := make(chan time.Time)

	sessionCleanupTrigger := make(chan time.Time)
	inactiveUserCleanupIntervalChannelSource = func() <-chan time.Time { return sessionCleanupTrigger }

	amountOfTriggersForSessionToBeInactive = 1
	inactiveSessionCleanupIntervalChannelSource = func() <-chan time.Time { return umTrigger }

	um := NewUsersManager(ctx, sm)
	um.RegisterUser(ctx, sID, "u1", ws1)
	um.managedSessions[sID].Users["u1"].Cancel()

	sessionCleanupTrigger <- time.Now()
	time.Sleep(10 * time.Millisecond)

	umTrigger <- time.Now()
	umTrigger <- time.Now()

	time.Sleep(10 * time.Millisecond)

	if len(um.managedSessions) != 0 {
		t.Errorf("Session %v not cleaned up as expected", sID)
	}
}
