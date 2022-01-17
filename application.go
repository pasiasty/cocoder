package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pasiasty/cocoder/server"
)

func main() {
	m := server.NewRouterManager()
	r := m.Router()
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	r.Run("localhost:5000")
}
