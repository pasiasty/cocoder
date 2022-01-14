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

func TestAddUserToSession(t *testing.T) {
	sm := NewSessionManager()
	u1 := UserID("a")
	u2 := UserID("b")
	sessionID := sm.NewSession()
	if _, err := sm.AddUserToSession(u1, sessionID); err != nil {
		t.Errorf("Adding user shouldn't failed but did: %v", err)
	}
	if _, err := sm.AddUserToSession(u1, sessionID); err != nil {
		t.Errorf("Adding user shouldn't failed but did: %v", err)
	}
	if _, err := sm.AddUserToSession(u2, sessionID); err != nil {
		t.Errorf("Adding user shouldn't failed but did: %v", err)
	}
	if _, err := sm.AddUserToSession(u2, sessionID); err != nil {
		t.Errorf("Adding user shouldn't failed but did: %v", err)
	}
}

func TestRemoveUserFromSession(t *testing.T) {
	sm := NewSessionManager()
	u1 := UserID("a")
	u2 := UserID("b")
	sessionID := sm.NewSession()
	if _, err := sm.AddUserToSession(u1, sessionID); err != nil {
		t.Errorf("Adding user shouldn't failed but did: %v", err)
	}
	if err := sm.RemoveUserFromSession(u1, sessionID); err != nil {
		t.Errorf("Adding user shouldn't failed but did: %v", err)
	}
	if err := sm.RemoveUserFromSession(u2, sessionID); err == nil {
		t.Errorf("Adding user should've failed but didn't")
	}
}

func TestUpdateSessionFlow(t *testing.T) {
	sm := NewSessionManager()
	u1 := UserID("a")
	u2 := UserID("b")

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
	c1, _ := sm.AddUserToSession(u1, s)
	c2, _ := sm.AddUserToSession(u2, s)

	text, err := sm.UpdateSessionText(s, u1, "", initialEdit)
	if err != nil {
		t.Errorf("Unexpected error while updating the text: %v", err)
	}
	if text != initialEdit {
		t.Errorf("UpdateSessionText returned wrong value, want:\n%v\n\n got:\n%v\n", initialEdit, text)
	}
	if u2Rec := <-c2; u2Rec != text {
		t.Errorf("User2 has received wrong notification, want:\n%v\n\n got:\n%v\n", text, u2Rec)
	}

	text, err = sm.UpdateSessionText(s, u1, initialEdit, u1Edit)
	if err != nil {
		t.Errorf("Unexpected error while updating the text: %v", err)
	}
	if text != u1Edit {
		t.Errorf("UpdateSessionText returned wrong value, want:\n%v\n\n got:\n%v\n", u1Edit, text)
	}
	if u2Rec := <-c2; u2Rec != text {
		t.Errorf("User2 has received wrong notification, want:\n%v\n\n got:\n%v\n", text, u2Rec)
	}

	text, err = sm.UpdateSessionText(s, u2, initialEdit, u2Edit)
	if err != nil {
		t.Errorf("Unexpected error while updating the text: %v", err)
	}
	if text != merged {
		t.Errorf("UpdateSessionText returned wrong value, want:\n%v\n\n got:\n%v\n", merged, text)
	}
	if u1Rec := <-c1; u1Rec != text {
		t.Errorf("User1 has received wrong notification, want:\n%v\n\n got:\n%v\n", text, u1Rec)
	}
}
