package server

import (
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type RouteManager struct {
	r  *gin.Engine
	sm *SessionManager
}

func NewRouterManager() *RouteManager {
	r := gin.Default()
	sm := NewSessionManager()

	r.GET("/new_session", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"sessionID": sm.NewSession(),
		})
	})

	r.GET("/:session_id/:user_id/stream", func(c *gin.Context) {
		sessionID := SessionID(c.Param("session_id"))
		userID := UserID(c.Param("user_id"))
		uc, err := sm.AddUserToSession(userID, sessionID)
		if err != nil {
			c.String(http.StatusNotAcceptable, fmt.Sprintf("Failed to add user '%s' to session '%s'", userID, sessionID))
		}
		c.Stream(func(w io.Writer) bool {
			if msg, ok := <-uc; ok {
				c.SSEvent("text", msg)
				return true
			}
			return false
		})
	})

	r.POST("/:session_id/:user_id/update_text", func(c *gin.Context) {
		sessionID := SessionID(c.Param("session_id"))
		userID := UserID(c.Param("user_id"))
		oldText := c.PostForm("old_text")
		newText := c.PostForm("new_text")

		text, err := sm.UpdateSessionText(sessionID, userID, oldText, newText)
		if err != nil {
			c.String(http.StatusInternalServerError, fmt.Sprintf("Failed to update session text: %v", err))
			return
		}
		c.JSON(200, gin.H{
			"text": text,
		})
	})

	return &RouteManager{
		r:  r,
		sm: sm,
	}
}

func (m *RouteManager) Router() *gin.Engine {
	return m.r
}
