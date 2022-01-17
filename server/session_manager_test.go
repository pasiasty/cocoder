package server

import (
	"testing"
)

func TestNewSession(t *testing.T) {
	sm := NewSessionManager()
	createdIDs := make(map[SessionID]interface{})
	for i := 0; i < 100; i++ {
		newID := sm.NewSession()
		if _, ok := createdIDs[newID]; ok {
			t.Errorf("session IDs should not duplicate, but %s did", newID)
		}
		createdIDs[newID] = new(interface{})
	}
}

func TestLoadSession(t *testing.T) {
	sm := NewSessionManager()

	sampleText := "abc"

	s := sm.NewSession()
	sm.UpdateSessionText(s, EditState{NewText: sampleText})

	text, err := sm.LoadSession(s)
	if err != nil {
		t.Errorf("Session does not exist, but should: %v", err)
	}
	if text != sampleText {
		t.Errorf("Session got wrong text, want: %v, got: %v", sampleText, text)
	}

	s = "abc"

	if _, err := sm.LoadSession(s); err == nil {
		t.Errorf("Session '%v' should not exist but does", s)
	}
}

func TestUpdateSessionFlow(t *testing.T) {
	sm := NewSessionManager()

	initialEdit := `Here's something original
	
	animal of the year is:
	fruit of the year is:
	`

	u1Edit := `Here's something original
	
	animal of the year is: gorilla
	fruit of the year is:
	`

	u2Edit := `Here's something original
	
	animal of the year is:
	fruit of the year is: banana
	`

	merged := `Here's something original
	
	animal of the year is: gorilla
	fruit of the year is: banana
	`

	s := sm.NewSession()

	es, err := sm.UpdateSessionText(s, EditState{NewText: initialEdit})
	if err != nil {
		t.Errorf("Unexpected error while updating the text: %v", err)
	}
	if es.NewText != initialEdit {
		t.Errorf("UpdateSessionText returned wrong value, want:\n%v\n\n got:\n%v\n", initialEdit, es.NewText)
	}

	es, err = sm.UpdateSessionText(s, EditState{BaseText: initialEdit, NewText: u1Edit})
	if err != nil {
		t.Errorf("Unexpected error while updating the text: %v", err)
	}
	if es.NewText != u1Edit {
		t.Errorf("UpdateSessionText returned wrong value, want:\n%v\n\n got:\n%v\n", u1Edit, es.NewText)
	}

	es, err = sm.UpdateSessionText(s, EditState{BaseText: initialEdit, NewText: u2Edit})
	if err != nil {
		t.Errorf("Unexpected error while updating the text: %v", err)
	}
	if es.NewText != merged {
		t.Errorf("UpdateSessionText returned wrong value, want:\n%v\n\n got:\n%v\n", merged, es.NewText)
	}
}
