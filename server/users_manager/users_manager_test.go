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

	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/websocket"
	"github.com/pasiasty/cocoder/server/common"
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
	return resp
}

type testServer struct {
	http.Handler

	conn       *websocket.Conn
	gotMessage chan testMessage

	server *httptest.Server
}

func (s *testServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close()

	s.conn = c
	for {
		mt, message, err := c.ReadMessage()
		if err != nil {
			break
		}
		s.gotMessage <- testMessage{mt: mt, body: message}
	}
}

func (s *testServer) Send(mt int, body []byte) error {
	return s.conn.WriteMessage(mt, body)
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
	s.conn.Close()
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

	select {
	case tm := <-ts.gotMessage:
		if diff := cmp.Diff(resp, tm.toUpdateSessionResponse()); diff != "" {
			t.Errorf("Received wrong message, -want +got:\n%v", diff)
		}
	case <-time.After(time.Second):
		t.Fatalf("Response did not come within the given deadline.")
	}
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

	if err := ts.conn.WriteJSON(req); err != nil {
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

	if err := ts.conn.WriteJSON(req); err != nil {
		t.Fatalf("Failed to write: %v", err)
	}

	select {
	case tm := <-ts.gotMessage:
		if diff := cmp.Diff(&common.UpdateSessionResponse{Ping: true}, tm.toUpdateSessionResponse()); diff != "" {
			t.Errorf("Received wrong message, -want +got:\n%v", diff)
		}
	case <-time.After(time.Second):
		t.Fatalf("Response did not come within the given deadline.")
	}
}
