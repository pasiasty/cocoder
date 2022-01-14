package server

import (
	"fmt"

	"github.com/google/uuid"
)

type SessionManager struct {
	sessions map[SessionID]*Session
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[SessionID]*Session),
	}
}

func (m *SessionManager) NewSession(user UserID) (SessionID, chan string) {
	newSessionID := SessionID(uuid.New().String())
	newSession := newSession(newSessionID)
	c, _ := newSession.addUser(user)
	m.sessions[newSessionID] = newSession
	return newSessionID, c
}

func (m *SessionManager) AddUserToSession(user UserID, session SessionID) (chan string, error) {
	if s, ok := m.sessions[session]; ok {
		return s.addUser(user)
	}
	return nil, fmt.Errorf("session: '%s' not found, failed to add user: '%s'", session, user)
}

func (m *SessionManager) RemoveUserFromSession(user UserID, session SessionID) error {
	if s, ok := m.sessions[session]; ok {
		return s.removeUser(user)
	}
	return fmt.Errorf("session: '%s' not found, failed to remove user: '%s'", session, user)
}

func (m *SessionManager) UpdateSessionText(session SessionID, user UserID, baseText, newText string) (string, error) {
	if s, ok := m.sessions[session]; ok {
		return s.updateText(user, baseText, newText), nil
	}
	return "", fmt.Errorf("session: '%s' not found, failed to update text by user: '%s'", session, user)
}
