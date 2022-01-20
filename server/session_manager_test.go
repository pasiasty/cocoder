package server

import (
	"strings"
	"testing"

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

	existingSessionID := sm.NewSession()
	nonexistingSessionID := "abc123"

	sampleText := "abc"
	sampleLanguage := "python"

	if _, err := sm.UpdateSessionText(existingSessionID, &UpdateSessionRequest{NewText: sampleText}); err != nil {
		t.Fatalf("Failed to update session text: %v", err)
	}
	if err := sm.UpdateLanguage(existingSessionID, &UpdateLanguageRequest{Language: sampleLanguage}); err != nil {
		t.Fatalf("Failed to update session language: %v", err)
	}

	for _, tc := range []struct {
		name        string
		sessionID   SessionID
		wantError   bool
		wantSession *Session
	}{{
		name:      "proper_session",
		sessionID: existingSessionID,
		wantSession: &Session{
			Text:     sampleText,
			Language: sampleLanguage,
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
