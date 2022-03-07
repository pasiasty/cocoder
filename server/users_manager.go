package server

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/gob"
	"encoding/json"
	"io"
	"log"
	"runtime/trace"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type UserID string

type ConnectedUser struct {
	mux sync.Mutex

	UserID           UserID
	conn             *websocket.Conn
	fromUsersHandler func(context.Context, *UpdateSessionRequest)
	toUser           chan *UpdateSessionResponse
	cancelled        bool
}

func (u *ConnectedUser) send(resp *UpdateSessionResponse) {
	u.mux.Lock()
	defer u.mux.Unlock()

	if !u.cancelled {
		u.toUser <- resp
	}
}

func NewConnectedUser(ctx context.Context, userID UserID, conn *websocket.Conn, fromUsersHandler func(context.Context, *UpdateSessionRequest)) *ConnectedUser {
	log.Printf("connected user: %v", userID)
	u := &ConnectedUser{
		UserID:           userID,
		conn:             conn,
		fromUsersHandler: fromUsersHandler,
		toUser:           make(chan *UpdateSessionResponse, 32),
	}

	go u.readLoop(ctx)
	go u.writeLoop(ctx)

	return u
}

func (u *ConnectedUser) readLoop(ctx context.Context) {
	defer u.Cancel()

	for {
		<-time.After(10 * time.Millisecond)
		_, msg, err := u.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Unexpected websocket error: %v, user: %v", err, u.UserID)
			}
			return
		}
		req := &UpdateSessionRequest{}
		if err := json.Unmarshal(msg, req); err != nil {
			log.Printf("Failed to unmarshal UpdateSessionRequest: %v", err)
			continue
		}
		if req.Ping {
			u.send(&UpdateSessionResponse{Ping: true})
			continue
		}

		u.fromUsersHandler(ctx, req)
	}
}

func (u *ConnectedUser) writeLoop(ctx context.Context) {
	defer u.Cancel()

	for {
		resp, ok := <-u.toUser
		if !ok {
			return
		}
		if err := u.conn.WriteJSON(resp); err != nil {
			log.Printf("Failed to send response to user: %v", err)
		}
	}
}

func (u *ConnectedUser) Cancel() {
	u.mux.Lock()
	defer u.mux.Unlock()

	if !u.cancelled {
		close(u.toUser)
	}

	u.conn.WriteMessage(websocket.CloseMessage, []byte{})
	u.conn.Close()
	u.cancelled = true
}

type FromUsersItem struct {
	task *trace.Task
	req  *UpdateSessionRequest
}

type ToUsersItem struct {
	task *trace.Task
	resp *UpdateSessionResponse
}

type ManagedSession struct {
	mux sync.Mutex

	cancelled bool

	SessionID SessionID
	Users     map[UserID]*ConnectedUser
	sm        *SessionManager

	fromUsers chan FromUsersItem
	toUsers   chan *UpdateSessionResponse

	lastResponseHash []byte

	runningTasks map[int64]*trace.Task
}

func (s *ManagedSession) fromUsersHandler(ctx context.Context, req *UpdateSessionRequest) {
	s.mux.Lock()
	defer s.mux.Unlock()

	if !s.cancelled {
		_, task := trace.NewTask(ctx, "user_request")

		s.fromUsers <- FromUsersItem{
			task: task,
			req:  req,
		}
	}
}

func (s *ManagedSession) toUsersHandler(ctx context.Context, tui *ToUsersItem) {
	s.mux.Lock()
	defer s.mux.Unlock()

	if !s.cancelled {
		if tui.task != nil {
			tui.task.End()
		}
		s.toUsers <- tui.resp
	}
}

func (s *ManagedSession) AddUser(ctx context.Context, userID UserID, conn *websocket.Conn) {
	s.mux.Lock()
	defer s.mux.Unlock()

	if u, ok := s.Users[userID]; ok {
		u.Cancel()
	}
	s.Users[userID] = NewConnectedUser(ctx, userID, conn, s.fromUsersHandler)
}

func (s *ManagedSession) Cancel() {
	s.mux.Lock()
	defer s.mux.Unlock()

	s.cancelled = true
	close(s.fromUsers)
	close(s.toUsers)
}

func (s *ManagedSession) sendResponseToUsers(resp *UpdateSessionResponse) {
	s.mux.Lock()
	defer s.mux.Unlock()

	b := new(bytes.Buffer)
	e := gob.NewEncoder(b)
	if err := e.Encode(resp); err != nil {
		log.Printf("Failed to encodeUpdateSessionResponse: %v", err)
	}

	h := md5.New()
	io.WriteString(h, b.String())
	newHash := h.Sum(nil)

	for _, u := range s.Users {
		if !bytes.Equal(newHash, s.lastResponseHash) {
			u.send(resp)
		}
	}

	s.lastResponseHash = newHash
}

func (s *ManagedSession) loop(ctx context.Context) {
	for {
		select {
		case fromUsersItem, ok := <-s.fromUsers:
			if !ok {
				return
			}
			resp, err := s.sm.UpdateSession(ctx, s.SessionID, fromUsersItem.req)
			if err != nil {
				log.Printf("Failed to update session: %v", err)
			}
			s.toUsersHandler(ctx, &ToUsersItem{
				task: fromUsersItem.task,
				resp: resp,
			})
		case resp, ok := <-s.toUsers:
			if !ok {
				return
			}
			s.sendResponseToUsers(resp)
		case <-time.After(1 * time.Second):
			s.cleanupInactiveUsers()
		}
	}
}

func (s *ManagedSession) cleanupInactiveUsers() {
	s.mux.Lock()
	defer s.mux.Unlock()

	usersToCleanup := make(map[UserID]interface{})

	for _, u := range s.Users {
		if u.cancelled {
			usersToCleanup[u.UserID] = new(interface{})
		}
	}

	for id := range usersToCleanup {
		delete(s.Users, id)
	}
}

func NewManagedSession(ctx context.Context, sessionID SessionID, sm *SessionManager) *ManagedSession {
	s := &ManagedSession{
		SessionID:    sessionID,
		sm:           sm,
		fromUsers:    make(chan FromUsersItem, 32),
		toUsers:      make(chan *UpdateSessionResponse, 32),
		Users:        make(map[UserID]*ConnectedUser),
		runningTasks: make(map[int64]*trace.Task),
	}

	go s.loop(ctx)

	return s
}

type UsersManager struct {
	mux                sync.Mutex
	managedSessions    map[SessionID]*ManagedSession
	sessionsInactivity map[SessionID]int32
	sm                 *SessionManager
}

func NewUsersManager(ctx context.Context, sm *SessionManager) *UsersManager {
	um := &UsersManager{
		sm:                 sm,
		managedSessions:    make(map[SessionID]*ManagedSession),
		sessionsInactivity: make(map[SessionID]int32),
	}

	go um.loop(ctx)

	return um
}

func (m *UsersManager) triggerResponsesAndSessionCleanup(ctx context.Context) {
	m.mux.Lock()
	defer m.mux.Unlock()

	for id, ms := range m.managedSessions {
		if len(ms.Users) == 0 {
			m.sessionsInactivity[id]++
		} else {
			m.sessionsInactivity[id] = 0

			s, err := m.sm.LoadSession(ms.SessionID)
			if err != nil {
				log.Printf("Failed to load session: %v", err)
				continue
			}

			users := []*User{}
			for _, u := range s.Users {
				users = append(users, u)
			}

			ms.toUsersHandler(ctx, &ToUsersItem{
				resp: &UpdateSessionResponse{
					NewText:  s.Text,
					Language: s.Language,
					Users:    users,
				},
			})
		}
	}

	for sID, val := range m.sessionsInactivity {
		if val > 120 {
			s, ok := m.managedSessions[sID]
			if ok {
				s.Cancel()
				delete(m.managedSessions, sID)
				delete(m.sessionsInactivity, sID)
			}
		}
	}
}

func (m *UsersManager) loop(ctx context.Context) {
	for {
		<-time.After(time.Second)
		m.triggerResponsesAndSessionCleanup(ctx)
	}
}

func (m *UsersManager) RegisterUser(ctx context.Context, sessionID SessionID, userID UserID, conn *websocket.Conn) {
	m.mux.Lock()
	defer m.mux.Unlock()
	if _, ok := m.managedSessions[sessionID]; !ok {
		m.managedSessions[sessionID] = NewManagedSession(ctx, sessionID, m.sm)
	}
	ms := m.managedSessions[sessionID]
	if u, ok := ms.Users[userID]; ok {
		u.Cancel()
	}
	ms.AddUser(ctx, userID, conn)
}
