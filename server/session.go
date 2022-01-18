package server

import (
	"strings"

	"github.com/sergi/go-diff/diffmatchpatch"
)

const (
	cursorSpecialSequence = "阳цąß"
)

type SessionID string

type Session struct {
	id SessionID
	ts textStorage
}

type transformFunc func(es EditState, text string) EditState

type textStorage interface {
	Text() string
	UpdateText(es EditState, transform transformFunc) EditState
}

type EditState struct {
	BaseText  string `diff:"base_text"`
	NewText   string `diff:"new_text"`
	CursorPos int    `diff:"cursor_pos"`
}

func newSession(id SessionID) *Session {
	return &Session{
		id: id,
		ts: &MemoryTextStorage{},
	}
}

func (s *Session) Text() string {
	return s.ts.Text()
}

func (s *Session) transform(es EditState, text string) EditState {
	if es.CursorPos < 0 || es.CursorPos > len(es.NewText) {
		es.CursorPos = 0
	}

	es.NewText = es.NewText[:es.CursorPos] + cursorSpecialSequence + es.NewText[es.CursorPos:]

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(es.BaseText, es.NewText, false))
	textWithCursor, _ := dmp.PatchApply(userPatches, text)

	newCursorPos := strings.Index(textWithCursor, cursorSpecialSequence)
	text = strings.ReplaceAll(textWithCursor, cursorSpecialSequence, "")

	return EditState{
		NewText:   text,
		CursorPos: newCursorPos,
	}
}

func (s *Session) updateText(es EditState) EditState {
	return s.ts.UpdateText(es, s.transform)
}
