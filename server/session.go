package server

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/sergi/go-diff/diffmatchpatch"
)

type SessionID string

type User struct {
	ID       string    `json:"ID" diff:"ID"`
	Index    int       `json:"Index" diff:"Index"`
	Position int       `json:"Position" diff:"Position"`
	LastEdit time.Time `json:"LastEdit" diff:"LastEdit"`
}

type Session struct {
	Text     string    `json:"Text" diff:"Text"`
	Language string    `json:"Language" diff:"Language"`
	LastEdit time.Time `json:"LastEdit" diff:"LastEdit"`

	Users map[string]*User `json:"Users" diff:"Users"`
}

func DefaultSession() *Session {
	return &Session{
		Language: "plaintext",
		Users:    make(map[string]*User),
	}
}

func cursorSpecialSequenceFormat() string {
	return cursorSpecialGlyph + "%v" + cursorSpecialGlyph
}

func cursorSpecialSequenceRe() *regexp.Regexp {
	glyphEscaped := ""
	for _, c := range cursorSpecialGlyph {
		glyphEscaped += fmt.Sprintf("[%s]", string(c))
	}
	return regexp.MustCompile("(" + glyphEscaped + "[0-9]+" + glyphEscaped + ")")
}

func (s *Session) UpdateText(req *UpdateSessionRequest) *UpdateSessionResponse {
	now := nowSource()

	if req.CursorPos < 0 || req.CursorPos > len(req.NewText) {
		req.CursorPos = 0
	}

	wasMerged := req.BaseText != s.Text

	if user, ok := s.Users[req.UserID]; ok {
		user.Position = req.CursorPos
		user.LastEdit = now
	} else {
		s.Users[req.UserID] = &User{
			ID:       req.UserID,
			Index:    len(s.Users),
			Position: req.CursorPos,
			LastEdit: now,
		}
	}

	for _, u := range usersSortedByPositions(s.Users) {
		if u.ID == req.UserID {
			req.NewText = req.NewText[:u.Position] + fmt.Sprintf(cursorSpecialSequenceFormat(), u.Index) + req.NewText[u.Position:]
		} else {
			s.Text = s.Text[:u.Position] + fmt.Sprintf(cursorSpecialSequenceFormat(), u.Index) + s.Text[u.Position:]
		}

	}

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(req.BaseText, req.NewText, false))
	textWithCursors, _ := dmp.PatchApply(userPatches, s.Text)

	newCursorPos := -1

	for _, u := range s.Users {
		rawNewPosition := strings.Index(textWithCursors, fmt.Sprintf(cursorSpecialSequenceFormat(), u.Index))
		if rawNewPosition < 0 {
			rawNewPosition = 0
		}
		u.Position = len(cursorSpecialSequenceRe().ReplaceAllString(textWithCursors[:rawNewPosition], ""))
		if u.ID == req.UserID {
			newCursorPos = u.Position
		}
	}

	s.Text = cursorSpecialSequenceRe().ReplaceAllString(textWithCursors, "")

	s.LastEdit = now

	otherUsers := []OtherUser{}

	for _, u := range s.Users {
		if u.ID == req.UserID || now.Sub(u.LastEdit) > time.Minute {
			continue
		}
		otherUsers = append(otherUsers, OtherUser{
			Index:     u.Index,
			CursorPos: u.Position,
		})
	}

	return &UpdateSessionResponse{
		NewText:    s.Text,
		CursorPos:  newCursorPos,
		WasMerged:  wasMerged,
		Language:   s.Language,
		OtherUsers: otherUsers,
	}
}

func serializeSession(s *Session) string {
	b := new(bytes.Buffer)
	e := gob.NewEncoder(b)
	if err := e.Encode(s); err != nil {
		panic(fmt.Sprintf("Failed to encode session (%v): %v", s, err))
	}
	return b.String()
}

func deserializeSession(s string) *Session {
	res := &Session{}
	b := bytes.NewBuffer([]byte(s))
	d := gob.NewDecoder(b)
	if err := d.Decode(res); err != nil {
		panic(fmt.Sprintf("Failed to decode session (%v): %v", s, err))
	}
	return res
}
