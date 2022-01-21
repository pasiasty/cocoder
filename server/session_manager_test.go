package server

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis"
	"github.com/go-redis/redis"
	"github.com/r3labs/diff/v2"
)

func prepareSessionManager(t *testing.T) *SessionManager {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to setup miniredis: %v", err)
	}
	return NewSessionManager(redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	}))
}

func TestNewSession(t *testing.T) {
	sm := prepareSessionManager(t)
	createdIDs := make(map[SessionID]interface{})
	for i := 0; i < 100; i++ {
		newID := sm.NewSession()
		if _, ok := createdIDs[newID]; ok {
			t.Errorf("session IDs should not duplicate, but %s did", newID)
		}
		createdIDs[newID] = new(interface{})
	}
}

func TestSerializeDeserialize(t *testing.T) {
	for _, tc := range []struct {
		name string
		s    Session
	}{{
		name: "empty",
		s:    Session{},
	}, {
		name: "something",
		s: Session{
			Text: "abc",
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			s := deserializeSession(serializeSession(&tc.s))

			changelog, err := diff.Diff(*s, tc.s)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
			}
		})
	}
}

func TestLoadSession(t *testing.T) {
	sm := prepareSessionManager(t)

	userID1 := "user_1"
	date1 := time.Date(2015, 2, 13, 0, 0, 0, 0, time.UTC)
	userID2 := "user_2"
	date2 := time.Date(2018, 9, 26, 0, 0, 0, 0, time.UTC)

	existingSessionID1 := sm.NewSession()
	existingSessionID2 := sm.NewSession()
	nonexistingSessionID := "abc123"

	sampleText := "abc"
	sampleLanguage := "python"

	anotherSampleText := "def"
	defaultLanguage := "plaintext"

	nowSource = func() time.Time { return date1 }

	if _, err := sm.UpdateSessionText(existingSessionID1, &UpdateSessionRequest{
		NewText: sampleText,
		UserID:  userID1,
	}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}
	if err := sm.UpdateLanguage(existingSessionID1, &UpdateLanguageRequest{Language: sampleLanguage}); err != nil {
		t.Fatalf("Failed to update session language: %v", err)
	}

	nowSource = func() time.Time { return date2 }

	if _, err := sm.UpdateSessionText(existingSessionID2, &UpdateSessionRequest{
		UserID: userID1,
	}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}

	if _, err := sm.UpdateSessionText(existingSessionID2, &UpdateSessionRequest{
		NewText: anotherSampleText,
		UserID:  userID2,
	}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}

	for _, tc := range []struct {
		name        string
		sessionID   SessionID
		wantError   bool
		wantSession *Session
	}{{
		name:      "proper_session",
		sessionID: existingSessionID1,
		wantSession: &Session{
			Text:     sampleText,
			Language: sampleLanguage,
			LastEdit: date1,
			Users: map[string]*User{
				userID1: {
					ID:       userID1,
					Index:    0,
					LastEdit: date1,
					Position: 0,
				},
			},
		},
	}, {
		name:      "proper_session_default_language",
		sessionID: existingSessionID2,
		wantSession: &Session{
			Text:     anotherSampleText,
			Language: defaultLanguage,
			LastEdit: date2,
			Users: map[string]*User{
				userID1: {
					ID:       userID1,
					Index:    0,
					LastEdit: date2,
					Position: 3,
				},
				userID2: {
					ID:       userID2,
					Index:    1,
					LastEdit: date2,
					Position: 0,
				},
			},
		},
	}, {
		name:      "non_existing_session",
		sessionID: SessionID(nonexistingSessionID),
		wantError: true,
	}} {
		t.Run(tc.name, func(t *testing.T) {
			s, err := sm.LoadSession(tc.sessionID)
			if err != nil && !tc.wantError {
				t.Errorf("LoadSession shouldn't have failed but did: %v", err)
			}
			if err == nil && tc.wantError {
				t.Error("LoadSession should've failed, but didn't")
			}

			changelog, err := diff.Diff(s, tc.wantSession)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
				wsJson, _ := json.MarshalIndent(tc.wantSession, "", "  ")
				sJson, _ := json.MarshalIndent(s, "", "  ")
				t.Errorf("Want:\n%v", string(wsJson))
				t.Errorf("Got:\n%v", string(sJson))
			}
		})
	}
}

func editRequestForTesting(es string) *UpdateSessionRequest {
	i := strings.Index(es, "|")
	return &UpdateSessionRequest{
		NewText:   strings.Replace(es, "|", "", 1),
		CursorPos: i,
	}
}

func editResponseForTesting(es string, wasMerged bool) *UpdateSessionResponse {
	i := strings.Index(es, "|")
	return &UpdateSessionResponse{
		NewText:   strings.Replace(es, "|", "", 1),
		CursorPos: i,
		WasMerged: wasMerged,
		Language:  "plaintext",
	}
}

func TestUpdateSessionText(t *testing.T) {
	for _, tc := range []struct {
		name            string
		initialState    string
		clientBase      string
		clientEditState string
		wantEditState   string
		wantWasMerged   bool
	}{{
		name:            "append_to_empty",
		clientEditState: "abc|",
		wantEditState:   "abc|",
	}, {
		name: "simultaneous_edit",
		initialState: `Here's something original
	
		animal of the year is:
		fruit of the year is: banana
		`,
		clientBase: `Here's something original
	
		animal of the year is:
		fruit of the year is:
		`,
		clientEditState: `Here's something original
	
		animal of the year is: gorilla|
		fruit of the year is:
		`,
		wantEditState: `Here's something original
	
		animal of the year is: gorilla|
		fruit of the year is: banana
		`,
		wantWasMerged: true,
	}, {
		name: "cursor_at_whitespaces",
		clientEditState: `abc
		
		
		|`,
		wantEditState: `abc
		
		
		|`,
	}} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name != "simultaneous_edit" {
				t.Skip()
			}
			sm := prepareSessionManager(t)
			s := sm.NewSession()

			if _, err := sm.UpdateSessionText(s, &UpdateSessionRequest{NewText: tc.initialState}); err != nil {
				t.Fatalf("Initial edit should not fail, but did: %v", err)
			}

			es := editRequestForTesting(tc.clientEditState)
			es.BaseText = tc.clientBase

			resEs, err := sm.UpdateSessionText(s, es)
			if err != nil {
				t.Fatalf("Test edit fail, but shouldn't: %v", err)
			}
			wantEs := editResponseForTesting(tc.wantEditState, tc.wantWasMerged)

			changelog, err := diff.Diff(resEs, wantEs)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
			}
		})
	}
}

func TestUpdateSessionTextProcessor(t *testing.T) {
	specialDate := time.Date(2015, 2, 13, 0, 0, 0, 0, time.UTC)
	cursorSpecialGlyph = "|"

	for _, tc := range []struct {
		name     string
		s        Session
		req      UpdateSessionRequest
		wantResp UpdateSessionResponse
	}{{
		name: "two_users_not_colliding",
		s: Session{
			Text: "some text",
			Users: map[string]*User{
				"user_1": {
					ID:       "user_1",
					Index:    0,
					Position: 9,
					LastEdit: specialDate,
				},
				"user_2": {
					ID:       "user_2",
					Index:    1,
					Position: 0,
					LastEdit: specialDate,
				},
			},
		},
		req: UpdateSessionRequest{
			UserID:    "user_1",
			BaseText:  "some text",
			NewText:   "some texta",
			CursorPos: 10,
		},
		wantResp: UpdateSessionResponse{
			NewText:   "some texta",
			CursorPos: 10,
			OtherUsers: []OtherUser{
				{
					CursorPos: 0,
					Index:     1,
				},
			},
		},
	}, {
		name: "two_users_colliding",
		s: Session{
			Text: "some text",
			Users: map[string]*User{
				"user_1": {
					ID:       "user_1",
					Index:    0,
					Position: 0,
					LastEdit: specialDate,
				},
				"user_2": {
					ID:       "user_2",
					Index:    1,
					Position: 9,
					LastEdit: specialDate,
				},
			},
		},
		req: UpdateSessionRequest{
			UserID:    "user_1",
			BaseText:  "some text",
			NewText:   "asome text",
			CursorPos: 1,
		},
		wantResp: UpdateSessionResponse{
			NewText:   "asome text",
			CursorPos: 1,
			OtherUsers: []OtherUser{
				{
					Index:     1,
					CursorPos: 10,
				},
			},
		},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			nowSource = func() time.Time { return specialDate }
			resp := updateSessionTextProcessor(&tc.req, &tc.s).(*UpdateSessionResponse)

			changelog, err := diff.Diff(*resp, tc.wantResp)
			if err != nil {
				t.Fatalf("Diffing failed, but shouldn't: %v", err)
			}

			if len(changelog) > 0 {
				t.Errorf("Following changes were detected:\n%v", changelog)
				gotStr, _ := json.MarshalIndent(resp, "", "  ")
				wantStr, _ := json.MarshalIndent(tc.wantResp, "", "  ")
				t.Errorf("Want:\n%s", wantStr)
				t.Errorf("Got:\n%s", gotStr)
			}
		})
	}
}
