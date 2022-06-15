package session_manager

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/sergi/go-diff/diffmatchpatch"

	"github.com/pasiasty/cocoder/server/common"
)

const specialRuneStart = '\u1098'
const specialRuneEnd = rune(int(specialRuneStart) + 300) // allows max 100 users in the single session

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
			text:     string(specialRune(u.Index, Cursor)),
		},
	}

	if u.HasSelection {
		res = append(res, SpecialSequence{
			userID:   u.ID,
			position: u.SelectionStart,
			text:     string(specialRune(u.Index, SelectionStart)),
		}, SpecialSequence{
			userID:   u.ID,
			position: u.SelectionEnd,
			text:     string(specialRune(u.Index, SelectionEnd)),
		})
	}

	return res
}

func sequencesToInsertByPosition(m map[string]*common.User) []SpecialSequence {
	res := []SpecialSequence{}
	for _, u := range m {
		res = append(res, sequencesToInsert(u)...)
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].position > res[j].position
	})

	return res
}

type Session struct {
	mux sync.Mutex

	Text      string    `json:"Text" diff:"Text"`
	Language  string    `json:"Language" diff:"Language"`
	InputText string    `json:"InputText" diff:"InputText"`
	Stdout    string    `json:"Stdout" diff:"Stdout"`
	Stderr    string    `json:"Stderr" diff:"Stderr"`
	LastEdit  time.Time `json:"LastEdit" diff:"LastEdit"`

	Users map[string]*common.User `json:"Users" diff:"Users"`
}

func DefaultSession() *Session {
	return &Session{
		Language: "plaintext",
		Users:    make(map[string]*common.User),
	}
}

func cursorSpecialSequenceRe() *regexp.Regexp {
	return regexp.MustCompile(fmt.Sprintf(`([%s-%s])`, string(specialRuneStart), string(specialRuneEnd)))
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

	if req.UpdateInputText {
		s.InputText = req.InputText
	}

	if req.UpdateOutputText {
		s.Stdout = req.Stdout
		s.Stderr = req.Stderr
	}

	return &common.UpdateSessionResponse{
		NewText:            s.Text,
		Language:           s.Language,
		Users:              users,
		UpdateInputText:    req.UpdateInputText,
		InputText:          req.InputText,
		UpdateOutputText:   req.UpdateOutputText,
		Stdout:             req.Stdout,
		Stderr:             req.Stderr,
		UpdateRunningState: req.UpdateRunningState,
		Running:            req.Running,
	}
}

type RuneOffset int

const (
	Cursor RuneOffset = iota
	SelectionStart
	SelectionEnd
)

func specialRune(userIdx int, ro RuneOffset) rune {
	return rune(int('\u1098') + (userIdx*3 + int(ro)))
}

func findTokenPosition(userIdx int, ro RuneOffset, textWithCursors string) int {
	rawNewPosition := strings.Index(textWithCursors, string(specialRune(userIdx, ro)))
	if rawNewPosition < 0 {
		rawNewPosition = 0
	}
	return len(cursorSpecialSequenceRe().ReplaceAllString(textWithCursors[:rawNewPosition], ""))
}

func updateUserPosition(old *common.User, new *common.User) {
	old.Position = new.Position
	old.HasSelection = new.HasSelection
	old.SelectionStart = new.SelectionStart
	old.SelectionEnd = new.SelectionEnd
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
			updateUserPosition(s.Users[u.ID], u)
		}
		s.Text = req.NewText
		return s.prepareResponse(req)
	}

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
		u.Position = findTokenPosition(u.Index, Cursor, textWithCursors)

		if u.HasSelection {
			u.SelectionStart = findTokenPosition(u.Index, SelectionStart, textWithCursors)
			u.SelectionEnd = findTokenPosition(u.Index, SelectionEnd, textWithCursors)
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
