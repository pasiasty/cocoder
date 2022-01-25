package server

type UpdateSessionRequest struct {
	BaseText  string `form:"BaseText" diff:"BaseText" json:"BaseText"`
	NewText   string `form:"NewText" diff:"NewText" json:"NewText"`
	CursorPos int    `form:"CursorPos" diff:"CursorPos" json:"CursorPos"`
	UserID    string `form:"UserID" diff:"UserID" json:"UserID"`
}

type OtherUser struct {
	Index     int `json:"Index" diff:"index"`
	CursorPos int `json:"CursorPos" diff:"cursor_pos"`
}

type UpdateSessionResponse struct {
	NewText   string `json:"NewText" diff:"new_text"`
	CursorPos int    `json:"CursorPos" diff:"cursor_pos"`
	WasMerged bool   `json:"WasMerged" diff:"was_merged"`
	Language  string `json:"Language" diff:"language"`

	OtherUsers []OtherUser `json:"OtherUsers" diff:"other_users"`
}

type UpdateLanguageRequest struct {
	Language string `form:"Language" diff:"language"`
}

type GetSessionResponse struct {
	Text     string `json:"Text" diff:"text"`
	Language string `json:"Language" diff:"language"`
}
