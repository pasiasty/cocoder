package server

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type UserID string

type ConnectedUser struct {
	UserID    UserID
	conn      *websocket.Conn
	fromUsers chan *UpdateSessionRequest
	toUser    chan *UpdateSessionResponse
	cancelled bool
}

func NewConnectedUser(userID UserID, conn *websocket.Conn, fromUsers chan *UpdateSessionRequest) *ConnectedUser {
	u := &ConnectedUser{
		UserID:    userID,
		conn:      conn,
		fromUsers: fromUsers,
		toUser:    make(chan *UpdateSessionResponse, 32),
	}

	go u.readLoop()
	go u.writeLoop()

	return u
}

func (u *ConnectedUser) readLoop() {
	defer u.Cancel()

	for {
		_, msg, err := u.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Unexpected websocket error: %v", err)
			}
			break
		}
		req := &UpdateSessionRequest{}
		if err := json.Unmarshal(msg, req); err != nil {
			log.Printf("Failed to unmarshal UpdateSessionRequest: %v", err)
			break
		}

		u.fromUsers <- req
	}
}

func (u *ConnectedUser) writeLoop() {
	defer u.Cancel()

	for {
		select {
		case resp, ok := <-u.toUser:
			if !ok {
				break
			}
			if err := u.conn.WriteJSON(resp); err != nil {
				log.Printf("Failed to send response to user: %v", err)
			}
		}
	}
}

func (u *ConnectedUser) Cancel() {
	close(u.toUser)
	u.conn.WriteMessage(websocket.CloseMessage, []byte{})
	u.conn.Close()
	u.cancelled = true
}

type ManagedSession struct {
	mux       sync.Mutex
	SessionID SessionID
	Users     map[UserID]*ConnectedUser
	sm        *SessionManager

	fromUsers chan *UpdateSessionRequest
	toUsers   chan *UpdateSessionResponse
}

func (s *ManagedSession) AddUser(userID UserID, conn *websocket.Conn) {
	s.mux.Lock()
	defer s.mux.Unlock()

	if u, ok := s.Users[userID]; ok {
		u.Cancel()
	}
	s.Users[userID] = NewConnectedUser(userID, conn, s.fromUsers)
}

func (s *ManagedSession) Cancel() {
	close(s.fromUsers)
	close(s.toUsers)
}

func (s *ManagedSession) sendResponseToUsers(resp *UpdateSessionResponse) {
	s.mux.Lock()
	defer s.mux.Unlock()

	usersToCleanup := make(map[UserID]interface{})

	for id, u := range s.Users {
		if !u.cancelled {
			u.toUser <- resp
		} else {
			usersToCleanup[id] = new(interface{})
		}
	}

	for id := range usersToCleanup {
		delete(s.Users, id)
	}
}

func (s *ManagedSession) loop() {
	for {
		select {
		case req, ok := <-s.fromUsers:
			if !ok {
				return
			}
			resp, err := s.sm.UpdateSessionText(s.SessionID, req)
			if err != nil {
				log.Printf("Failed to update session: %v", err)
			}
			s.toUsers <- resp
		case resp, ok := <-s.toUsers:
			if !ok {
				return
			}
			s.sendResponseToUsers(resp)
		}
	}
}

func NewManagedSession(sessionID SessionID, sm *SessionManager) *ManagedSession {
	s := &ManagedSession{
		SessionID: sessionID,
		sm:        sm,
		fromUsers: make(chan *UpdateSessionRequest, 32),
		toUsers:   make(chan *UpdateSessionResponse, 32),
		Users:     make(map[UserID]*ConnectedUser),
	}

	go s.loop()

	return s
}

type UsersManager struct {
	mux             sync.Mutex
	managedSessions map[SessionID]*ManagedSession
	sm              *SessionManager
}

func NewUsersManager(sm *SessionManager) *UsersManager {
	return &UsersManager{
		sm:              sm,
		managedSessions: make(map[SessionID]*ManagedSession),
	}
}

func (m *UsersManager) RegisterUser(sessionID SessionID, userID UserID, conn *websocket.Conn) {
	m.mux.Lock()
	defer m.mux.Unlock()
	if _, ok := m.managedSessions[sessionID]; !ok {
		m.managedSessions[sessionID] = NewManagedSession(sessionID, m.sm)
	}
	ms := m.managedSessions[sessionID]
	if u, ok := ms.Users[userID]; ok {
		u.Cancel()
	}
	ms.AddUser(userID, conn)
}
