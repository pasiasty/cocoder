package main

import (
	"github.com/gin-gonic/gin"
	"github.com/pasiasty/cocoder/server"
)

func main() {
	m := server.NewRouterManager()
	r := m.Router()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.Run("localhost:5000")
}
