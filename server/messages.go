package server

type UpdateSessionRequest struct {
	BaseText  string `form:"BaseText" diff:"BaseText" json:"BaseText"`
	NewText   string `form:"NewText" diff:"NewText" json:"NewText"`
	CursorPos int    `form:"CursorPos" diff:"CursorPos" json:"CursorPos"`
	UserID    string `form:"UserID" diff:"UserID" json:"UserID"`
	Language  string `form:"Language" diff:"Language" json:"Language"`
}

type UpdateSessionResponse struct {
	NewText   string `json:"NewText" diff:"new_text"`
	CursorPos int    `json:"CursorPos" diff:"cursor_pos"`
	Language  string `json:"Language" diff:"language"`

	Users []*User `json:"Users" diff:"users"`
}

type UpdateLanguageRequest struct {
	Language string `form:"Language" diff:"language"`
}

type GetSessionResponse struct {
	Text     string `json:"Text" diff:"text"`
	Language string `json:"Language" diff:"language"`
}
