package users_manager

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

	"github.com/pasiasty/cocoder/server/common"
	"github.com/pasiasty/cocoder/server/session_manager"
)

var (
	amountOfTriggersForSessionToBeInactive int32 = 120

	userReadIntervalChannelSource               = func() <-chan time.Time { return time.After(10 * time.Millisecond) }
	inactiveUserCleanupIntervalChannelSource    = func() <-chan time.Time { return time.After(1 * time.Second) }
	inactiveSessionCleanupIntervalChannelSource = func() <-chan time.Time { return time.After(1 * time.Second) }
)

type UserID string

type ConnectedUser struct {
	mux sync.Mutex

	UserID           UserID
	conn             *websocket.Conn
	fromUsersHandler func(context.Context, *common.UpdateSessionRequest)
	toUser           chan *common.UpdateSessionResponse
	cancelled        bool
}

func (u *ConnectedUser) send(resp *common.UpdateSessionResponse) {
	u.mux.Lock()
	defer u.mux.Unlock()

	if !u.cancelled {
		u.toUser <- resp
	}
}

func NewConnectedUser(ctx context.Context, userID UserID, conn *websocket.Conn, fromUsersHandler func(context.Context, *common.UpdateSessionRequest)) *ConnectedUser {
	log.Printf("connected user: %v", userID)
	u := &ConnectedUser{
		UserID:           userID,
		conn:             conn,
		fromUsersHandler: fromUsersHandler,
		toUser:           make(chan *common.UpdateSessionResponse, 32),
	}

	go u.readLoop(ctx)
	go u.writeLoop(ctx)

	return u
}

func (u *ConnectedUser) readLoop(ctx context.Context) {
	defer u.Cancel()

	for {
		select {
		case <-userReadIntervalChannelSource():
			_, msg, err := u.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Unexpected websocket error: %v, user: %v", err, u.UserID)
				}
				return
			}
			req := &common.UpdateSessionRequest{}
			if err := json.Unmarshal(msg, req); err != nil {
				log.Printf("Failed to unmarshal UpdateSessionRequest: %v", err)
				continue
			}
			if req.Ping {
				u.send(&common.UpdateSessionResponse{Ping: true})
				continue
			}

			u.fromUsersHandler(ctx, req)
		case <-ctx.Done():
			return
		}
	}
}

func (u *ConnectedUser) writeLoop(ctx context.Context) {
	defer u.Cancel()

	for {
		select {
		case resp, ok := <-u.toUser:
			if !ok {
				return
			}
			u.mux.Lock()
			if err := u.conn.WriteJSON(resp); err != nil {
				log.Printf("Failed to send response to user: %v", err)
			}
			u.mux.Unlock()
		case <-ctx.Done():
			return
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
	req  *common.UpdateSessionRequest
}

type ToUsersItem struct {
	task *trace.Task
	resp *common.UpdateSessionResponse
}

type ManagedSession struct {
	mux sync.Mutex

	cancelled bool

	SessionID session_manager.SessionID
	Users     map[UserID]*ConnectedUser
	sm        *session_manager.SessionManager

	fromUsers chan FromUsersItem
	toUsers   chan *common.UpdateSessionResponse

	lastResponseHash []byte

	runningTasks map[int64]*trace.Task
}

func (s *ManagedSession) fromUsersHandler(ctx context.Context, req *common.UpdateSessionRequest) {
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
		s.cleanupInactiveUsers()
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

func (s *ManagedSession) sendResponseToUsers(resp *common.UpdateSessionResponse) {
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
		case <-inactiveUserCleanupIntervalChannelSource():
			s.mux.Lock()
			s.cleanupInactiveUsers()
			s.mux.Unlock()
		}
	}
}

func (s *ManagedSession) cleanupInactiveUsers() {
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

func NewManagedSession(ctx context.Context, sessionID session_manager.SessionID, sm *session_manager.SessionManager) *ManagedSession {
	s := &ManagedSession{
		SessionID:    sessionID,
		sm:           sm,
		fromUsers:    make(chan FromUsersItem, 32),
		toUsers:      make(chan *common.UpdateSessionResponse, 32),
		Users:        make(map[UserID]*ConnectedUser),
		runningTasks: make(map[int64]*trace.Task),
	}

	go s.loop(ctx)

	return s
}

type UsersManager struct {
	mux                sync.Mutex
	managedSessions    map[session_manager.SessionID]*ManagedSession
	sessionsInactivity map[session_manager.SessionID]int32
	sm                 *session_manager.SessionManager
}

func NewUsersManager(ctx context.Context, sm *session_manager.SessionManager) *UsersManager {
	um := &UsersManager{
		sm:                 sm,
		managedSessions:    make(map[session_manager.SessionID]*ManagedSession),
		sessionsInactivity: make(map[session_manager.SessionID]int32),
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

			users := []*common.User{}
			for _, u := range s.Users {
				users = append(users, u)
			}

			ms.toUsersHandler(ctx, &ToUsersItem{
				resp: &common.UpdateSessionResponse{
					NewText:            s.Text,
					Language:           s.Language,
					UpdateInputText:    true,
					InputText:          s.InputText,
					UpdateOutputText:   true,
					Stdout:             s.Stdout,
					Stderr:             s.Stderr,
					UpdateRunningState: true,
					Running:            s.Running,
					Users:              users,
				},
			})
		}
	}

	for sID, val := range m.sessionsInactivity {
		if val > amountOfTriggersForSessionToBeInactive {
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
		<-inactiveSessionCleanupIntervalChannelSource()
		m.triggerResponsesAndSessionCleanup(ctx)
	}
}

func (m *UsersManager) RegisterUser(ctx context.Context, sessionID session_manager.SessionID, userID UserID, conn *websocket.Conn) {
	m.mux.Lock()
	defer m.mux.Unlock()
	if _, ok := m.managedSessions[sessionID]; !ok {
		m.managedSessions[sessionID] = NewManagedSession(ctx, sessionID, m.sm)
	}
	ms := m.managedSessions[sessionID]
	ms.AddUser(ctx, userID, conn)
}
