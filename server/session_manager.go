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

func (m *SessionManager) NewSession() SessionID {
	newSessionID := SessionID(uuid.New().String())
	newSession := newSession(newSessionID)
	m.sessions[newSessionID] = newSession
	return newSessionID
}

func (m *SessionManager) LoadSession(session SessionID) (string, error) {
	if s, ok := m.sessions[session]; ok {
		return s.Text(), nil
	}
	return "", fmt.Errorf("failed to load session '%s'", session)
}

func (m *SessionManager) UpdateSessionText(session SessionID, editState EditState) (EditState, error) {
	if s, ok := m.sessions[session]; ok {
		return s.updateText(editState), nil
	}
	return EditState{}, fmt.Errorf("session: '%s' not found, failed to update text", session)
}
