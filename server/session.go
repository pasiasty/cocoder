package server

import (
	"strings"
	"sync"

	"github.com/sergi/go-diff/diffmatchpatch"
)

const (
	cursorSpecialSequence = "阳цąß"
)

type SessionID string

type Session struct {
	m  sync.Mutex
	id SessionID

	text string
}

type EditState struct {
	BaseText  string `diff:"base_text"`
	NewText   string `diff:"new_text"`
	CursorPos int    `diff:"cursor_pos"`
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

	if editState.CursorPos < 0 || editState.CursorPos > len(editState.NewText) {
		editState.CursorPos = 0
	}

	editState.NewText = editState.NewText[:editState.CursorPos] + cursorSpecialSequence + editState.NewText[editState.CursorPos:]

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(editState.BaseText, editState.NewText, false))
	textWithCursor, _ := dmp.PatchApply(userPatches, s.text)

	newCursorPos := strings.Index(textWithCursor, cursorSpecialSequence)
	s.text = strings.ReplaceAll(textWithCursor, cursorSpecialSequence, "")

	return EditState{
		NewText:   s.text,
		CursorPos: newCursorPos,
	}
}
