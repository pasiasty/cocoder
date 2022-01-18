package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pasiasty/cocoder/server"
)

func main() {
	m := server.NewRouterManager()
	r := m.Router()
	r.LoadHTMLGlob("templates/*.tmpl.html")

	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl.html", nil)
	})
	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	r.Run("localhost:5000")
}
