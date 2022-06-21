package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/alicebob/miniredis"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis"
	"github.com/pasiasty/cocoder/server/route_manager"
)

func main() {
	ctx := context.Background()

	redisAddr := os.Getenv("REDIS_HOST")
	if redisAddr == "" {
		mr, err := miniredis.Run()
		if err != nil {
			log.Fatalf("Failed to setup miniredis: %v", err)
		}
		redisAddr = mr.Addr()
	}
	redisPassw := os.Getenv("REDIS_PASSWORD")
	redisDBStr := os.Getenv("REDIS_DB")
	redisDB, err := strconv.ParseInt(redisDBStr, 10, 32)
	if err != nil {
		log.Printf("Failed to parse REDIS_DB (%s) as int", redisDBStr)
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassw,
		DB:       int(redisDB),
	})

	m := route_manager.NewRouterManager(ctx, redisClient)
	defer m.Dispose()

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
