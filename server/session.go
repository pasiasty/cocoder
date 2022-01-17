package server

import (
	"sync"

	"github.com/sergi/go-diff/diffmatchpatch"
)

var MaxHangingMessages = 10

type SessionID string

type Session struct {
	m  sync.Mutex
	id SessionID

	text string
}

type EditState struct {
	BaseText  string
	NewText   string
	CursorPos int
}

func newSession(id SessionID) *Session {
	return &Session{
		id: id,
	}
}

func (s *Session) Text() string {
	return s.text
}

func (s *Session) updateText(editState EditState) EditState {
	s.m.Lock()
	defer s.m.Unlock()

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(editState.BaseText, editState.NewText, false))
	s.text, _ = dmp.PatchApply(userPatches, s.text)

	return EditState{
		NewText:   s.text,
		CursorPos: -1,
	}
}
