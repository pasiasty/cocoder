package session_manager

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/sergi/go-diff/diffmatchpatch"

	"github.com/pasiasty/cocoder/server/common"
)

type SessionID string

type SpecialSequence struct {
	userID   string
	text     string
	position int
}

func sequencesToInsert(u *common.User) []SpecialSequence {
	res := []SpecialSequence{
		{
			userID:   u.ID,
			position: u.Position,
			text:     fmt.Sprintf(specialSequenceFormat(), u.Index),
		},
	}

	if u.HasSelection {
		res = append(res, SpecialSequence{
			position: u.SelectionStart,
			text:     fmt.Sprintf(specialSequenceFormat(), fmt.Sprintf("start%v", u.Index)),
		}, SpecialSequence{
			position: u.SelectionEnd,
			text:     fmt.Sprintf(specialSequenceFormat(), fmt.Sprintf("end%v", u.Index)),
		})
	}

	return res
}

type Session struct {
	mux sync.Mutex

	Text     string    `json:"Text" diff:"Text"`
	Language string    `json:"Language" diff:"Language"`
	LastEdit time.Time `json:"LastEdit" diff:"LastEdit"`

	Users map[string]*common.User `json:"Users" diff:"Users"`
}

func DefaultSession() *Session {
	return &Session{
		Language: "plaintext",
		Users:    make(map[string]*common.User),
	}
}

func specialSequenceFormat() string {
	return cursorSpecialGlyph + "%v" + cursorSpecialGlyph
}

func cursorSpecialSequenceRe() *regexp.Regexp {
	glyphEscaped := ""
	for _, c := range cursorSpecialGlyph {
		glyphEscaped += fmt.Sprintf("[%s]", string(c))
	}
	return regexp.MustCompile("(" + glyphEscaped + "(?:start|end)?[0-9]+" + glyphEscaped + ")")
}

func validateRequest(req *common.UpdateSessionRequest) {
	if req.CursorPos < 0 || req.CursorPos > len(req.NewText) {
		req.CursorPos = 0
	}
}

func (s *Session) updateRequestingUser(req *common.UpdateSessionRequest) {
	if user, ok := s.Users[req.UserID]; ok {
		user.Position = req.CursorPos
		user.HasSelection = req.HasSelection
		user.SelectionStart = req.SelectionStart
		user.SelectionEnd = req.SelectionEnd
		user.LastEdit = nowSource()
	} else {
		s.Users[req.UserID] = &common.User{
			ID:             req.UserID,
			Index:          len(s.Users),
			Position:       req.CursorPos,
			HasSelection:   req.HasSelection,
			SelectionStart: req.SelectionStart,
			SelectionEnd:   req.SelectionEnd,
			LastEdit:       nowSource(),
		}
	}
}

func (s *Session) prepareResponse(req *common.UpdateSessionRequest) *common.UpdateSessionResponse {
	s.LastEdit = nowSource()

	users := []*common.User{}

	for _, u := range s.Users {
		users = append(users, u)
	}

	if req.Language != "" {
		s.Language = req.Language
	}

	return &common.UpdateSessionResponse{
		NewText:  s.Text,
		Language: s.Language,
		Users:    users,
	}
}

func findTokenPosition(token string, textWithCursors string) int {
	rawNewPosition := strings.Index(textWithCursors, fmt.Sprintf(specialSequenceFormat(), token))
	if rawNewPosition < 0 {
		rawNewPosition = 0
	}
	return len(cursorSpecialSequenceRe().ReplaceAllString(textWithCursors[:rawNewPosition], ""))
}

func (s *Session) Update(req *common.UpdateSessionRequest) *common.UpdateSessionResponse {
	s.mux.Lock()
	defer s.mux.Unlock()

	validateRequest(req)
	s.updateRequestingUser(req)

	if (s.Text == req.BaseText) && (req.BaseText == req.NewText) {
		return s.prepareResponse(req)
	}

	if s.Text == req.BaseText {
		for _, u := range req.Users {
			s.Users[u.ID] = u
		}
		s.Text = req.NewText
		return s.prepareResponse(req)
	}

	keepUserPositionFromRequest := s.Text == req.BaseText

	for _, seq := range sequencesToInsertByPosition(s.Users) {
		if seq.userID == req.UserID {
			req.NewText = req.NewText[:seq.position] + seq.text + req.NewText[seq.position:]
		} else {
			s.Text = s.Text[:seq.position] + seq.text + s.Text[seq.position:]
		}

	}

	dmp := diffmatchpatch.New()
	userPatches := dmp.PatchMake(dmp.DiffMain(req.BaseText, req.NewText, false))
	textWithCursors, _ := dmp.PatchApply(userPatches, s.Text)

	for _, u := range s.Users {
		u.Position = findTokenPosition(fmt.Sprintf("%d", u.Index), textWithCursors)

		if u.HasSelection {
			u.SelectionStart = findTokenPosition(fmt.Sprintf("start%d", u.Index), textWithCursors)
			u.SelectionEnd = findTokenPosition(fmt.Sprintf("end%d", u.Index), textWithCursors)
		}

		if keepUserPositionFromRequest && u.ID == req.UserID {
			u.Position = req.CursorPos
			if u.HasSelection {
				u.SelectionStart = req.SelectionStart
				u.SelectionEnd = req.SelectionEnd
			}
		}
	}

	s.Text = cursorSpecialSequenceRe().ReplaceAllString(textWithCursors, "")

	return s.prepareResponse(req)
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
