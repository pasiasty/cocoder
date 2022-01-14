package server

import (
	"fmt"

	"github.com/google/uuid"
)

type CanvasManager struct {
	sessions map[SessionID]*Session
}

func New() *CanvasManager {
	return &CanvasManager{
		sessions: make(map[SessionID]*Session),
	}
}

func (m *CanvasManager) NewSession(user UserID) SessionID {
	newSessionID := SessionID(uuid.New().String())
	newSession := newSession(newSessionID)
	newSession.addUser(user)
	m.sessions[newSessionID] = newSession
	return newSessionID
}

func (m *CanvasManager) AddUserToSession(user UserID, session SessionID) error {
	if s, ok := m.sessions[session]; ok {
		return s.addUser(user)
	}
	return fmt.Errorf("session: '%s' not found, failed to add user: '%s'", session, user)
}

func (m *CanvasManager) RemoveUserFromSession(user UserID, session SessionID) error {
	if s, ok := m.sessions[session]; ok {
		return s.removeUser(user)
	}
	return fmt.Errorf("session: '%s' not found, failed to remove user: '%s'", session, user)
}

func (m *CanvasManager) UpdateSessionText(session SessionID, user UserID, baseText, newText string) (string, error) {
	if s, ok := m.sessions[session]; ok {
		return s.updateText(user, baseText, newText), nil
	}
	return "", fmt.Errorf("session: '%s' not found, failed to update text by user: '%s'", session, user)
}
